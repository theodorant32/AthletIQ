import { runTransaction, executeQuery } from '../config/database';

interface DailyAggregation {
  user_id: string;
  date: string;
}

/**
 * Computes daily metrics from activities:
 * - CTL (Chronic Training Load): 42-day exponential moving average
 * - ATL (Acute Training Load): 7-day exponential moving average
 * - TSB (Training Stress Balance): CTL - ATL
 */
export async function computeDailyMetrics({ user_id, date }: DailyAggregation): Promise<void> {
  await runTransaction(async (client) => {
    const activitiesResult = await client.query(`
      SELECT * FROM activities
      WHERE user_id = $1 AND DATE(start_time) = $2
    `, [user_id, date]);

    const activities = activitiesResult.rows;

    const aggregates = calculateAggregates(activities);
    const ctl = await calculateCTL(client, user_id, date);
    const atl = await calculateATL(client, user_id, date);
    const tsb = ctl !== null && atl !== null ? ctl - atl : null;
    const recoveryStatus = determineRecoveryStatus(tsb, aggregates.hrvStatus);

    await client.query(`
      INSERT INTO daily_metrics (
        user_id, date, total_activities, total_distance_meters,
        total_duration_seconds, total_elevation_gain_meters, total_calories,
        avg_heart_rate, max_heart_rate, ctl_score, atl_score, tsb_score,
        hrv_average, hrv_status, resting_heart_rate, sleep_score,
        recovery_status, training_load_sum, aerobic_effect_sum, anaerobic_effect_sum,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
      )
      ON CONFLICT (user_id, date) DO UPDATE SET
        total_activities = $3,
        total_distance_meters = $4,
        total_duration_seconds = $5,
        total_elevation_gain_meters = $6,
        total_calories = $7,
        avg_heart_rate = $8,
        max_heart_rate = $9,
        ctl_score = $10,
        atl_score = $11,
        tsb_score = $12,
        hrv_average = $13,
        hrv_status = $14,
        sleep_score = $16,
        recovery_status = $17,
        training_load_sum = $18,
        aerobic_effect_sum = $19,
        anaerobic_effect_sum = $20,
        updated_at = NOW()
    `, [
      user_id, date, aggregates.totalActivities, aggregates.totalDistance,
      aggregates.totalDuration, aggregates.totalElevation, aggregates.totalCalories,
      aggregates.avgHR, aggregates.maxHR, ctl, atl, tsb,
      aggregates.hrvAvg, aggregates.hrvStatus, aggregates.restingHR, aggregates.sleepScore,
      recoveryStatus, aggregates.trainingLoadSum, aggregates.aerobicEffectSum,
      aggregates.anaerobicEffectSum,
    ]);
  });
}

function calculateAggregates(activities: any[]) {
  const totalActivities = activities.length;
  const totalDistance = activities.reduce((sum, a) => sum + (parseInt(a.distance_meters) || 0), 0);
  const totalDuration = activities.reduce((sum, a) => sum + (parseInt(a.duration_seconds) || 0), 0);
  const totalElevation = activities.reduce((sum, a) => sum + (parseInt(a.elevation_gain_meters) || 0), 0);
  const totalCalories = activities.reduce((sum, a) => sum + (parseInt(a.calories) || 0), 0);
  const trainingLoadSum = activities.reduce((sum, a) => sum + (parseInt(a.training_load) || 0), 0);
  const aerobicEffectSum = activities.reduce((sum, a) => sum + (parseInt(a.aerobic_effect) || 0), 0);
  const anaerobicEffectSum = activities.reduce((sum, a) => sum + (parseInt(a.anaerobic_effect) || 0), 0);

  const hrActivities = activities.filter(a => a.avg_heart_rate);
  const avgHR = hrActivities.length > 0
    ? Math.round(hrActivities.reduce((sum, a) => sum + parseInt(a.avg_heart_rate), 0) / hrActivities.length)
    : null;

  const maxHR = activities.length > 0
    ? Math.max(...activities.map(a => parseInt(a.max_heart_rate) || 0))
    : null;

  const hrvActivities = activities.filter(a => a.hrv_average);
  const hrvAvg = hrvActivities.length > 0
    ? hrvActivities.reduce((sum, a) => sum + parseFloat(a.hrv_average), 0) / hrvActivities.length
    : null;

  const hrvStatus = activities.find(a => a.hrv_status)?.hrv_status || null;
  const sleepScore = activities.find(a => a.sleep_score)?.sleep_score || null;
  const restingHR = null; // Would come from user profile

  return {
    totalActivities,
    totalDistance,
    totalDuration,
    totalElevation,
    totalCalories,
    trainingLoadSum,
    aerobicEffectSum,
    anaerobicEffectSum,
    avgHR,
    maxHR,
    hrvAvg,
    hrvStatus,
    sleepScore,
    restingHR,
  };
}

async function calculateCTL(
  client: any,
  userId: string,
  date: string
): Promise<number | null> {
  const result = await client.query(`
    SELECT training_load
    FROM activities
    WHERE user_id = $1
      AND start_time >= $2::date - INTERVAL '42 days'
      AND start_time < $2::date + INTERVAL '1 day'
    ORDER BY start_time DESC
  `, [userId, date]);

  const loads = result.rows.map((r: any) => r.training_load || 0);
  return calculateEMA(loads, 42);
}

async function calculateATL(
  client: any,
  userId: string,
  date: string
): Promise<number | null> {
  const result = await client.query(`
    SELECT training_load
    FROM activities
    WHERE user_id = $1
      AND start_time >= $2::date - INTERVAL '7 days'
      AND start_time < $2::date + INTERVAL '1 day'
    ORDER BY start_time DESC
  `, [userId, date]);

  const loads = result.rows.map((r: any) => r.training_load || 0);
  return calculateEMA(loads, 7);
}

function calculateEMA(values: number[], period: number): number | null {
  if (values.length === 0) return null;

  const multiplier = 2 / (period + 1);
  let ema = values[0];

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * multiplier + ema * (1 - multiplier);
  }

  return Math.round(ema * 100) / 100;
}

function determineRecoveryStatus(tsb: number | null, hrvStatus: string | null): string {
  if (tsb === null) return 'unknown';
  if (tsb < -20) return 'red';
  if (tsb < -10) return 'yellow';
  if (hrvStatus === 'poor' || hrvStatus === 'unbalanced') return 'yellow';
  return 'green';
}

export async function backfillDailyMetrics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    await computeDailyMetrics({ user_id: userId, date: dateStr });
    current.setDate(current.getDate() + 1);
  }
}
