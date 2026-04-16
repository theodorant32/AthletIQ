-- AthletIQ Initial Schema
-- Creates all core tables for activity tracking, metrics, training plans, and user data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profile table
CREATE TABLE user_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    garmin_user_id VARCHAR(255),
    strava_user_id VARCHAR(255),
    garmin_auth_token TEXT,
    strava_access_token TEXT,
    strava_refresh_token TEXT,
    strava_token_expires_at TIMESTAMP,
    weight_kg DECIMAL(5,2),
    height_cm INTEGER,
    date_of_birth DATE,
    gender VARCHAR(20),
    max_heart_rate INTEGER,
    resting_heart_rate INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Race goals table
CREATE TABLE race_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    race_name VARCHAR(255) NOT NULL,
    race_type VARCHAR(50) NOT NULL, -- '5k', '10k', 'half_marathon', 'marathon', 'triathlon'
    target_date DATE NOT NULL,
    target_time_seconds INTEGER,
    predicted_time_seconds INTEGER,
    confidence_interval_lower INTEGER,
    confidence_interval_upper INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Raw activities table (structured data from Garmin/Strava)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    source VARCHAR(20) NOT NULL, -- 'garmin' or 'strava'
    external_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'run', 'cycle', 'swim', 'walk', etc.
    activity_name VARCHAR(500),
    start_time TIMESTAMP NOT NULL,
    duration_seconds INTEGER NOT NULL,
    distance_meters INTEGER,
    avg_pace_sec_per_km INTEGER,
    max_pace_sec_per_km INTEGER,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    avg_cadence INTEGER,
    max_cadence INTEGER,
    elevation_gain_meters INTEGER,
    elevation_loss_meters INTEGER,
    vo2_max_estimate DECIMAL(5,2),
    training_load INTEGER,
    aerobic_effect INTEGER,
    anaerobic_effect INTEGER,
    recovery_time_advised INTEGER,
    hrv_average DECIMAL(10,2),
    hrv_status VARCHAR(20), -- 'balanced', 'unbalanced', 'poor'
    sleep_score INTEGER,
    stress_score INTEGER,
    calories INTEGER,
    avg_power INTEGER,
    max_power INTEGER,
    normalized_power INTEGER,
    intensity_factor DECIMAL(5,4),
    variability_index DECIMAL(5,4),
    kilojoules INTEGER,
    workout_type VARCHAR(50),
    lap_count INTEGER,
    pool_length INTEGER,
    strokes INTEGER,
    swolf_score INTEGER,
    raw_s3_key VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source, external_id)
);

-- GPS track points for activities
CREATE TABLE activity_gps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    elevation_meters INTEGER,
    distance_from_start_meters INTEGER,
    pace_sec_per_km INTEGER,
    heart_rate INTEGER,
    cadence INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Daily aggregated metrics (computed by pipeline)
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    date DATE NOT NULL,
    total_activities INTEGER DEFAULT 0,
    total_distance_meters INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    total_elevation_gain_meters INTEGER DEFAULT 0,
    total_calories INTEGER DEFAULT 0,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    ctl_score DECIMAL(10,2), -- Chronic Training Load (42-day)
    atl_score DECIMAL(10,2), -- Acute Training Load (7-day)
    tsb_score DECIMAL(10,2), -- Training Stress Balance (CTL - ATL)
    hrv_average DECIMAL(10,2),
    hrv_status VARCHAR(20),
    resting_heart_rate INTEGER,
    sleep_hours DECIMAL(4,2),
    sleep_score INTEGER,
    recovery_status VARCHAR(20), -- 'green', 'yellow', 'red'
    training_load_sum INTEGER,
    aerobic_effect_sum INTEGER,
    anaerobic_effect_sum INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Training plan table
CREATE TABLE training_plan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    week_start_date DATE NOT NULL,
    workout_type VARCHAR(50) NOT NULL, -- 'long_run', 'tempo', 'intervals', 'recovery', 'rest', 'cross_train'
    scheduled_date DATE NOT NULL,
    target_distance_meters INTEGER,
    target_duration_seconds INTEGER,
    target_pace_min_sec_per_km INTEGER,
    target_pace_max_sec_per_km INTEGER,
    target_hr_zone INTEGER, -- 1-5
    target_power_min INTEGER,
    target_power_max INTEGER,
    purpose TEXT,
    instructions TEXT,
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'skipped', 'modified'
    actual_activity_id UUID REFERENCES activities(id),
    completion_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Weekly plan summary
CREATE TABLE weekly_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    week_start_date DATE NOT NULL UNIQUE,
    phase VARCHAR(50), -- 'base', 'build', 'peak', 'taper', 'recovery'
    target_mileage_km DECIMAL(10,2),
    target_workouts INTEGER,
    focus TEXT,
    plan_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Model predictions and outputs
CREATE TABLE model_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    model_type VARCHAR(50) NOT NULL, -- 'race_predictor', 'overtraining_detector', 'plan_generator'
    prediction_date DATE NOT NULL,
    input_features JSONB,
    output_data JSONB,
    confidence_score DECIMAL(5,4),
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insights generated by the system
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    insight_type VARCHAR(50) NOT NULL, -- 'performance', 'recovery', 'trend', 'recommendation'
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20), -- 'low', 'medium', 'high'
    is_read BOOLEAN DEFAULT false,
    related_activity_id UUID REFERENCES activities(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat conversation history
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    context_data JSONB, -- Metrics/context sent to AI
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts sent to user
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profile(id),
    alert_type VARCHAR(50) NOT NULL, -- 'sms', 'email', 'push'
    channel VARCHAR(50) NOT NULL, -- 'sns', 'ses', 'firebase'
    subject VARCHAR(500),
    body TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook events log
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(20) NOT NULL, -- 'garmin', 'strava'
    event_type VARCHAR(100),
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_start_time ON activities(user_id, start_time DESC);
CREATE INDEX idx_activities_type ON activities(user_id, activity_type);
CREATE INDEX idx_daily_metrics_user_date ON daily_metrics(user_id, date DESC);
CREATE INDEX idx_training_plan_user_date ON training_plan(user_id, scheduled_date);
CREATE INDEX idx_race_goals_active ON race_goals(user_id) WHERE is_active = true;
CREATE INDEX idx_gps_activity_id ON activity_gps(activity_id);
CREATE INDEX idx_insights_user_read ON insights(user_id, is_read);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON user_profile
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_race_goals_updated_at BEFORE UPDATE ON race_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_plan_updated_at BEFORE UPDATE ON training_plan
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_plans_updated_at BEFORE UPDATE ON weekly_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
