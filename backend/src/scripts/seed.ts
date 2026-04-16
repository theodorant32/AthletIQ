import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'athletiq',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

async function seed() {
  console.log('Seeding database with sample data...');

  try {
    let userId: string;

    // Try to create user, or get existing
    const userResult = await pool.query(`
      INSERT INTO user_profile (garmin_user_id, strava_user_id, weight_kg, resting_heart_rate)
      VALUES ('garmin_123', 'strava_456', 75, 55)
      ON CONFLICT (garmin_user_id) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `);

    userId = userResult.rows[0].id;

    await seedActivities(userId);
    await seedRaceGoal(userId);
    await seedDailyMetrics(userId);
    await seedTrainingPlan(userId);

    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function seedActivities(userId: string) {
  console.log('Seeding activities...');

  const now = new Date();
  const activities = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    if (i % 4 !== 3) {
      const isLongRun = i % 7 === 0;
      const isTempo = i % 7 === 3;
      const isIntervals = i % 7 === 5;

      const distance = isLongRun
        ? 15000 + Math.random() * 5000
        : isTempo || isIntervals
        ? 8000 + Math.random() * 4000
        : 5000 + Math.random() * 3000;

      const duration = (distance / 1000) * (330 + Math.random() * 60);

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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (source, external_id) DO UPDATE SET updated_at = NOW()
    `, Object.values(activity));
  }

  console.log(`  Inserted ${activities.length} activities`);
}

async function seedDailyMetrics(userId: string) {
  console.log('Seeding daily metrics...');

  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const ctl = 45 + (30 - i) * 0.5 + Math.random() * 5;
    const atl = 30 + Math.random() * 20;
    const tsb = ctl - atl;

    await pool.query(`
      INSERT INTO daily_metrics (
        user_id, date, ctl_score, atl_score, tsb_score, recovery_status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, date) DO UPDATE SET
        ctl_score = $3,
        atl_score = $4,
        tsb_score = $5,
        recovery_status = $6,
        updated_at = NOW()
    `, [
      userId,
      date.toISOString().split('T')[0],
      Math.round(ctl * 100) / 100,
      Math.round(atl * 100) / 100,
      Math.round(tsb * 100) / 100,
      tsb > 15 ? 'green' : tsb > -10 ? 'green' : tsb > -20 ? 'yellow' : 'red',
    ]);
  }

  console.log('  Inserted 30 daily metrics');
}

async function seedRaceGoal(userId: string) {
  console.log('Seeding race goal...');

  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 120);

  await pool.query(`
    INSERT INTO race_goals (user_id, race_name, race_type, target_date, target_time_seconds)
    VALUES ($1, 'Spring Half Marathon', 'half_marathon', $2, 7200)
    ON CONFLICT ON CONSTRAINT race_goals_pkey DO UPDATE SET
      race_name = EXCLUDED.race_name,
      updated_at = NOW()
  `, [userId, raceDate.toISOString()]);

  console.log('  Inserted race goal');
}

async function seedTrainingPlan(userId: string) {
  console.log('Seeding training plan...');

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  const workouts = [
    { type: 'long_run', dayOffset: 6, distance: 16000, pace: '5:45-6:00/km', purpose: 'Build aerobic endurance', instructions: 'Start conservative. Focus on time on feet. Last 2km should feel controlled.' },
    { type: 'tempo', dayOffset: 3, distance: 8000, pace: '5:15-5:25/km', purpose: 'Improve lactate threshold', instructions: '2km warmup, 5km at tempo pace, 1km cooldown.' },
    { type: 'intervals', dayOffset: 1, distance: 10000, pace: '4:50-5:00/km', purpose: 'Increase VO2 max', instructions: '6x800m at 5K pace with 400m recovery jog between intervals.' },
    { type: 'recovery', dayOffset: 4, distance: 6000, pace: '6:15-6:45/km', purpose: 'Active recovery', instructions: 'Keep it truly easy. Conversational pace throughout.' },
  ];

  for (const workout of workouts) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + workout.dayOffset);

    const [paceMin, paceMax] = workout.pace.split('-').map(p => {
      const [min, sec] = p.replace('/km', '').split(':').map(Number);
      return min * 60 + sec;
    });

    await pool.query(`
      INSERT INTO training_plan (
        user_id, week_start_date, workout_type, scheduled_date,
        target_distance_meters, target_pace_min_sec_per_km, target_pace_max_sec_per_km,
        target_hr_zone, purpose, instructions, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (user_id, week_start_date, workout_type, scheduled_date) DO UPDATE SET
        target_distance_meters = $5,
        purpose = $9,
        instructions = $10,
        updated_at = NOW()
    `, [
      userId,
      weekStart.toISOString().split('T')[0],
      workout.type,
      date.toISOString().split('T')[0],
      workout.distance,
      paceMin,
      paceMax,
      2,
      workout.purpose,
      workout.instructions,
      Math.random() > 0.5 ? 'completed' : 'scheduled',
    ]);
  }

  console.log('  Inserted 4 workouts');
}

seed();
