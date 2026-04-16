import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { executeQuery } from './config/database';
import { chat } from './services/chatbot';
import {
  getStravaAuthUrl,
  exchangeStravaCode,
  handleStravaWebhookChallenge,
} from './services/strava';
import { connectGarmin, syncGarminActivities } from './services/garmin';
import { ingestGarminActivity, ingestStravaActivity } from './services/activity-ingestor';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await executeQuery('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

// ==================== Authentication ====================

app.get('/auth/strava', (_req: Request, res: Response) => {
  const authUrl = getStravaAuthUrl();
  res.redirect(authUrl);
});

app.get('/auth/strava/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const tokens = await exchangeStravaCode(code);

    // TODO: Store tokens in user_profile and associate with authenticated user
    res.json({
      message: 'Strava connected successfully',
      expiresAt: tokens.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Strava auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Strava' });
  }
});

app.post('/auth/garmin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    await connectGarmin({ email, password });
    res.json({ message: 'Garmin connected successfully' });
  } catch (error) {
    console.error('Garmin auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Garmin' });
  }
});

// ==================== Webhooks ====================

app.post('/webhooks/garmin', async (req: Request, res: Response) => {
  try {
    console.log('Garmin webhook received');

    // TODO: Implement Garmin signature validation
    const activity = req.body;
    const userId = await resolveUserId('garmin', activity.summary?.ownerId);

    if (!userId) {
      return res.status(401).json({ error: 'User not found for this Garmin account' });
    }

    const activityId = await ingestGarminActivity(userId, activity);
    res.json({ received: true, activityId });
  } catch (error) {
    console.error('Garmin webhook error:', error);
    res.status(500).json({ error: 'Failed to process Garmin webhook' });
  }
});

app.post('/webhooks/strava', async (req: Request, res: Response) => {
  try {
    const { 'hub.mode': hubMode, 'hub.verify.token': hubToken, 'hub.challenge': hubChallenge } = req.query;

    // Handle Strava subscription challenge
    if (hubMode && typeof hubMode === 'string') {
      const challenge = handleStravaWebhookChallenge(
        hubMode,
        (hubToken as string) || '',
        (hubChallenge as string) || '',
        process.env.STRAVA_VERIFY_TOKEN || 'athletiq'
      );

      if (challenge) {
        return res.send(challenge);
      }
      return res.status(403).send('Forbidden');
    }

    const event = req.body as Record<string, unknown>;
    const userId = await resolveUserId('strava', String(event.owner_id));

    if (!userId) {
      return res.status(401).json({ error: 'User not found for this Strava account' });
    }

    // TODO: Fetch full activity data from Strava API for 'create' events
    console.log('Strava webhook received:', { type: event.object_type, id: event.object_id });

    res.json({ received: true, eventId: event.object_id });
  } catch (error) {
    console.error('Strava webhook error:', error);
    res.status(500).json({ error: 'Failed to process Strava webhook' });
  }
});

// ==================== Sync Endpoints ====================

app.post('/sync/garmin', async (req: Request, res: Response) => {
  try {
    const userId = await requireAuth(req);
    const count = await syncGarminActivities(userId);
    res.json({ synced: count });
  } catch (error) {
    console.error('Garmin sync error:', error);
    res.status(500).json({ error: 'Failed to sync Garmin activities' });
  }
});

// ==================== Data API ====================

app.get('/api/today', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [metricsResult, planResult] = await Promise.all([
      executeQuery(`
        SELECT date, recovery_status, ctl_score, atl_score, tsb_score
        FROM daily_metrics
        WHERE date = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [today]),

      executeQuery(`
        SELECT * FROM training_plan
        WHERE scheduled_date = $1
          AND status = 'scheduled'
        ORDER BY
          CASE workout_type
            WHEN 'long_run' THEN 1
            WHEN 'tempo' THEN 2
            WHEN 'intervals' THEN 3
            WHEN 'recovery' THEN 4
            WHEN 'rest' THEN 5
          END
        LIMIT 1
      `, [today]),
    ]);

    res.json({
      date: today,
      recovery: metricsResult.rows[0]?.recovery_status || 'unknown',
      ctl: metricsResult.rows[0]?.ctl_score || null,
      atl: metricsResult.rows[0]?.atl_score || null,
      tsb: metricsResult.rows[0]?.tsb_score || null,
      workout: planResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Error fetching today data:', error);
    res.status(500).json({ error: 'Failed to fetch today data' });
  }
});

app.get('/api/metrics', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days || '30';
    const days = parseInt(daysParam as string, 10);

    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365' });
    }

    const result = await executeQuery(`
      SELECT
        date,
        ctl_score,
        atl_score,
        tsb_score,
        total_distance_meters,
        avg_heart_rate,
        recovery_status
      FROM daily_metrics
      WHERE date >= NOW() - INTERVAL '${days} days'
      ORDER BY date ASC
    `);

    res.json({ metrics: result.rows });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.get('/api/plan', async (req: Request, res: Response) => {
  try {
    let weekStart = (req.query.week as string) || getCurrentWeekStart();

    const result = await executeQuery(`
      SELECT * FROM training_plan
      WHERE week_start_date = $1
      ORDER BY scheduled_date
    `, [weekStart]);

    res.json({
      weekStart,
      workouts: result.rows,
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

app.get('/api/insights', async (_req: Request, res: Response) => {
  try {
    const result = await executeQuery(`
      SELECT * FROM insights
      WHERE is_read = false
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({ insights: result.rows });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userId = await resolveUserIdFromSession(req);
    const response = await chat(userId, message);

    res.json({ response });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

// ==================== Error Handling ====================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ==================== Server Startup ====================

app.listen(PORT, () => {
  console.log(`AthletIQ backend running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
});

// ==================== Helper Functions ====================

/**
 * Resolve user ID from external provider ID
 */
async function resolveUserId(source: 'garmin' | 'strava', externalId: string): Promise<string | null> {
  // TODO: Implement proper user lookup from user_profile
  // For now, return a placeholder
  console.log('Resolving user for', { source, externalId });
  return 'sample-user-id';
}

/**
 * Get current week start (Monday)
 */
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

/**
 * Placeholder for authentication middleware
 */
async function requireAuth(_req: Request): Promise<string> {
  // TODO: Implement JWT-based authentication
  return 'sample-user-id';
}

/**
 * Placeholder for session-based user resolution
 */
async function resolveUserIdFromSession(_req: Request): Promise<string> {
  // TODO: Implement session-based auth
  return 'sample-user-id';
}

export default app;
