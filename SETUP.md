# Setup Guide

## Quick Start (5 minutes)

### 1. Start Database
```bash
docker-compose up -d
```

### 2. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../ml-pipeline && pip install -r requirements.txt
```

### 3. Configure Environment
Edit `backend/.env`:
- Add your Strava credentials (from https://www.strava.com/settings/api)
- Add your Anthropic API key (from https://console.anthropic.com) - optional for chatbot

### 4. Run Migrations + Seed
```bash
cd backend
npm run db:migrate
npm run db:seed
```

### 5. Start Dev Servers
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Open http://localhost:3001

---

## Before Your Garmin Arrives

### Set Up Strava (Optional)
1. Go to https://www.strava.com/settings/api
2. Create application:
   - Name: AthletIQ
   - Callback: `http://localhost:3001/auth/strava/callback`
3. Copy Client ID and Secret to `backend/.env`

### Get Anthropic API Key (Optional)
For the AI chatbot:
1. Go to https://console.anthropic.com
2. Create API key
3. Add to `backend/.env`

### Load Test Data
The seed script creates 30 days of sample activities so you can see the dashboard populated.

---

## When Your Garmin Arrives

### Option A: Manual Sync (Recommended)
1. Add your Garmin credentials to `backend/.env`:
   ```
   GARMIN_EMAIL=your@email.com
   GARMIN_PASSWORD=your-password
   ```
2. Restart backend
3. Go to Settings page and connect Garmin
4. Click "Sync Now" to pull all activities

### Option B: Webhook (Advanced)
Garmin doesn't support official webhooks for individuals. The manual sync runs on-demand.

---

## AWS Deployment (Later)

```bash
# Configure AWS CLI
aws configure

# Deploy infrastructure
cd infrastructure
npm install
npx cdk bootstrap
npx cdk deploy

# This creates:
# - RDS PostgreSQL (free tier: 750 hrs/month, 20GB)
# - Lambda functions (free tier: 1M requests/month)
# - S3 buckets (free tier: 5GB)
# - API Gateway, SNS, SES, EventBridge
```

---

## Troubleshooting

**Database connection failed:**
```bash
docker-compose down
docker-compose up -d
```

**Port already in use:**
Change `PORT` in `backend/.env` or kill the process:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

**Seed script fails:**
Drop and recreate database:
```bash
docker-compose down -v
docker-compose up -d
npm run db:migrate
npm run db:seed
```
