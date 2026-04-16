# API Reference

## Authentication

### Strava OAuth
```
GET /auth/strava
```
Redirects to Strava authorization page.

### Strava Callback
```
GET /auth/strava/callback?code={authorization_code}
```

### Garmin Connect
```
POST /auth/garmin
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "your-password"
}
```

---

## Webhooks

### Garmin Webhook
```
POST /webhooks/garmin
Content-Type: application/json

{
  "summary": {
    "activityId": "12345",
    "activityType": "running",
    "startTimeIso": "2024-03-15T07:00:00Z",
    "duration": 3600,
    "distance": 10000,
    "avgMovingPace": 360,
    "avgHeartRate": 155,
    "maxHeartRate": 175,
    "vo2Max": 52,
    "trainingLoad": 120,
    "trainingEffect": {
      "aerobic": 3.5,
      "anaerobic": 1.2
    },
    "recoveryTime": 48,
    "hrvAverage": 62,
    "hrvStatus": "balanced"
  }
}
```

### Strava Webhook
```
POST /webhooks/strava
Content-Type: application/json

{
  "object_type": "activity",
  "object_id": 12345678,
  "aspect_type": "create",
  "owner_id": 87654321,
  "event_time": 1710500000
}
```

---

## Data Endpoints

### Today's Data
```
GET /api/today

Response:
{
  "date": "2024-03-15",
  "recovery": "green",
  "ctl": 65,
  "tsb": 15,
  "workout": {
    "workout_type": "long_run",
    "target_distance_meters": 16000,
    "target_hr_zone": 2,
    "purpose": "Build aerobic endurance"
  }
}
```

### Metrics (Time Series)
```
GET /api/metrics?days=30

Response:
{
  "metrics": [
    {
      "date": "2024-03-15",
      "ctl_score": 65.2,
      "atl_score": 48.5,
      "tsb_score": 16.7,
      "total_distance_meters": 12000,
      "avg_heart_rate": 148,
      "recovery_status": "green"
    }
  ]
}
```

### Training Plan
```
GET /api/plan?week=2024-03-11

Response:
{
  "weekStart": "2024-03-11",
  "workouts": [
    {
      "id": "uuid",
      "workout_type": "long_run",
      "scheduled_date": "2024-03-17",
      "target_distance_meters": 16000,
      "target_hr_zone": 2,
      "purpose": "Build endurance",
      "status": "scheduled"
    }
  ]
}
```

### Insights
```
GET /api/insights

Response:
{
  "insights": [
    {
      "id": "uuid",
      "insight_type": "performance",
      "title": "Best training week in 4 weeks",
      "description": "Your CTL increased by 8 points this week",
      "severity": "low",
      "created_at": "2024-03-15T10:00:00Z"
    }
  ]
}
```

---

## AI Chatbot

### Chat
```
POST /api/chat
Content-Type: application/json

{
  "message": "Am I on track for a sub-2 hour half marathon?"
}

Response:
{
  "response": "Based on your current fitness (CTL: 65) and recent long run pace of 5:45/km, you're projected to finish in 2:03-2:06. To hit sub-2:00, you'd need to average 5:41/km. Your training looks solid - focus on threshold work to close the gap."
}
```

---

## Sync

### Manual Garmin Sync
```
POST /sync/garmin

Response:
{
  "synced": 5
}
```
