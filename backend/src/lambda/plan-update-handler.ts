import { Context } from 'aws-lambda';
import { runTransaction, executeQuery } from '../config/database';

export async function handler(event: any, context: Context): Promise<void> {
  console.log('Starting weekly plan generation...');

  try {
    const result = await executeQuery('SELECT id FROM user_profile');
    const users = result.rows.map((r: any) => r.id);

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

async function generateWeeklyPlan(userId: string): Promise<void> {
  await runTransaction(async (client) => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const raceResult = await client.query(`
      SELECT race_type, target_date FROM race_goals
      WHERE user_id = $1 AND is_active = true
      LIMIT 1
    `, [userId]);

    const raceGoal = raceResult.rows[0];

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const completionResult = await client.query(`
      SELECT
        COUNT(*) as total_workouts,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_workouts
      FROM training_plan
      WHERE user_id = $1 AND week_start_date = $2
    `, [userId, lastWeekStart.toISOString().split('T')[0]]);

    const total = parseInt(completionResult.rows[0].total_workouts || '0');
    const completed = parseInt(completionResult.rows[0].completed_workouts || '0');
    const completionRate = total > 0 ? completed / total : 1.0;

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

    const phase = determinePhase(raceGoal, raceGoal?.race_type || 'half_marathon');
    const planModifier = calculatePlanModifier(completionRate, recoveryStatus, tsb);
    const workoutTemplates = getWorkoutTemplates(phase, planModifier);

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const workoutDate = new Date(weekStart);
      workoutDate.setDate(weekStart.getDate() + dayOffset);
      const dateStr = workoutDate.toISOString().split('T')[0];
      const dayName = dayNames[workoutDate.getDay()];

      const template = workoutTemplates[dayName];

      if (template && template.type !== 'rest') {
        await client.query(`
          INSERT INTO training_plan (
            user_id, week_start_date, workout_type, scheduled_date,
            target_distance_meters, target_pace_min_sec_per_km, target_pace_max_sec_per_km,
            target_hr_zone, purpose, instructions, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled'
          )
          ON CONFLICT (user_id, week_start_date, workout_type, scheduled_date) DO UPDATE SET
            target_distance_meters = $5,
            target_pace_min_sec_per_km = $6,
            target_pace_max_sec_per_km = $7,
            target_hr_zone = $8,
            purpose = $9,
            instructions = $10,
            updated_at = NOW()
        `, [
          userId,
          weekStartStr,
          template.type,
          dateStr,
          template.distance,
          template.paceMin,
          template.paceMax,
          template.hrZone,
          template.purpose,
          template.instructions,
        ]);
      }
    }

    await client.query(`
      INSERT INTO weekly_plans (user_id, week_start_date, phase, plan_json)
      VALUES ($1, $2, $3, $4)
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

function determinePhase(raceGoal: any, raceType: string): string {
  if (!raceGoal?.target_date) return 'base';

  const weeksUntil = Math.round(
    (new Date(raceGoal.target_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
  );

  if (raceType === 'half_marathon') {
    if (weeksUntil >= 14) return 'base';
    if (weeksUntil >= 8) return 'build';
    if (weeksUntil >= 2) return 'peak';
    return 'taper';
  }

  if (raceType === 'marathon') {
    if (weeksUntil >= 16) return 'base';
    if (weeksUntil >= 10) return 'build';
    if (weeksUntil >= 3) return 'peak';
    return 'taper';
  }

  return 'base';
}

function calculatePlanModifier(completion: number, recovery: string, tsb: number): number {
  let modifier = 1.0;

  if (completion < 0.7) modifier -= 0.15;
  else if (completion < 0.9) modifier -= 0.05;

  if (recovery === 'red') modifier -= 0.2;
  else if (recovery === 'yellow') modifier -= 0.1;

  if (tsb > 25) modifier += 0.05;
  else if (tsb < -20) modifier -= 0.1;

  return Math.max(0.6, Math.min(1.2, modifier));
}

interface WorkoutTemplate {
  type: string;
  distance: number;
  paceMin: number;
  paceMax: number;
  hrZone: number;
  purpose: string;
  instructions: string;
}

function getWorkoutTemplates(phase: string, modifier: number): Record<string, WorkoutTemplate | null> {
  const basePace = 360;

  const templates: Record<string, any> = {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  };

  if (phase === 'base') {
    templates.monday = { type: 'rest', purpose: 'Recovery' };
    templates.tuesday = {
      type: 'long_run',
      distance: Math.round(14000 * modifier),
      paceMin: basePace + 30,
      paceMax: basePace + 60,
      hrZone: 2,
      purpose: 'Build aerobic base',
      instructions: 'Easy conversational pace. Focus on time on feet.',
    };
    templates.wednesday = {
      type: 'recovery',
      distance: Math.round(6000 * modifier),
      paceMin: basePace + 45,
      paceMax: basePace + 75,
      hrZone: 1,
      purpose: 'Active recovery',
      instructions: 'Very easy. Should feel effortless.',
    };
    templates.thursday = {
      type: 'tempo',
      distance: Math.round(8000 * modifier),
      paceMin: basePace - 10,
      paceMax: basePace + 10,
      hrZone: 3,
      purpose: 'Improve lactate threshold',
      instructions: '2km warmup, tempo effort, 1km cooldown.',
    };
    templates.friday = { type: 'rest', purpose: 'Recovery' };
    templates.saturday = {
      type: 'cross_train',
      distance: 0,
      paceMin: 0,
      paceMax: 0,
      hrZone: 2,
      purpose: 'Aerobic cross-training',
      instructions: 'Cycling, elliptical, or swimming for 45 minutes.',
    };
    templates.sunday = {
      type: 'long_run',
      distance: Math.round(12000 * modifier),
      paceMin: basePace + 30,
      paceMax: basePace + 60,
      hrZone: 2,
      purpose: 'Build endurance',
      instructions: 'Start conservative, finish strong.',
    };
  } else if (phase === 'build') {
    templates.monday = { type: 'rest', purpose: 'Recovery' };
    templates.tuesday = {
      type: 'intervals',
      distance: Math.round(10000 * modifier),
      paceMin: basePace - 20,
      paceMax: basePace,
      hrZone: 4,
      purpose: 'Increase VO2 max',
      instructions: '6x800m at 5K pace with 400m recovery jog.',
    };
    templates.wednesday = {
      type: 'recovery',
      distance: Math.round(6000 * modifier),
      paceMin: basePace + 45,
      paceMax: basePace + 75,
      hrZone: 1,
      purpose: 'Active recovery',
      instructions: 'Very easy. Should feel effortless.',
    };
    templates.thursday = {
      type: 'tempo',
      distance: Math.round(10000 * modifier),
      paceMin: basePace - 15,
      paceMax: basePace + 5,
      hrZone: 3,
      purpose: 'Threshold development',
      instructions: '2km warmup, 6km tempo, 2km cooldown.',
    };
    templates.friday = { type: 'rest', purpose: 'Recovery' };
    templates.saturday = {
      type: 'strength',
      distance: 0,
      paceMin: 0,
      paceMax: 0,
      hrZone: 0,
      purpose: 'Injury prevention',
      instructions: 'Core work, single-leg exercises, plyometrics.',
    };
    templates.sunday = {
      type: 'long_run',
      distance: Math.round(18000 * modifier),
      paceMin: basePace + 20,
      paceMax: basePace + 50,
      hrZone: 2,
      purpose: 'Build race-specific endurance',
      instructions: 'Start easy, gradually increase effort.',
    };
  } else if (phase === 'peak') {
    templates.monday = { type: 'rest', purpose: 'Recovery' };
    templates.tuesday = {
      type: 'intervals',
      distance: Math.round(12000 * modifier),
      paceMin: basePace - 25,
      paceMax: basePace - 5,
      hrZone: 4,
      purpose: 'Peak VO2 max development',
      instructions: '8x600m at faster than 5K pace.',
    };
    templates.wednesday = {
      type: 'recovery',
      distance: Math.round(6000 * modifier),
      paceMin: basePace + 45,
      paceMax: basePace + 75,
      hrZone: 1,
      purpose: 'Recovery',
      instructions: 'Very easy. Focus on form.',
    };
    templates.thursday = {
      type: 'tempo',
      distance: Math.round(12000 * modifier),
      paceMin: basePace - 10,
      paceMax: basePace + 5,
      hrZone: 3,
      purpose: 'Race pace specificity',
      instructions: '3km warmup, 7km at goal race pace, 2km cooldown.',
    };
    templates.friday = { type: 'rest', purpose: 'Recovery' };
    templates.saturday = {
      type: 'recovery',
      distance: Math.round(4000 * modifier),
      paceMin: basePace + 60,
      paceMax: basePace + 90,
      hrZone: 1,
      purpose: 'Shakeout',
      instructions: 'Easy jog with strides.',
    };
    templates.sunday = {
      type: 'long_run',
      distance: Math.round(22000 * modifier),
      paceMin: basePace,
      paceMax: basePace + 30,
      hrZone: 2,
      purpose: 'Peak long run',
      instructions: 'Practice race day nutrition and pacing.',
    };
  } else {
    templates.monday = { type: 'rest', purpose: 'Recovery' };
    templates.tuesday = {
      type: 'intervals',
      distance: Math.round(6000 * modifier),
      paceMin: basePace - 20,
      paceMax: basePace,
      hrZone: 4,
      purpose: 'Maintain sharpness',
      instructions: '4x400m with full recovery. Focus on form.',
    };
    templates.wednesday = {
      type: 'recovery',
      distance: Math.round(4000 * modifier),
      paceMin: basePace + 45,
      paceMax: basePace + 75,
      hrZone: 1,
      purpose: 'Recovery',
      instructions: 'Easy jog. Stay loose.',
    };
    templates.thursday = {
      type: 'tempo',
      distance: Math.round(4000 * modifier),
      paceMin: basePace - 5,
      paceMax: basePace + 5,
      hrZone: 3,
      purpose: 'Race pace feel',
      instructions: '2km warmup, 2km at race pace.',
    };
    templates.friday = { type: 'rest', purpose: 'Recovery' };
    templates.saturday = {
      type: 'recovery',
      distance: Math.round(2000 * modifier),
      paceMin: basePace + 60,
      paceMax: basePace + 90,
      hrZone: 1,
      purpose: 'Shakeout',
      instructions: 'Easy jog with a few strides.',
    };
    templates.sunday = { type: 'rest', purpose: 'Race day preparation' };
  }

  return templates;
}
