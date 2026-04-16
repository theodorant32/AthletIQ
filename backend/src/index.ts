import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { query } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Webhook routes
app.post('/webhooks/garmin', async (req: Request, res: Response) => {
  console.log('Garmin webhook received:', req.body);
  // TODO: Implement Garmin webhook handler
  res.json({ received: true });
});

app.post('/webhooks/strava', async (req: Request, res: Response) => {
  console.log('Strava webhook received:', req.body);
  // TODO: Implement Strava webhook handler
  res.json({ received: true });
});

// API routes
app.get('/api/today', async (req: Request, res: Response) => {
  try {
    // Get today's workout and recovery status
    const today = new Date().toISOString().split('T')[0];

    const [dailyMetrics, trainingPlan] = await Promise.all([
      query(`
        SELECT * FROM daily_metrics
        WHERE date = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [today]),
      query(`
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
      `, [today])
    ]);

    res.json({
      date: today,
      recovery: dailyMetrics.rows[0]?.recovery_status || 'unknown',
      ctl: dailyMetrics.rows[0]?.ctl_score || null,
      tsb: dailyMetrics.rows[0]?.tsb_score || null,
      workout: trainingPlan.rows[0] || null,
    });
  } catch (error) {
    console.error('Error fetching today data:', error);
    res.status(500).json({ error: 'Failed to fetch today data' });
  }
});

app.get('/api/metrics', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const result = await query(`
      SELECT
        date,
        ctl_score,
        atl_score,
        tsb_score,
        total_distance_meters,
        avg_heart_rate,
        recovery_status
      FROM daily_metrics
      WHERE date >= NOW() - INTERVAL '${parseInt(days as string)} days'
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
    const { week } = req.query;
    let weekStart = week as string;

    if (!weekStart) {
      // Get current week's Monday
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0];
    }

    const result = await query(`
      SELECT * FROM training_plan
      WHERE week_start_date = $1
      ORDER BY scheduled_date
    `, [weekStart]);

    res.json({
      weekStart,
      workouts: result.rows
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

app.get('/api/insights', async (req: Request, res: Response) => {
  try {
    const result = await query(`
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
    // TODO: Implement chatbot with Anthropic
    res.json({
      response: 'Chatbot coming soon. Ask me about your training!'
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🏃 AthletIQ backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

export default app;
