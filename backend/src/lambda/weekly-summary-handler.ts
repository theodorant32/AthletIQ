/**
 * Lambda handler for weekly summary emails
 * Triggered by EventBridge on Sunday at 8 PM
 */

import { Context } from 'aws-lambda';
import { sendWeeklySummary } from '../services/alerts';
import { query } from '../config/database';

export async function handler(event: any, context: Context): Promise<void> {
  console.log('Starting weekly summary generation...');

  try {
    // Get all users with email preferences
    const usersResult = await query(`
      SELECT id FROM user_profile
    `);

    for (const user of usersResult.rows) {
      try {
        const summary = await generateWeeklySummary(user.id);

        if (summary.totalWorkouts > 0) {
          // Would send to user's email from preferences
          console.log(`Weekly summary for user ${user.id}:`, summary);
          // await sendWeeklySummary(userEmail, summary);
        }
      } catch (error) {
        console.error(`Error generating summary for user ${user.id}:`, error);
      }
    }

    console.log('Weekly summary generation completed');
  } catch (error) {
    console.error('Weekly summary generation failed:', error);
    throw error;
  }
}

/**
 * Generate weekly summary for a user
 */
async function generateWeeklySummary(userId: string): Promise<{
  weekStart: string;
  totalWorkouts: number;
  totalDistance: number;
  totalDuration: number;
  avgCTL: number | null;
  avgTSB: number | null;
  bestWorkout: string;
  recoveryDays: number;
}> {
  // Get week start (Monday)
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Get activities this week
  const activitiesResult = await query(`
    SELECT
      COUNT(*) as total_workouts,
      COALESCE(SUM(distance_meters), 0) as total_distance,
      COALESCE(SUM(duration_seconds), 0) as total_duration
    FROM activities
    WHERE user_id = $1
    AND DATE(start_time) >= $2
  `, [userId, weekStartStr]);

  const stats = activitiesResult.rows[0];

  // Get average CTL and TSB
  const metricsResult = await query(`
    SELECT AVG(ctl_score) as avg_ctl, AVG(tsb_score) as avg_tsb
    FROM daily_metrics
    WHERE user_id = $1
    AND date >= $2
  `, [userId, weekStartStr]);

  const metrics = metricsResult.rows[0];

  // Get best workout (by distance or training load)
  const bestWorkoutResult = await query(`
    SELECT activity_type, distance_meters, duration_seconds
    FROM activities
    WHERE user_id = $1
    AND DATE(start_time) >= $2
    ORDER BY training_load DESC
    LIMIT 1
  `, [userId, weekStartStr]);

  const bestWorkout = bestWorkoutResult.rows[0];

  // Count recovery days
  const recoveryResult = await query(`
    SELECT COUNT(*) as recovery_days
    FROM daily_metrics
    WHERE user_id = $1
    AND date >= $2
    AND recovery_status = 'green'
  `, [userId, weekStartStr]);

  const recoveryDays = parseInt(recoveryResult.rows[0]?.recovery_days || '0');

  let bestWorkoutStr = '';
  if (bestWorkout && bestWorkout.distance_meters) {
    const distanceKm = (bestWorkout.distance_meters / 1000).toFixed(1);
    bestWorkoutStr = `${bestWorkout.activity_type} - ${distanceKm}km`;
  }

  return {
    weekStart: weekStartStr,
    totalWorkouts: parseInt(stats.total_workouts || '0'),
    totalDistance: parseInt(stats.total_distance || '0'),
    totalDuration: parseInt(stats.total_duration || '0'),
    avgCTL: metrics.avg_ctl ? parseFloat(metrics.avg_ctl) : null,
    avgTSB: metrics.avg_tsb ? parseFloat(metrics.avg_tsb) : null,
    bestWorkout: bestWorkoutStr,
    recoveryDays,
  };
}
