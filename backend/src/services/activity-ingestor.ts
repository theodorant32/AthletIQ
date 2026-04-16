import { s3Client, RAW_DATA_BUCKET } from '../config/aws';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { query, transaction } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface GarminActivity {
  summary: {
    activityId: string;
    activityName: string;
    activityType: string;
    startTimeIso: string;
    duration: number; // seconds
    distance: number; // meters
    avgMovingPace: number; // sec/km
    avgHeartRate: number;
    maxHeartRate: number;
    avgCadence: number;
    elevationGain: number;
    elevationLoss: number;
    vo2Max: number;
    trainingLoad: number;
    trainingEffect: {
      aerobic: number;
      anaerobic: number;
    };
    recoveryTime: number; // seconds
    calories: number;
    hrvStatus?: string;
    hrvAverage?: number;
    sleepScore?: number;
    stressScore?: number;
  };
  metrics?: {
    lapCount: number;
    poolLength?: number;
    strokes?: number;
  };
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time: number; // seconds
  distance: number; // meters
  average_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  total_elevation_gain: number; // meters
  workout_type?: number;
  kilojoules?: number;
  average_watts?: number;
  max_watts?: number;
  pr_count?: number;
}

/**
 * Ingest a Garmin activity
 * Stores raw JSON in S3 and structured data in PostgreSQL
 */
export async function ingestGarminActivity(
  userId: string,
  activity: GarminActivity
): Promise<string> {
  const activityId = uuidv4();
  const externalId = activity.summary.activityId.toString();
  const s3Key = `activities/garmin/${activity.summary.startTimeIso.split('T')[0]}/${externalId}.json`;

  // Store raw data in S3
  const putCommand = new PutObjectCommand({
    Bucket: RAW_DATA_BUCKET,
    Key: s3Key,
    Body: JSON.stringify(activity),
    ContentType: 'application/json',
  });

  await s3Client.send(putCommand);

  // Store structured data in PostgreSQL
  await transaction(async (client) => {
    // Check if activity already exists
    const existing = await client.query(
      'SELECT id FROM activities WHERE source = $1 AND external_id = $2',
      ['garmin', externalId]
    );

    if (existing.rows.length > 0) {
      console.log(`Activity ${externalId} already exists, skipping`);
      return existing.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO activities (
        id, user_id, source, external_id, activity_type, activity_name,
        start_time, duration_seconds, distance_meters, avg_pace_sec_per_km,
        avg_heart_rate, max_heart_rate, avg_cadence, elevation_gain_meters,
        elevation_loss_meters, vo2_max_estimate, training_load, aerobic_effect,
        anaerobic_effect, recovery_time_advised, hrv_average, hrv_status,
        sleep_score, stress_score, calories, lap_count, raw_s3_key
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING id
    `;

    await client.query(insertQuery, [
      activityId,
      userId,
      'garmin',
      externalId,
      mapGarminActivityType(activity.summary.activityType),
      activity.summary.activityName || mapGarminActivityType(activity.summary.activityType),
      activity.summary.startTimeIso,
      activity.summary.duration,
      activity.summary.distance,
      activity.summary.avgMovingPace,
      activity.summary.avgHeartRate || null,
      activity.summary.maxHeartRate || null,
      activity.summary.avgCadence || null,
      activity.summary.elevationGain || null,
      activity.summary.elevationLoss || null,
      activity.summary.vo2Max || null,
      activity.summary.trainingLoad || null,
      activity.summary.trainingEffect?.aerobic || null,
      activity.summary.trainingEffect?.anaerobic || null,
      activity.summary.recoveryTime || null,
      activity.summary.hrvAverage || null,
      activity.summary.hrvStatus || null,
      activity.summary.sleepScore || null,
      activity.summary.stressScore || null,
      activity.summary.calories || null,
      activity.metrics?.lapCount || null,
      s3Key,
    ]);

    return activityId;
  });

  console.log(`Ingested Garmin activity ${externalId} for user ${userId}`);
  return activityId;
}

/**
 * Ingest a Strava activity
 */
export async function ingestStravaActivity(
  userId: string,
  activity: StravaActivity
): Promise<string> {
  const activityId = uuidv4();
  const externalId = activity.id.toString();
  const s3Key = `activities/strava/${activity.start_date.split('T')[0]}/${externalId}.json`;

  // Store raw data in S3
  const putCommand = new PutObjectCommand({
    Bucket: RAW_DATA_BUCKET,
    Key: s3Key,
    Body: JSON.stringify(activity),
    ContentType: 'application/json',
  });

  await s3Client.send(putCommand);

  // Store structured data in PostgreSQL
  await transaction(async (client) => {
    // Check if activity already exists
    const existing = await client.query(
      'SELECT id FROM activities WHERE source = $1 AND external_id = $2',
      ['strava', externalId]
    );

    if (existing.rows.length > 0) {
      console.log(`Activity ${externalId} already exists, skipping`);
      return existing.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO activities (
        id, user_id, source, external_id, activity_type, activity_name,
        start_time, duration_seconds, distance_meters, avg_pace_sec_per_km,
        avg_heart_rate, max_heart_rate, avg_cadence, elevation_gain_meters,
        calories, avg_power, max_power, workout_type, raw_s3_key
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING id
    `;

    // Convert m/s to sec/km for pace
    const paceSecPerKm = activity.average_speed > 0
      ? Math.round(1000 / activity.average_speed)
      : null;

    await client.query(insertQuery, [
      activityId,
      userId,
      'strava',
      externalId,
      mapStravaActivityType(activity.type),
      activity.name,
      activity.start_date,
      activity.elapsed_time,
      activity.distance,
      paceSecPerKm,
      activity.average_heartrate || null,
      activity.max_heartrate || null,
      activity.average_cadence || null,
      activity.total_elevation_gain,
      activity.kilojoules ? activity.kilojoules * 1000 : null, // Convert to calories approx
      activity.average_watts || null,
      activity.max_watts || null,
      activity.workout_type ? activity.workout_type.toString() : null,
      s3Key,
    ]);

    return activityId;
  });

  console.log(`Ingested Strava activity ${externalId} for user ${userId}`);
  return activityId;
}

/**
 * Map Garmin activity type to our standard types
 */
function mapGarminActivityType(type: string): string {
  const mapping: Record<string, string> = {
    'running': 'run',
    'treadmill_running': 'run',
    'cycling': 'cycle',
    'indoor_cycling': 'cycle',
    'swimming': 'swim',
    'pool_swimming': 'swim',
    'open_water_swimming': 'swim',
    'walking': 'walk',
    'hiking': 'hike',
    'strength_training': 'strength',
    'yoga': 'yoga',
    'elliptical': 'elliptical',
    'rower': 'row',
    'skiing': 'ski',
    'snowboarding': 'snowboard',
  };
  return mapping[type.toLowerCase()] || type.toLowerCase();
}

/**
 * Map Strava activity type to our standard types
 */
function mapStravaActivityType(type: string): string {
  const mapping: Record<string, string> = {
    'Run': 'run',
    'Trail Run': 'run',
    'Ride': 'cycle',
    'VirtualRide': 'cycle',
    'Swim': 'swim',
    'Walk': 'walk',
    'Hike': 'hike',
    'Workout': 'workout',
    'WeightTraining': 'strength',
    'Yoga': 'yoga',
    'Elliptical': 'elliptical',
    'Rowing': 'row',
    'Snowboard': 'snowboard',
    'Skiing': 'ski',
  };
  return mapping[type] || type.toLowerCase();
}
