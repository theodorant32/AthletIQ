/**
 * AI Chatbot Service
 * Uses Anthropic Claude API with user's training data as context
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../config/database';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are AthletIQ Coach, an AI-powered athletic training assistant. You help users understand their training data, make decisions about workouts, and stay motivated toward their race goals.

Your personality:
- Encouraging but data-driven
- Concise and actionable (no fluff)
- Honest about limitations - if data is missing, say so
- Science-based training advice (polarized training, proper recovery)

When answering questions:
1. Reference actual metrics when available
2. Explain the "why" behind recommendations
3. Acknowledge uncertainty when predictions have wide confidence intervals
4. Prioritize recovery and injury prevention over pushing harder`;

interface ChatContext {
  recentMetrics: Array<{
    date: string;
    ctl: number | null;
    atl: number | null;
    tsb: number | null;
    recovery_status: string | null;
  }>;
  recentActivities: Array<{
    activity_type: string;
    distance_meters: number | null;
    duration_seconds: number | null;
    avg_heart_rate: number | null;
  }>;
  raceGoal: {
    race_type: string | null;
    target_date: string | null;
    predicted_time: number | null;
  } | null;
  weeklyPlan: Array<{
    workout_type: string;
    scheduled_date: string;
    status: string;
  }>;
}

/**
 * Get user's training context for the chatbot
 */
async function getUserContext(userId: string): Promise<ChatContext> {
  // Fetch recent daily metrics (last 14 days)
  const metricsResult = await query(`
    SELECT date, ctl_score, atl_score, tsb_score, recovery_status
    FROM daily_metrics
    WHERE user_id = $1
    ORDER BY date DESC
    LIMIT 14
  `, [userId]);

  // Fetch recent activities (last 10)
  const activitiesResult = await query(`
    SELECT activity_type, distance_meters, duration_seconds, avg_heart_rate
    FROM activities
    WHERE user_id = $1
    ORDER BY start_time DESC
    LIMIT 10
  `, [userId]);

  // Fetch active race goal
  const raceResult = await query(`
    SELECT race_type, target_date, predicted_time_seconds
    FROM race_goals
    WHERE user_id = $1 AND is_active = true
    LIMIT 1
  `, [userId]);

  // Fetch current week's plan
  const planResult = await query(`
    SELECT workout_type, scheduled_date, status
    FROM training_plan
    WHERE user_id = $1
    AND scheduled_date >= NOW() - INTERVAL '3 days'
    AND scheduled_date <= NOW() + INTERVAL '7 days'
    ORDER BY scheduled_date
  `, [userId]);

  return {
    recentMetrics: metricsResult.rows.map((r: any) => ({
      date: r.date,
      ctl: r.ctl_score ? Math.round(r.ctl_score) : null,
      atl: r.atl_score ? Math.round(r.atl_score) : null,
      tsb: r.tsb_score ? Math.round(r.tsb_score) : null,
      recovery_status: r.recovery_status,
    })),
    recentActivities: activitiesResult.rows,
    raceGoal: raceResult.rows[0] ? {
      race_type: raceResult.rows[0].race_type,
      target_date: raceResult.rows[0].target_date,
      predicted_time: raceResult.rows[0].predicted_time_seconds,
    } : null,
    weeklyPlan: planResult.rows,
  };
}

/**
 * Format context for the prompt
 */
function formatContext(context: ChatContext): string {
  const parts: string[] = [];

  // Recent fitness trend
  if (context.recentMetrics.length > 0) {
    const latest = context.recentMetrics[0];
    parts.push(`Current Fitness:
- CTL (Fitness): ${latest.ctl ?? 'N/A'} ${latest.ctl ? (latest.ctl > 60 ? '(high)' : latest.ctl > 40 ? '(moderate)' : '(building)') : ''}
- TSB (Form): ${latest.tsb ?? 'N/A'} ${latest.tsb ? (latest.tsb > 15 ? '(fresh)' : latest.tsb < -10 ? '(fatigued)' : '(neutral)') : ''}
- Recovery: ${latest.recovery_status ?? 'unknown'}`);

    // Trend
    if (context.recentMetrics.length >= 7) {
      const weekAgo = context.recentMetrics[6];
      if (latest.ctl && weekAgo.ctl) {
        const change = latest.ctl - weekAgo.ctl;
        parts.push(`- CTL trend: ${change > 0 ? '+' : ''}${change} over 7 days`);
      }
    }
  }

  // Race goal
  if (context.raceGoal) {
    const { race_type, target_date, predicted_time } = context.raceGoal;
    parts.push(`\nRace Goal: ${race_type?.replace('_', ' ')}`);
    if (target_date) {
      const daysUntil = Math.round((new Date(target_date).getTime() - Date.now()) / 86400000);
      parts.push(`- Target: ${target_date} (${daysUntil} days away)`);
    }
    if (predicted_time) {
      const hours = Math.floor(predicted_time / 3600);
      const mins = Math.floor((predicted_time % 3600) / 60);
      parts.push(`- Predicted: ${hours}:${mins.toString().padStart(2, '0')}`);
    }
  }

  // Recent activity
  if (context.recentActivities.length > 0) {
    const lastRun = context.recentActivities.find(a => a.activity_type === 'run');
    if (lastRun) {
      const distanceKm = lastRun.distance_meters ? (lastRun.distance_meters / 1000).toFixed(1) : '?';
      parts.push(`\nLast Run: ${distanceKm} km`);
    }
  }

  // Upcoming workouts
  const upcomingWorkouts = context.weeklyPlan.filter(w => w.status === 'scheduled');
  if (upcomingWorkouts.length > 0) {
    parts.push(`\nThis Week's Plan:
${upcomingWorkouts.map(w => `- ${w.workout_type.replace('_', ' ')}`).join('\n')}`);
  }

  return parts.join('\n');
}

/**
 * Chat with the AI coach
 */
export async function chat(userId: string, userMessage: string): Promise<string> {
  try {
    // Get user's training context
    const context = await getUserContext(userId);
    const contextText = formatContext(context);

    // Build the prompt
    const userPrompt = `Here is the user's training data:

${contextText || 'No training data available yet. Connect your Garmin or Strava account to start syncing activities.'}

User question: ${userMessage}`;

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract response
    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I received your message.';

    // Save to conversation history
    await saveMessage(userId, 'user', userMessage, context);
    await saveMessage(userId, 'assistant', reply);

    return reply;
  } catch (error) {
    console.error('Chatbot error:', error);

    if (error instanceof Error && error.message.includes('API key')) {
      return 'The AI coach is not configured yet. Please add your Anthropic API key to use this feature.';
    }

    return 'I encountered an error processing your question. Please try again.';
  }
}

/**
 * Save chat message to database
 */
async function saveMessage(
  userId: string,
  role: string,
  content: string,
  context?: any
): Promise<void> {
  try {
    await query(`
      INSERT INTO chat_messages (user_id, role, content, context_data)
      VALUES ($1, $2, $3, $4)
    `, [userId, role, content, context ? JSON.stringify(context) : null]);
  } catch (error) {
    console.error('Failed to save chat message:', error);
  }
}

/**
 * Get chat history for user
 */
export async function getChatHistory(userId: string, limit: number = 50): Promise<Array<{
  role: string;
  content: string;
  created_at: string;
}>> {
  const result = await query(`
    SELECT role, content, created_at
    FROM chat_messages
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return result.rows.reverse();
}
