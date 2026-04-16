/**
 * Database models / query helpers
 */

import { query, getClient } from '../config/database';

export interface Activity {
  id: string;
  user_id: string;
  source: 'garmin' | 'strava';
  external_id: string;
  activity_type: string;
  activity_name: string;
  start_time: Date;
  duration_seconds: number;
  distance_meters: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  vo2_max_estimate: number | null;
  training_load: number | null;
  created_at: Date;
}

export interface DailyMetric {
  id: string;
  user_id: string;
  date: string;
  ctl_score: number | null;
  atl_score: number | null;
  tsb_score: number | null;
  recovery_status: string | null;
  total_distance_meters: number | null;
  total_duration_seconds: number | null;
}

export interface TrainingPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  workout_type: string;
  scheduled_date: string;
  target_distance_meters: number | null;
  target_pace_min_sec_per_km: number | null;
  target_pace_max_sec_per_km: number | null;
  target_hr_zone: number | null;
  purpose: string | null;
  status: 'scheduled' | 'completed' | 'skipped';
}

export interface RaceGoal {
  id: string;
  user_id: string;
  race_name: string;
  race_type: string;
  target_date: string;
  target_time_seconds: number | null;
  predicted_time_seconds: number | null;
  confidence_interval_lower: number | null;
  confidence_interval_upper: number | null;
  is_active: boolean;
}

/**
 * Activity queries
 */
export const ActivityModel = {
  async findById(id: string): Promise<Activity | null> {
    const result = await query<Activity>('SELECT * FROM activities WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findByUser(userId: string, limit: number = 50): Promise<Activity[]> {
    const result = await query<Activity>(
      'SELECT * FROM activities WHERE user_id = $1 ORDER BY start_time DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  },

  async findByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Activity[]> {
    const result = await query<Activity>(
      `SELECT * FROM activities
       WHERE user_id = $1
       AND DATE(start_time) BETWEEN $2 AND $3
       ORDER BY start_time DESC`,
      [userId, startDate, endDate]
    );
    return result.rows;
  },

  async create(activity: Partial<Activity>): Promise<Activity> {
    const {
      user_id,
      source,
      external_id,
      activity_type,
      activity_name,
      start_time,
      duration_seconds,
      distance_meters,
      avg_heart_rate,
      max_heart_rate,
      vo2_max_estimate,
      training_load,
    } = activity;

    const result = await query<Activity>(`
      INSERT INTO activities (
        user_id, source, external_id, activity_type, activity_name,
        start_time, duration_seconds, distance_meters, avg_heart_rate,
        max_heart_rate, vo2_max_estimate, training_load
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      user_id,
      source,
      external_id,
      activity_type,
      activity_name,
      start_time,
      duration_seconds,
      distance_meters,
      avg_heart_rate,
      max_heart_rate,
      vo2_max_estimate,
      training_load,
    ]);

    return result.rows[0];
  },
};

/**
 * Daily metrics queries
 */
export const DailyMetricModel = {
  async findByDate(userId: string, date: string): Promise<DailyMetric | null> {
    const result = await query<DailyMetric>(
      'SELECT * FROM daily_metrics WHERE user_id = $1 AND date = $2',
      [userId, date]
    );
    return result.rows[0] || null;
  },

  async findRecent(userId: string, days: number = 30): Promise<DailyMetric[]> {
    const result = await query<DailyMetric>(
      `SELECT * FROM daily_metrics
       WHERE user_id = $1
       AND date >= NOW() - INTERVAL '${days} days'
       ORDER BY date DESC`,
      [userId]
    );
    return result.rows;
  },

  async upsert(metric: Partial<DailyMetric>): Promise<void> {
    const {
      user_id,
      date,
      ctl_score,
      atl_score,
      tsb_score,
      recovery_status,
      total_distance_meters,
      total_duration_seconds,
    } = metric;

    await query(`
      INSERT INTO daily_metrics (
        user_id, date, ctl_score, atl_score, tsb_score,
        recovery_status, total_distance_meters, total_duration_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, date) DO UPDATE SET
        ctl_score = $3,
        atl_score = $4,
        tsb_score = $5,
        recovery_status = $6,
        total_distance_meters = $7,
        total_duration_seconds = $8,
        updated_at = NOW()
    `, [
      user_id,
      date,
      ctl_score,
      atl_score,
      tsb_score,
      recovery_status,
      total_distance_meters,
      total_duration_seconds,
    ]);
  },
};

/**
 * Training plan queries
 */
export const TrainingPlanModel = {
  async findByWeek(
    userId: string,
    weekStart: string
  ): Promise<TrainingPlan[]> {
    const result = await query<TrainingPlan>(
      'SELECT * FROM training_plan WHERE user_id = $1 AND week_start_date = $2 ORDER BY scheduled_date',
      [userId, weekStart]
    );
    return result.rows;
  },

  async findByDate(userId: string, date: string): Promise<TrainingPlan | null> {
    const result = await query<TrainingPlan>(
      'SELECT * FROM training_plan WHERE user_id = $1 AND scheduled_date = $2',
      [userId, date]
    );
    return result.rows[0] || null;
  },

  async markCompleted(planId: string, activityId: string): Promise<void> {
    await query(`
      UPDATE training_plan
      SET status = 'completed', actual_activity_id = $2, updated_at = NOW()
      WHERE id = $1
    `, [planId, activityId]);
  },
};

/**
 * Race goal queries
 */
export const RaceGoalModel = {
  async findActive(userId: string): Promise<RaceGoal | null> {
    const result = await query<RaceGoal>(
      'SELECT * FROM race_goals WHERE user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    );
    return result.rows[0] || null;
  },

  async updatePrediction(
    id: string,
    predictedTime: number,
    confidenceLower: number,
    confidenceUpper: number
  ): Promise<void> {
    await query(`
      UPDATE race_goals
      SET
        predicted_time_seconds = $2,
        confidence_interval_lower = $3,
        confidence_interval_upper = $4,
        updated_at = NOW()
      WHERE id = $1
    `, [id, predictedTime, confidenceLower, confidenceUpper]);
  },
};
