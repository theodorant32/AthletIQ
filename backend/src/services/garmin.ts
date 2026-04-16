/**
 * Garmin Connect Service
 * Uses garmin-connect npm package for unofficial API access
 *
 * Note: Garmin doesn't offer an official public API for individuals.
 * This uses the garmin-connect package which authenticates via username/password.
 */

import GarminConnect from 'garmin-connect';
import { query } from '../config/database';
import { ingestGarminActivity, GarminActivity } from './activity-ingestor';

let garminClient: GarminConnect | null = null;

interface GarminCredentials {
  email: string;
  password: string;
}

/**
 * Initialize Garmin connection
 */
export async function connectGarmin(credentials: GarminCredentials): Promise<void> {
  try {
    garminClient = new GarminConnect(credentials.email, credentials.password);
    await garminClient.login();
    console.log('Garmin Connect: Logged in successfully');
  } catch (error) {
    console.error('Garmin Connect: Login failed', error);
    throw new Error('Failed to connect to Garmin');
  }
}

/**
 * Get Garmin client (ensures authenticated)
 */
export async function getGarminClient(): Promise<GarminConnect> {
  if (!garminClient) {
    throw new Error('Garmin not connected. Call connectGarmin() first.');
  }
  return garminClient;
}

/**
 * Fetch activities from Garmin Connect
 * @param startDate - ISO date string
 * @param endDate - ISO date string
 */
export async function fetchGarminActivities(
  startDate: string,
  endDate: string
): Promise<GarminActivity[]> {
  if (!garminClient) {
    throw new Error('Garmin not connected');
  }

  try {
    // Garmin API returns activities in reverse chronological order
    const activities = await garminClient.getActivities({
      startDate: startDate.replace(/-/g, ''),
      endDate: endDate.replace(/-/g, ''),
    });

    return activities.map((activity: any) => ({
      summary: {
        activityId: activity.activityId.toString(),
        activityName: activity.activityName || activity.activityType,
        activityType: activity.activityType,
        startTimeIso: activity.startTimeIso,
        duration: activity.duration || 0,
        distance: activity.distance || 0,
        avgMovingPace: activity.avgMovingPace || 0,
        avgHeartRate: activity.averageHeartRate || 0,
        maxHeartRate: activity.maxHeartRate || 0,
        avgCadence: activity.avgCadence || 0,
        elevationGain: activity.elevationGain || 0,
        elevationLoss: activity.elevationLoss || 0,
        vo2Max: activity.vo2Max || 0,
        trainingLoad: activity.trainingLoad || 0,
        trainingEffect: {
          aerobic: activity.aerobicTrainingEffect || 0,
          anaerobic: activity.anaerobicTrainingEffect || 0,
        },
        recoveryTime: activity.recoveryTime || 0,
        calories: activity.calories || 0,
        hrvStatus: activity.hrvStatus,
        hrvAverage: activity.hrvAverage,
        sleepScore: activity.sleepScore,
        stressScore: activity.stressScore,
      },
      metrics: {
        lapCount: activity.lapCount,
        poolLength: activity.poolLength,
        strokes: activity.strokes,
      },
    }));
  } catch (error) {
    console.error('Error fetching Garmin activities:', error);

    // Re-authenticate if session expired
    if (error instanceof Error && error.message.includes('authentication')) {
      console.log('Re-authenticating with Garmin...');
      // Would need to re-login here
    }

    throw error;
  }
}

/**
 * Sync all Garmin activities since last sync
 */
export async function syncGarminActivities(userId: string): Promise<number> {
  if (!garminClient) {
    throw new Error('Garmin not connected');
  }

  // Get last sync date
  const lastSyncResult = await query(`
    SELECT MAX(created_at) as last_sync FROM activities
    WHERE user_id = $1 AND source = 'garmin'
  `, [userId]);

  const lastSync = lastSyncResult.rows[0]?.last_sync;
  const startDate = lastSync
    ? new Date(lastSync).toISOString().split('T')[0]
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default 30 days
  const endDate = new Date().toISOString().split('T')[0];

  console.log(`Syncing Garmin activities from ${startDate} to ${endDate}`);

  const activities = await fetchGarminActivities(startDate, endDate);
  let syncedCount = 0;

  for (const activity of activities) {
    try {
      await ingestGarminActivity(userId, activity);
      syncedCount++;
    } catch (error) {
      console.error(`Failed to ingest activity ${activity.summary.activityId}:`, error);
    }
  }

  console.log(`Synced ${syncedCount} Garmin activities`);
  return syncedCount;
}

/**
 * Get activity details including GPS track
 */
export async function getGarminActivityDetails(activityId: string): Promise<any> {
  if (!garminClient) {
    throw new Error('Garmin not connected');
  }

  try {
    const details = await garminClient.getActivityDetails(activityId);
    const track = await garminClient.getActivityTrack(activityId);

    return {
      details,
      track,
    };
  } catch (error) {
    console.error('Error fetching Garmin activity details:', error);
    throw error;
  }
}

/**
 * Get daily HRV status from Garmin
 */
export async function getGarminHRVStatus(date: string): Promise<{
  hrvAverage: number;
  hrvStatus: string;
} | null> {
  if (!garminClient) {
    throw new Error('Garmin not connected');
  }

  try {
    const hrvData = await garminClient.getHrvData(date.replace(/-/g, ''));

    if (!hrvData || !hrvData.hrvData || hrvData.hrvData.length === 0) {
      return null;
    }

    const dailyHrv = hrvData.hrvData[0];
    return {
      hrvAverage: dailyHrv.hrvValue,
      hrvStatus: dailyHrv.hrvStatus || 'balanced',
    };
  } catch (error) {
    console.error('Error fetching HRV data:', error);
    return null;
  }
}
