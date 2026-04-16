/**
 * Lambda handler for activity ingestion webhooks
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ingestGarminActivity, ingestStravaActivity } from '../services/activity-ingestor';
import { query } from '../config/database';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { httpMethod, body, path } = event;

  try {
    // Parse body
    const data = body ? JSON.parse(body) : {};

    // Log webhook event
    await query(`
      INSERT INTO webhook_events (source, event_type, payload, processed)
      VALUES ($1, $2, $3, true)
    `, [
      path.includes('garmin') ? 'garmin' : 'strava',
      data.event_type || 'activity',
      JSON.stringify(data),
    ]);

    if (path.includes('garmin')) {
      // Garmin webhook
      const activity = data as any;
      const userId = await getUserIdForSource('garmin', activity.summary?.activityId);

      if (!userId) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      const activityId = await ingestGarminActivity(userId, activity);

      // Trigger daily metrics computation
      await computeDailyMetricsForActivity(activity, userId);

      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, activityId }),
      };
    } else if (path.includes('strava')) {
      // Strava webhook
      const { object_type, object_id, aspect_type, owner_id } = data;

      if (object_type !== 'activity' || aspect_type !== 'create') {
        return {
          statusCode: 200,
          body: JSON.stringify({ received: true, skipped: true }),
        };
      }

      const userId = await getUserIdForSource('strava', owner_id.toString());

      if (!userId) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      // Strava webhook only sends ID - need to fetch full activity
      // This would require Strava token lookup and API call
      // For now, acknowledge receipt
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, activityId: object_id }),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Unknown endpoint' }),
    };
  } catch (error) {
    console.error('Ingestion error:', error);

    // Log error
    if (body) {
      const data = JSON.parse(body);
      await query(`
        INSERT INTO webhook_events (source, event_type, payload, processed, error_message)
        VALUES ($1, $2, $3, false, $4)
      `, [
        path.includes('garmin') ? 'garmin' : 'strava',
        data.event_type || 'activity',
        JSON.stringify(data),
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Get user ID for a given source and external ID
 */
async function getUserIdForSource(
  source: string,
  externalId: string
): Promise<string | null> {
  // For now, return the first user - in production, look up by Garmin/Strava user ID
  const result = await query('SELECT id FROM user_profile LIMIT 1');
  return result.rows[0]?.id || null;
}

/**
 * Compute daily metrics after activity ingestion
 */
async function computeDailyMetricsForActivity(activity: any, userId: string): Promise<void> {
  const date = activity.summary?.startTimeIso?.split('T')[0] || new Date().toISOString().split('T')[0];

  // This would call the daily aggregator service
  // For Lambda, we'd invoke another Lambda or use Step Functions
  console.log(`Triggering daily metrics computation for ${userId} on ${date}`);
}
