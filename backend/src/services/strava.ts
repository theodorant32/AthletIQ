/**
 * Strava API Service
 * Official Strava API with OAuth2 authentication
 *
 * Requires app registration at https://developers.strava.com
 */

import { query, transaction } from '../config/database';
import { ingestStravaActivity, StravaActivity } from './activity-ingestor';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI;

interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Generate Strava OAuth authorization URL
 */
export function getStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID || '',
    redirect_uri: STRAVA_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'read,activity:read_all',
  });

  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Strava token exchange failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Refresh expired Strava token
 */
export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Strava token refresh failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Get Strava athlete profile
 */
export async function getStravaAthlete(accessToken: string): Promise<any> {
  const response = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Strava athlete profile');
  }

  return response.json();
}

/**
 * Fetch activities from Strava
 */
export async function fetchStravaActivities(
  accessToken: string,
  page: number = 1,
  perPage: number = 30
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Strava activities');
  }

  const activities = await response.json();

  return activities.map((activity: any) => ({
    id: activity.id,
    name: activity.name,
    type: activity.type,
    start_date: activity.start_date,
    elapsed_time: activity.elapsed_time,
    distance: activity.distance,
    average_speed: activity.average_speed,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate,
    average_cadence: activity.average_cadence,
    total_elevation_gain: activity.total_elevation_gain,
    workout_type: activity.workout_type,
    kilojoules: activity.kilojoules,
    average_watts: activity.average_watts,
    max_watts: activity.max_watts,
    pr_count: activity.pr_count,
  }));
}

/**
 * Sync Strava activities for a user
 */
export async function syncStravaActivities(
  userId: string,
  accessToken: string
): Promise<number> {
  let page = 1;
  let syncedCount = 0;
  let hasMore = true;

  while (hasMore) {
    const activities = await fetchStravaActivities(accessToken, page);

    if (activities.length === 0) {
      hasMore = false;
      break;
    }

    for (const activity of activities) {
      try {
        await ingestStravaActivity(userId, activity);
        syncedCount++;
      } catch (error) {
        console.error(`Failed to ingest Strava activity ${activity.id}:`, error);
      }
    }

    page++;

    // Stop if we got fewer activities than requested (last page)
    if (activities.length < 30) {
      hasMore = false;
    }
  }

  console.log(`Synced ${syncedCount} Strava activities`);
  return syncedCount;
}

/**
 * Get activity streams (detailed data like HR, cadence, power over time)
 */
export async function getStravaActivityStreams(
  accessToken: string,
  activityId: string,
  types: string[] = ['time', 'distance', 'latlng', 'altitude', 'heartrate', 'cadence', 'watts']
): Promise<Record<string, any>> {
  const params = new URLSearchParams({
    keys: types.join(','),
    key_by_type: 'true',
  });

  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}/streams?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch activity streams');
  }

  return response.json();
}

/**
 * Handle Strava webhook subscription callback
 */
export async function handleStravaWebhookChallenge(
  hubMode: string,
  hubToken: string,
  hubChallenge: string,
  hubVerifyToken: string
): Promise<string | null> {
  // Verify the callback
  if (hubMode === 'subscribe' && hubVerifyToken === (process.env.STRAVA_VERIFY_TOKEN || 'athletiq')) {
    return hubChallenge;
  }
  return null;
}

/**
 * Process Strava webhook event
 */
export async function processStravaWebhook(
  userId: string,
  accessToken: string,
  event: {
    object_type: string;
    object_id: number;
    aspect_type: string;
    owner_id: number;
    updates?: Record<string, any>;
  }
): Promise<void> {
  const { object_type, object_id, aspect_type } = event;

  if (object_type !== 'activity') {
    return;
  }

  if (aspect_type === 'create') {
    // New activity created - fetch and ingest it
    try {
      const response = await fetch(`https://www.strava.com/api/v3/activities/${object_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const activity = await response.json();
        await ingestStravaActivity(userId, {
          id: activity.id,
          name: activity.name,
          type: activity.type,
          start_date: activity.start_date,
          elapsed_time: activity.elapsed_time,
          distance: activity.distance,
          average_speed: activity.average_speed,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          average_cadence: activity.average_cadence,
          total_elevation_gain: activity.total_elevation_gain,
          workout_type: activity.workout_type,
          kilojoules: activity.kilojoules,
          average_watts: activity.average_watts,
          max_watts: activity.max_watts,
          pr_count: activity.pr_count,
        });
      }
    } catch (error) {
      console.error('Error processing Strava webhook:', error);
    }
  } else if (aspect_type === 'update') {
    // Activity updated - could re-fetch if needed
    console.log(`Strava activity ${object_id} updated`);
  } else if (aspect_type === 'delete') {
    // Activity deleted - remove from database
    await query('DELETE FROM activities WHERE source = $1 AND external_id = $2', [
      'strava',
      object_id.toString(),
    ]);
  }
}
