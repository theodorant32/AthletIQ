/**
 * Lambda handler for daily metrics aggregation
 * Triggered by EventBridge daily at 6 AM
 */

import { Context } from 'aws-lambda';
import { computeDailyMetrics, backfillDailyMetrics } from '../services/daily-aggregator';
import { query } from '../config/database';

export async function handler(event: any, context: Context): Promise<void> {
  console.log('Starting daily aggregation...');

  try {
    // Get all users
    const usersResult = await query('SELECT id FROM user_profile');
    const users = usersResult.rows.map((r: any) => r.id);

    // Use yesterday's date (activities from completed day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`Computing metrics for ${users.length} users on ${dateStr}`);

    for (const userId of users) {
      try {
        await computeDailyMetrics({ user_id: userId, date: dateStr });
        console.log(`Completed daily metrics for user ${userId}`);
      } catch (error) {
        console.error(`Error computing metrics for user ${userId}:`, error);
      }
    }

    console.log('Daily aggregation completed');
  } catch (error) {
    console.error('Daily aggregation failed:', error);
    throw error;
  }
}
