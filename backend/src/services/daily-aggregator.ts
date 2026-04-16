import { query, transaction } from '../config/database';

interface DailyAggregation {
  user_id: string;
  date: string;
}

/**
 * Computes daily metrics from activities:
 * - CTL (Chronic Training Load): 42-day exponential moving average
 * - ATL (Acute Training Load): 7-day exponential moving average
 * - TSB (Training Stress Balance): CTL - ATL
 * - Recovery status based on TSB and HRV
 */
export async function computeDailyMetrics({ user_id, date }: DailyAggregation): Promise<void> {
  await transaction(async (client) => {
    // Get all activities for the date
    const activitiesQuery = await client.query(`
      SELECT * FROM activities
      WHERE user_id = $1
      AND DATE(start_time) = $2
    `, [user_id, date]);

    const activities = activitiesQuery.rows;

    // Basic aggregations
    const totalActivities = activities.length;
    const totalDistance = activities.reduce((sum, a) => sum + (parseInt(a.distance_meters) || 0), 0);
    const totalDuration = activities.reduce((sum, a) => sum + (parseInt(a.duration_seconds) || 0), 0);
    const totalElevation = activities.reduce((sum, a) => sum + (parseInt(a.elevation_gain_meters) || 0), 0);
    const totalCalories = activities.reduce((sum, a) => sum + (parseInt(a.calories) || 0), 0);
    const trainingLoadSum = activities.reduce((sum, a) => sum + (parseInt(a.training_load) || 0), 0);
    const aerobicEffectSum = activities.reduce((sum, a) => sum + (parseInt(a.aerobic_effect) || 0), 0);
    const anaerobicEffectSum = activities.reduce((sum, a) => sum + (parseInt(a.anaerobic_effect) || 0), 0);

    // Heart rate averages
    const hrActivities = activities.filter(a => a.avg_heart_rate);
    const avgHR = hrActivities.length > 0
      ? Math.round(hrActivities.reduce((sum, a) => sum + parseInt(a.avg_heart_rate), 0) / hrActivities.length)
      : null;

    const maxHR = activities.length > 0
      ? Math.max(...activities.map(a => parseInt(a.max_heart_rate) || 0))
      : null;

    // HRV average
    const hrvActivities = activities.filter(a => a.hrv_average);
    const hrvAvg = hrvActivities.length > 0
      ? hrvActivities.reduce((sum, a) => sum + parseFloat(a.hrv_average), 0) / hrvActivities.length
      : null;

    const hrvStatus = activities.find(a => a.hrv_status)?.hrv_status || null;

    // Calculate CTL and ATL using exponential moving average
    const ctlResult = await client.query(`
      SELECT
        training_load,
        DATE(start_time) as activity_date
      FROM activities
      WHERE user_id = $1
      AND start_time >= NOW() - INTERVAL '42 days'
      AND start_time < $2::date + INTERVAL '1 day'
      ORDER BY start_time DESC
    `, [user_id, date]);

    const ctl = calculateEMA(ctlResult.rows.map(r => r.training_load || 0), 42);
    const atl = calculateEMA(ctlResult.rows.map(r => r.training_load || 0), 7);
    const tsb = ctl !== null && atl !== null ? ctl - atl : null;

    // Determine recovery status
    const recoveryStatus = determineRecoveryStatus(tsb, hrvStatus);

    // Get sleep data from most recent activity with sleep info
    const sleepActivity = activities.find(a => a.sleep_score) || await client.query(`
      SELECT sleep_score FROM activities
      WHERE user_id = $1
      AND sleep_score IS NOT NULL
      ORDER BY start_time DESC
      LIMIT 1
    `, [user_id]).then(r => r.rows[0]);

    const sleepScore = sleepActivity?.sleep_score || null;
    const sleepHours = sleepActivity ? null : null; // Would need separate sleep data source

    // Get resting HR from user profile or recent activities
    const restingHRResult = await client.query(`
      SELECT resting_heart_rate FROM user_profile WHERE id = $1
    `, [user_id]);
    const restingHR = restingHRResult.rows[0]?.resting_heart_rate || null;

    // Upsert daily metrics
    await client.query(`
      INSERT INTO daily_metrics (
        user_id, date, total_activities, total_distance_meters,
        total_duration_seconds, total_elevation_gain_meters, total_calories,
        avg_heart_rate, max_heart_rate, ctl_score, atl_score, tsb_score,
        hrv_average, hrv_status, resting_heart_rate, sleep_score,
        recovery_status, training_load_sum, aerobic_effect_sum, anaerobic_effect_sum,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
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
      user_id, date, totalActivities, totalDistance, totalDuration,
      totalElevation, totalCalories, avgHR, maxHR, ctl, atl, tsb,
      hrvAvg, hrvStatus, restingHR, sleepScore, recoveryStatus,
      trainingLoadSum, aerobicEffectSum, anaerobicEffectSum
    ]);
  });
}

/**
 * Calculate Exponential Moving Average
 * @param values Array of values (most recent first)
 * @param period EMA period
 */
function calculateEMA(values: number[], period: number): number | null {
  if (values.length === 0) return null;

  const multiplier = 2 / (period + 1);
  let ema = values[0];

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * multiplier + ema * (1 - multiplier);
  }

  return Math.round(ema * 100) / 100;
}

/**
 * Determine recovery status based on TSB and HRV
 */
function determineRecoveryStatus(tsb: number | null, hrvStatus: string | null): string {
  if (tsb === null) return 'unknown';

  // TSB interpretation (based on training peaks methodology)
  // TSB > 25: Very fresh (possibly detrained)
  // TSB 0 to 25: Fresh (good for racing)
  // TSB -10 to 0: Neutral (normal training)
  // TSB -20 to -10: Fatigued (building fitness)
  // TSB < -20: Very fatigued (overtraining risk)

  if (tsb < -20) return 'red';
  if (tsb < -10) return 'yellow';
  if (hrvStatus === 'poor') return 'yellow';
  if (hrvStatus === 'unbalanced') return 'yellow';
  return 'green';
}

/**
 * Backfill daily metrics for a date range
 */
export async function backfillDailyMetrics(userId: string, startDate: string, endDate: string): Promise<void> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    console.log(`Computing daily metrics for ${dateStr}`);
    await computeDailyMetrics({ user_id: userId, date: dateStr });
    current.setDate(current.getDate() + 1);
  }
}
