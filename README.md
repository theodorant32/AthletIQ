# AthletIQ

Personal athletic intelligence platform that ingests Garmin/Strava data, computes fitness metrics, and generates adaptive training plans.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Garmin/Strava │────▶│  API Gateway     │────▶│   Lambda        │
│   (webhooks)    │     │  (REST)          │     │   (Node.js)     │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   SNS/SES       │◀────│   EventBridge    │◀────│   RDS           │
│   (alerts)      │     │   (scheduled)    │     │   (PostgreSQL)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         ▲
         │
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │◀────│   S3             │◀────│   ML Pipeline   │
│   (Next.js)     │     │   (raw data)     │     │   (Python)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Key Features

| Feature | Implementation |
|---------|---------------|
| Fitness Metrics | CTL/ATL/TSB via exponential moving averages |
| Race Prediction | XGBoost regressor (half/full marathon) |
| Overtraining Detection | Isolation Forest anomaly detection |
| Training Plans | Phase-based periodization (Base→Build→Peak→Taper) |
| Recovery Status | TSB + HRV-based daily readiness |

## Quick Start

```bash
# Start local database
docker-compose up -d

# Install dependencies
npm install --prefix backend && npm install --prefix frontend

# Run migrations
npm run db:migrate --prefix backend

# Start dev servers
npm run dev --prefix backend & npm run dev --prefix frontend
```

Visit `http://localhost:3001`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/today` | Today's recovery + workout |
| GET | `/api/metrics?days=30` | Historical CTL/ATL/TSB |
| GET | `/api/plan` | Current week's training plan |
| POST | `/api/chat` | AI coach conversation |
| GET | `/api/insights` | Generated insights |
| POST | `/webhooks/strava` | Strava activity updates |

## AWS Infrastructure

Deployed via CDK (Free Tier optimized):

- **Lambda**: 128MB, 30s timeout
- **RDS**: db.t3.micro, 20GB storage
- **API Gateway**: HTTP API (cheaper than REST)
- **S3**: Intelligent-Tiering for raw activity data

```bash
cd infrastructure
npx cdk deploy
```

## Tech Stack

- **Frontend**: Next.js 14 App Router, TailwindCSS, TanStack Query
- **Backend**: Node.js, TypeScript, Express, pg
- **ML**: Python, XGBoost, scikit-learn
- **Database**: PostgreSQL 15
- **Cloud**: AWS Lambda, RDS, S3, EventBridge, SNS, SES
- **IaC**: AWS CDK (TypeScript)

## License

MIT
