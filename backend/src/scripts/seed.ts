/**
 * Database seed script - creates sample data for development
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'athletiq',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

async function seed() {
  console.log('Seeding database with sample data...');

  try {
    // Create sample user
    const userResult = await pool.query(`
      INSERT INTO user_profile (garmin_user_id, strava_user_id, weight_kg, resting_heart_rate)
      VALUES ('garmin_123', 'strava_456', 75, 55)
      ON CONFLICT (garmin_user_id) DO NOTHING
      RETURNING id
    `);

    const userId = userResult.rows[0]?.id;

    if (!userId) {
      console.log('User already exists, fetching ID...');
      const existing = await pool.query('SELECT id FROM user_profile LIMIT 1');
      if (existing.rows[0]) {
        seedActivities(existing.rows[0].id);
        seedRaceGoal(existing.rows[0].id);
      }
      return;
    }

    await seedActivities(userId);
    await seedRaceGoal(userId);
    await seedDailyMetrics(userId);
    await seedTrainingPlan(userId);

    console.log('✅ Seed completed successfully');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function seedActivities(userId: string) {
  console.log('Seeding activities...');

  const now = new Date();
  const activities = [];

  // Generate 30 days of sample activities
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Create activity on most days, with rest days every 4th day
    if (i % 4 !== 3) {
      const isLongRun = i % 7 === 0;
      const isTempo = i % 7 === 3;
      const isIntervals = i % 7 === 5;

      const distance = isLongRun
        ? 15000 + Math.random() * 5000
        : isTempo || isIntervals
        ? 8000 + Math.random() * 4000
        : 5000 + Math.random() * 3000;

      const duration = (distance / 1000) * (330 + Math.random() * 60); // pace 5:30-6:30/km

      activities.push({
        user_id: userId,
        source: 'garmin',
        external_id: `sample_${i}`,
        activity_type: 'run',
        activity_name: isLongRun ? 'Long Run' : isTempo ? 'Tempo Run' : isIntervals ? 'Intervals' : 'Easy Run',
        start_time: date.toISOString(),
        duration_seconds: Math.round(duration),
        distance_meters: Math.round(distance),
        avg_heart_rate: 145 + Math.floor(Math.random() * 30),
        max_heart_rate: 175 + Math.floor(Math.random() * 15),
        avg_cadence: 170 + Math.floor(Math.random() * 10),
        elevation_gain_meters: Math.floor(Math.random() * 100),
        vo2_max_estimate: 48 + Math.random() * 8,
        training_load: isLongRun ? 150 : isTempo ? 120 : isIntervals ? 130 : 80,
        aerobic_effect: isLongRun ? 3.5 : isTempo ? 3.0 : isIntervals ? 3.2 : 2.0,
        anaerobic_effect: isLongRun ? 0.5 : isTempo ? 1.5 : isIntervals ? 2.5 : 0.3,
        recovery_time_advised: isLongRun ? 72 : isTempo ? 48 : isIntervals ? 36 : 24,
        hrv_average: 55 + Math.random() * 20,
        hrv_status: Math.random() > 0.3 ? 'balanced' : Math.random() > 0.5 ? 'unbalanced' : 'poor',
        calories: Math.round(distance / 1000 * 70),
      });
    }
  }

  for (const activity of activities) {
    await pool.query(`
      INSERT INTO activities (
        user_id, source, external_id, activity_type, activity_name,
        start_time, duration_seconds, distance_meters, avg_heart_rate,
        max_heart_rate, avg_cadence, elevation_gain_meters, vo2_max_estimate,
        training_load, aerobic_effect, anaerobic_effect, recovery_time_advised,
        hrv_average, hrv_status, calories
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      ON CONFLICT (source, external_id) DO NOTHING
    `, Object.values(activity));
  }

  console.log(`  Inserted ${activities.length} sample activities`);
}

async function seedDailyMetrics(userId: string) {
  console.log('Seeding daily metrics...');

  const now = new Date();
  const metrics = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Simulate CTL building over time
    const ctl = 45 + (30 - i) * 0.5 + Math.random() * 5;
    const atl = 30 + Math.random() * 20;
    const tsb = ctl - atl;

    metrics.push({
      user_id: userId,
      date: date.toISOString().split('T')[0],
      ctl_score: Math.round(ctl * 100) / 100,
      atl_score: Math.round(atl * 100) / 100,
      tsb_score: Math.round(tsb * 100) / 100,
      recovery_status: tsb > 15 ? 'green' : tsb > -10 ? 'green' : tsb > -20 ? 'yellow' : 'red',
    });
  }

  for (const metric of metrics) {
    await pool.query(`
      INSERT INTO daily_metrics (user_id, date, ctl_score, atl_score, tsb_score, recovery_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, date) DO NOTHING
    `, Object.values(metric));
  }

  console.log(`  Inserted ${metrics.length} daily metrics`);
}

async function seedRaceGoal(userId: string) {
  console.log('Seeding race goal...');

  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 120); // 4 months from now

  await pool.query(`
    INSERT INTO race_goals (user_id, race_name, race_type, target_date, target_time_seconds)
    VALUES ($1, 'Spring Half Marathon', 'half_marathon', $2, 7200)
    ON CONFLICT DO NOTHING
  `, [userId, raceDate.toISOString()]);
}

async function seedTrainingPlan(userId: string) {
  console.log('Seeding training plan...');

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

  const workouts = [
    { type: 'long_run', dayOffset: 6, distance: 16000 },
    { type: 'tempo', dayOffset: 3, distance: 8000 },
    { type: 'intervals', dayOffset: 1, distance: 10000 },
    { type: 'recovery', dayOffset: 4, distance: 6000 },
  ];

  for (const workout of workouts) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + workout.dayOffset);

    await pool.query(`
      INSERT INTO training_plan (
        user_id, week_start_date, workout_type, scheduled_date,
        target_distance_meters, target_hr_zone, purpose, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      ON CONFLICT DO NOTHING
    `, [
      userId,
      weekStart.toISOString().split('T')[0],
      workout.type,
      date.toISOString().split('T')[0],
      workout.distance,
      2,
      `Sample ${workout.type.replace('_', ' ')}`,
      Math.random() > 0.5 ? 'completed' : 'scheduled',
    ]);
  }
}

seed();
