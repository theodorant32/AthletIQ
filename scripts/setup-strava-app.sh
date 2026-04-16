#!/bin/bash
# Helper script to document Strava app setup

cat << 'EOF'
========================================
  Strava API App Setup
========================================

1. Go to https://www.strava.com/settings/api

2. Create a new application:
   - Application Name: AthletIQ
   - Category: Training
   - Club: (leave blank)
   - Website: https://athletiq.com (or your domain)
   - Authorization Callback Domain: localhost

3. After creating, note:
   - Client ID: XXXXX
   - Client Secret: XXXXXXXXXXXXXXXXXXXXXXXX

4. Set up webhook subscription:
   - Go to https://www.strava.com/settings/api
   - Under "Webhooks", click "Create Subscription"
   - Callback URL: https://YOUR-API-GATEWAY/webhooks/strava
   - Verify Token: athletiq (or your own)
   - Subscribe to: activities (create, update, delete)

5. Update .env file:
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback
   STRAVA_VERIFY_TOKEN=athletiq

========================================
  Garmin Connect Notes
========================================

Garmin doesn't have an official public API for individuals.
This project uses the garmin-connect npm package which:
- Authenticates via username/password
- Requires valid Garmin account
- May break if Garmin changes their API

For production use, consider:
- Garmin Connect IQ app with webhook support
- Third-party sync service (Tapiriik, etc.)

========================================
EOF
