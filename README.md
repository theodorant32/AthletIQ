# AthletIQ

Personal athletic intelligence platform that ingests Garmin/Strava data and generates adaptive training plans.

## What It Does

- Syncs activities from Garmin Connect and Strava
- Computes fitness metrics (CTL, ATL, TSB) using training load data
- Predicts race times for half/full marathon
- Detects overtraining risk from HRV and recovery data
- Generates weekly training plans that adapt to your performance
- Sends daily SMS recovery status and weekly email summaries

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + TypeScript (Express) |
| Frontend | Next.js 14 + TailwindCSS |
| ML | Python (XGBoost, scikit-learn) |
| Database | PostgreSQL (AWS RDS) |
| Cloud | AWS Lambda, API Gateway, S3, EventBridge, SNS, SES |
| IaC | AWS CDK |

## Quick Start

```bash
# Start local database
docker-compose up -d

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../ml-pipeline && pip install -r requirements.txt

# Run migrations
cd ../backend && npm run db:migrate

# Start dev servers
cd .. && npm run dev  # backend
cd frontend && npm run dev  # frontend
```

Backend: http://localhost:4000  
Frontend: http://localhost:3001

## Project Structure

```
athletiq/
├── backend/        # Express API, webhooks, data ingestion
├── frontend/       # Next.js dashboard
├── ml-pipeline/    # Python ML models
├── infrastructure/ # AWS CDK stacks
└── scripts/        # Setup and utility scripts
```

## AWS Deployment

```bash
cd infrastructure
npm install
npx cdk bootstrap
npx cdk deploy
```

Runs on AWS free tier for 12 months (~$20-50/month after).

## License

MIT
