# AthletIQ Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ATHLETIQ SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DATA SOURCES              CLOUD LAYER              APPLICATION         │
│  ───────────              ───────────              ───────────         │
│                                                                         │
│  ┌──────────────┐         ┌──────────────┐        ┌──────────────┐     │
│  │   Garmin     │────────▶│   API        │───────▶│   Backend    │     │
│  │   Connect    │         │   Gateway    │        │   (Lambda)   │     │
│  └──────────────┘         └──────────────┘        └──────┬───────┘     │
│                                                          │              │
│  ┌──────────────┐         ┌──────────────┐              ▼              │
│  │   Strava     │────────▶│   Webhook    │        ┌──────────────┐     │
│  │   API        │         │   Processor  │        │   RDS        │     │
│  └──────────────┘         └──────────────┘        │   (PostgreSQL)│    │
│                                                   └──────┬───────┘     │
│                                                          │              │
│                    ┌──────────────┐                     │              │
│                    │   S3         │◀────────────────────┘              │
│                    │   (Raw JSON) │                                    │
│                    └──────────────┘                                    │
│                                                                         │
│  SCHEDULED JOBS (EventBridge)                                           │
│  ──────────────────────────────                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Daily 6AM       │  │ Monday 7AM      │  │ Sunday 8PM      │         │
│  │ Aggregation     │  │ Plan Update     │  │ Email Summary   │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  ML PIPELINE                                                            │
│  ───────────                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Race         │  │ Overtraining │  │ Plan         │                  │
│  │ Predictor    │  │ Detector     │  │ Generator    │                  │
│  │ (XGBoost)    │  │ (Isolation   │  │ (Rule-based) │                  │
│  │              │  │  Forest)     │  │              │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│  ALERTS                      FRONTEND                                   │
│  ────────                  ──────────                                   │
│  ┌──────────────┐          ┌──────────────┐                            │
│  │ SNS (SMS)    │          │ Next.js      │                            │
│  │ Daily status │          │ Dashboard    │                            │
│  └──────────────┘          └──────────────┘                            │
│  ┌──────────────┐          ┌──────────────┐                            │
│  │ SES (Email)  │          │ AI Chatbot   │                            │
│  │ Weekly wrap  │          │ (Claude API) │                            │
│  └──────────────┘          └──────────────┘                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Activity Ingestion

```
Garmin Watch → Garmin Connect → Webhook → API Gateway
                                           ↓
                                      Lambda (ingestion)
                                           ↓
                    ┌──────────────────────┴──────────────────────┐
                    ↓                                              ↓
              S3 (raw JSON)                              RDS PostgreSQL
              activities/garmin/                         activities table
              2024-03-15/12345.json
```

### 2. Daily Metrics Computation

```
EventBridge (6 AM UTC) → Lambda (daily aggregation)
                               ↓
                         Read activities (last 42 days)
                               ↓
                         Calculate:
                         - CTL (42-day EMA of training load)
                         - ATL (7-day EMA)
                         - TSB (CTL - ATL)
                               ↓
                         Store in daily_metrics table
```

### 3. Weekly Plan Generation

```
EventBridge (Monday 7 AM) → Lambda (plan update)
                                 ↓
                           Get user's race goal
                           Get last week's completion rate
                           Get current recovery status
                                 ↓
                           Determine training phase
                           Calculate plan modifier
                                 ↓
                           Generate workouts for week
                                 ↓
                           Store in training_plan table
```

### 4. Race Prediction

```
User opens dashboard → API fetches metrics
                            ↓
                      Get latest:
                      - VO2 max
                      - CTL/ATL/TSB
                      - Recent pace data
                            ↓
                      Load XGBoost model from S3
                            ↓
                      Predict race time
                      Calculate confidence interval
                            ↓
                      Return prediction to frontend
```

## Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_profile` | User settings, API tokens | `garmin_user_id`, `strava_user_id` |
| `activities` | Raw activity data | `source`, `external_id`, `start_time`, `distance`, `hr` |
| `daily_metrics` | Aggregated daily stats | `date`, `ctl_score`, `atl_score`, `tsb_score` |
| `training_plan` | Scheduled workouts | `workout_type`, `scheduled_date`, `target_pace` |
| `race_goals` | Target races | `race_type`, `target_date`, `predicted_time` |
| `weekly_plans` | Weekly plan summary | `week_start_date`, `phase`, `plan_json` |
| `model_predictions` | ML output cache | `model_type`, `prediction_date`, `output_data` |
| `insights` | Generated insights | `insight_type`, `title`, `severity` |
| `chat_messages` | AI conversation history | `role`, `content`, `context_data` |
| `alerts` | Sent notifications | `alert_type`, `channel`, `status` |

## API Endpoints

### Authentication
- `GET /auth/strava` - Redirect to Strava OAuth
- `GET /auth/strava/callback` - OAuth callback
- `POST /auth/garmin` - Connect Garmin (username/password)

### Webhooks
- `POST /webhooks/garmin` - Garmin activity webhook
- `POST /webhooks/strava` - Strava activity webhook

### Data
- `GET /api/today` - Today's workout + recovery
- `GET /api/metrics` - Time-series metrics (CTL, ATL, TSB)
- `GET /api/plan` - Weekly training plan
- `GET /api/insights` - AI-generated insights
- `POST /api/chat` - AI coach chat

### Sync
- `POST /sync/garmin` - Manual Garmin sync

## ML Models

### Race Time Predictor
- **Algorithm:** XGBoost Regressor
- **Features:** VO2 max, CTL, ATL, TSB, recent pace, weekly mileage
- **Output:** Predicted time (seconds) + confidence interval
- **Retraining:** Weekly via EventBridge

### Overtraining Detector
- **Algorithm:** Isolation Forest (anomaly detection)
- **Features:** HRV trend, RHR deviation, TSB, sleep score, training load
- **Output:** Risk score (0-100) + status (green/yellow/red)
- **Retraining:** Weekly

### Plan Generator
- **Algorithm:** Rule-based engine with ML scoring
- **Logic:** Adjusts volume/intensity based on completion rate and recovery
- **Phases:** Base → Build → Peak → Taper

## Infrastructure (AWS)

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Lambda | Compute (ingestion, aggregation, plan generation) | 1M requests/month |
| API Gateway | Webhook endpoints, REST API | 1M requests/month |
| RDS PostgreSQL | Structured athletic data | 750 hrs, 20GB |
| S3 | Raw activity JSON, model artifacts | 5GB |
| EventBridge | Scheduled jobs (daily, weekly) | 1M events/month |
| SNS | SMS alerts | 1M publishes/month |
| SES | Email summaries | 62K emails/month |
| CloudWatch | Logs, metrics, alarms | 10GB logs |

## Security

- All API endpoints require authentication (JWT)
- AWS credentials via IAM roles (not environment variables in production)
- Database credentials stored in AWS Secrets Manager
- HTTPS enforced for all endpoints
- Webhook signatures validated

## Monitoring

- CloudWatch Logs for all Lambda functions
- Custom metrics: activities ingested, pipeline success rate
- Alarms: Lambda errors, RDS CPU, S3 bucket size
- Dashboard: Real-time system health
