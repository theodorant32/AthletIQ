/**
 * Lambda handler for weekly training plan generation
 * Triggered by EventBridge on Monday at 7 AM
 */

import { Context } from 'aws-lambda';
import { query, transaction } from '../config/database';

export async function handler(event: any, context: Context): Promise<void> {
  console.log('Starting weekly plan generation...');

  try {
    // Get all users
    const usersResult = await query('SELECT id FROM user_profile');
    const users = usersResult.rows.map((r: any) => r.id);

    for (const userId of users) {
      try {
        await generateWeeklyPlan(userId);
        console.log(`Generated plan for user ${userId}`);
      } catch (error) {
        console.error(`Error generating plan for user ${userId}:`, error);
      }
    }

    console.log('Weekly plan generation completed');
  } catch (error) {
    console.error('Weekly plan generation failed:', error);
    throw error;
  }
}

/**
 * Generate weekly training plan for a user
 */
async function generateWeeklyPlan(userId: string): Promise<void> {
  await transaction(async (client) => {
    // Get current week start (Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Get user's race goal
    const raceResult = await client.query(`
      SELECT race_type, target_date FROM race_goals
      WHERE user_id = $1 AND is_active = true
      LIMIT 1
    `, [userId]);

    const raceGoal = raceResult.rows[0];

    // Get last week's completion rate
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const completionResult = await client.query(`
      SELECT
        COUNT(*) as total_workouts,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_workouts
      FROM training_plan
      WHERE user_id = $1
      AND week_start_date = $2
    `, [userId, lastWeekStart.toISOString().split('T')[0]]);

    const total = parseInt(completionResult.rows[0].total_workouts || '0');
    const completed = parseInt(completionResult.rows[0].completed_workouts || '0');
    const completionRate = total > 0 ? completed / total : 1.0;

    // Get current recovery status
    const recoveryResult = await client.query(`
      SELECT recovery_status, ctl_score, tsb_score
      FROM daily_metrics
      WHERE user_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [userId]);

    const recovery = recoveryResult.rows[0];
    const recoveryStatus = recovery?.recovery_status || 'unknown';
    const tsb = recovery?.tsb_score ? parseFloat(recovery.tsb_score) : 0;

    // Determine training phase based on weeks until race
    let phase = 'base';
    if (raceGoal?.target_date) {
      const weeksUntil = Math.round(
        (new Date(raceGoal.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
      );

      if (raceGoal.race_type === 'half_marathon') {
        if (weeksUntil >= 14) phase = 'base';
        else if (weeksUntil >= 8) phase = 'build';
        else if (weeksUntil >= 2) phase = 'peak';
        else phase = 'taper';
      } else if (raceGoal.race_type === 'marathon') {
        if (weeksUntil >= 16) phase = 'base';
        else if (weeksUntil >= 10) phase = 'build';
        else if (weeksUntil >= 3) phase = 'peak';
        else phase = 'taper';
      }
    }

    // Calculate plan modifier based on completion and recovery
    let planModifier = 1.0;
    if (completionRate < 0.7) planModifier -= 0.15;
    else if (completionRate < 0.9) planModifier -= 0.05;

    if (recoveryStatus === 'red') planModifier -= 0.2;
    else if (recoveryStatus === 'yellow') planModifier -= 0.1;

    if (tsb > 25) planModifier += 0.05;
    else if (tsb < -20) planModifier -= 0.1;

    planModifier = Math.max(0.6, Math.min(1.2, planModifier));

    // Define workout templates by phase
    const workoutTemplates = getWorkoutTemplates(phase, planModifier);

    // Insert workouts for the week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const workoutDate = new Date(weekStart);
      workoutDate.setDate(weekStart.getDate() + dayOffset);
      const dateStr = workoutDate.toISOString().split('T')[0];
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][workoutDate.getDay()];

      const template = workoutTemplates[dayName];

      if (template && template.type !== 'rest') {
        await client.query(`
          INSERT INTO training_plan (
            user_id, week_start_date, workout_type, scheduled_date,
            target_distance_meters, target_duration_seconds,
            target_pace_min_sec_per_km, target_pace_max_sec_per_km,
            target_hr_zone, purpose, instructions, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'scheduled'
          )
        `, [
          userId,
          weekStartStr,
          template.type,
          dateStr,
          template.distance,
          template.duration,
          template.paceMin,
          template.paceMax,
          template.hrZone,
          template.purpose,
          template.instructions,
        ]);
      }
    }

    // Save weekly plan summary
    await client.query(`
      INSERT INTO weekly_plans (
        user_id, week_start_date, phase, plan_json
      ) VALUES (
        $1, $2, $3, $4
      )
      ON CONFLICT (week_start_date) DO UPDATE SET
        phase = $3,
        plan_json = $4,
        updated_at = NOW()
    `, [
      userId,
      weekStartStr,
      phase,
      JSON.stringify({ planModifier, completionRate, recoveryStatus }),
    ]);
  });
}

/**
 * Get workout templates for a training phase
 */
function getWorkoutTemplates(phase: string, modifier: number): Record<string, any> {
  const basePace = 360; // sec/km, would be calculated from user data

  if (phase === 'base') {
    return {
      monday: { type: 'rest', purpose: 'Recovery' },
      tuesday: {
        type: 'long_run',
        distance: Math.round(14000 * modifier),
        paceMin: basePace + 30,
        paceMax: basePace + 60,
        hrZone: 2,
        purpose: 'Build aerobic base',
        instructions: 'Easy conversational pace. Focus on time on feet.',
      },
      wednesday: {
        type: 'recovery',
        distance: Math.round(6000 * modifier),
        paceMin: basePace + 45,
        paceMax: basePace + 75,
        hrZone: 1,
        purpose: 'Active recovery',
        instructions: 'Very easy. Should feel effortless.',
      },
      thursday: {
        type: 'tempo',
        distance: Math.round(8000 * modifier),
        paceMin: basePace - 10,
        paceMax: basePace + 10,
        hrZone: 3,
        purpose: 'Improve lactate threshold',
        instructions: '2km warmup, tempo effort, 1km cooldown',
      },
      friday: { type: 'rest', purpose: 'Recovery' },
      saturday: {
        type: 'cross_train',
        duration: Math.round(45 * 60 * modifier),
        hrZone: 2,
        purpose: 'Aerobic cross-training',
        instructions: 'Cycling, elliptical, or swimming',
      },
      sunday: {
        type: 'long_run',
        distance: Math.round(12000 * modifier),
        paceMin: basePace + 30,
        paceMax: basePace + 60,
        hrZone: 2,
        purpose: 'Build endurance',
        instructions: 'Start conservative, finish strong',
      },
    };
  }

  // Build phase
  if (phase === 'build') {
    return {
      monday: { type: 'rest', purpose: 'Recovery' },
      tuesday: {
        type: 'intervals',
        distance: Math.round(10000 * modifier),
        paceMin: basePace - 20,
        paceMax: basePace,
        hrZone: 4,
        purpose: 'Increase VO2 max',
        instructions: '6x800m at 5K pace with 400m recovery jog',
      },
      wednesday: {
        type: 'recovery',
        distance: Math.round(6000 * modifier),
        paceMin: basePace + 45,
        paceMax: basePace + 75,
        hrZone: 1,
        purpose: 'Active recovery',
      },
      thursday: {
        type: 'tempo',
        distance: Math.round(10000 * modifier),
        paceMin: basePace - 15,
        paceMax: basePace + 5,
        hrZone: 3,
        purpose: 'Threshold development',
      },
      friday: { type: 'rest', purpose: 'Recovery' },
      saturday: {
        type: 'strength',
        purpose: 'Injury prevention',
        instructions: 'Core work, single-leg exercises, plyometrics',
      },
      sunday: {
        type: 'long_run',
        distance: Math.round(18000 * modifier),
        paceMin: basePace + 20,
        paceMax: basePace + 50,
        hrZone: 2,
        purpose: 'Build race-specific endurance',
      },
    };
  }

  // Peak phase
  if (phase === 'peak') {
    return {
      monday: { type: 'rest', purpose: 'Recovery' },
      tuesday: {
        type: 'intervals',
        distance: Math.round(12000 * modifier),
        paceMin: basePace - 25,
        paceMax: basePace - 5,
        hrZone: 4,
        purpose: 'Peak VO2 max development',
      },
      wednesday: {
        type: 'recovery',
        distance: Math.round(6000 * modifier),
        hrZone: 1,
        purpose: 'Recovery',
      },
      thursday: {
        type: 'tempo',
        distance: Math.round(12000 * modifier),
        paceMin: basePace - 10,
        paceMax: basePace + 5,
        hrZone: 3,
        purpose: 'Race pace specificity',
      },
      friday: { type: 'rest', purpose: 'Recovery' },
      saturday: {
        type: 'recovery',
        distance: Math.round(4000 * modifier),
        hrZone: 1,
        purpose: 'Shakeout',
      },
      sunday: {
        type: 'long_run',
        distance: Math.round(22000 * modifier),
        paceMin: basePace,
        paceMax: basePace + 30,
        hrZone: 2,
        purpose: 'Peak long run',
      },
    };
  }

  // Taper phase
  return {
    monday: { type: 'rest', purpose: 'Recovery' },
    tuesday: {
      type: 'intervals',
      distance: Math.round(6000 * modifier),
      paceMin: basePace - 20,
      paceMax: basePace,
      hrZone: 4,
      purpose: 'Maintain sharpness',
      instructions: 'Short intervals, full recovery',
    },
    wednesday: {
      type: 'recovery',
      distance: Math.round(4000 * modifier),
      hrZone: 1,
      purpose: 'Recovery',
    },
    thursday: {
      type: 'tempo',
      distance: Math.round(4000 * modifier),
      paceMin: basePace - 5,
      paceMax: basePace + 5,
      hrZone: 3,
      purpose: 'Race pace feel',
    },
    friday: { type: 'rest', purpose: 'Recovery' },
    saturday: {
      type: 'recovery',
      distance: Math.round(2000 * modifier),
      hrZone: 1,
      purpose: 'Shakeout',
    },
    sunday: {
      type: 'rest',
      purpose: 'Race day preparation',
    },
  };
}
