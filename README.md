# AthletIQ

Personal athletic intelligence platform that ingests Garmin/Strava data and generates adaptive training plans.

## What It Does

- Syncs activities from Garmin Connect and Strava
- Computes fitness metrics (CTL, ATL, TSB) using training load data
- Predicts race times for half/full marathon
- Detects overtraining risk from HRV and recovery data
- Generates weekly training plans that adapt to your performance
- Sends daily SMS recovery status and weekly email summaries

## Quick Start

```bash
# Start local database
docker-compose up -d

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run migrations
cd backend && npm run db:migrate

# Start dev servers
cd backend && npm run dev  # http://localhost:4000
cd ../frontend && npm run dev  # http://localhost:3001
```

## Stack

- **Backend:** Node.js + TypeScript (Express)
- **Frontend:** Next.js 14 + TailwindCSS
- **ML:** Python (XGBoost, scikit-learn)
- **Database:** PostgreSQL (AWS RDS)
- **Cloud:** AWS Lambda, API Gateway, S3, EventBridge, SNS, SES
- **IaC:** AWS CDK

## AWS Deployment

```bash
cd infrastructure
npm install
npx cdk bootstrap
npx cdk deploy
```

Runs on AWS free tier for 12 months.

## License

MIT
