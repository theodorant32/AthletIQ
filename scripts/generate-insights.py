"""
Generate AI insights from training data
Run this as a scheduled job to populate the insights table
"""

import os
import sys
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
def get_connection():
    return psycopg2.connect(
        host=os.environ.get('DATABASE_HOST', 'localhost'),
        port=int(os.environ.get('DATABASE_PORT', 5432)),
        database=os.environ.get('DATABASE_NAME', 'athletiq'),
        user=os.environ.get('DATABASE_USER', 'postgres'),
        password=os.environ.get('DATABASE_PASSWORD', 'postgres')
    )

def generate_insights(user_id: str):
    """Generate insights for a user"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    insights = []

    # Insight: Best training week
    cur.execute("""
        SELECT
            DATE_TRUNC('week', start_time) as week_start,
            COUNT(*) as workout_count,
            SUM(distance_meters) as total_distance,
            AVG(training_load) as avg_training_load
        FROM activities
        WHERE user_id = %s
        GROUP BY DATE_TRUNC('week', start_time)
        ORDER BY total_distance DESC
        LIMIT 1
    """, (user_id,))

    best_week = cur.fetchone()
    if best_week and best_week['total_distance']:
        insights.append({
            'type': 'performance',
            'title': 'Best training week on record',
            'description': f"Week of {best_week['week_start'].strftime('%b %d')}: "
                          f"{best_week['workout_count']} workouts, "
                          f"{best_week['total_distance']/1000:.1f} km total",
            'severity': 'low'
        })

    # Insight: CTL trend
    cur.execute("""
        SELECT
            ctl_score,
            date,
            LAG(ctl_score, 7) OVER (ORDER BY date) as ctl_7d_ago
        FROM daily_metrics
        WHERE user_id = %s
        ORDER BY date DESC
        LIMIT 1
    """, (user_id,))

    latest = cur.fetchone()
    if latest and latest['ctl_7d_ago']:
        ctl_change = float(latest['ctl_score'] or 0) - float(latest['ctl_7d_ago'] or 0)
        if ctl_change > 5:
            insights.append({
                'type': 'performance',
                'title': 'Fitness building rapidly',
                'description': f'CTL increased by {ctl_change:.1f} over the last 7 days. '
                              f'Current fitness level: {latest["ctl_score"]:.0f}',
                'severity': 'low'
            })
        elif ctl_change < -5:
            insights.append({
                'type': 'recovery',
                'title': 'Fitness declining',
                'description': f'CTL decreased by {abs(ctl_change):.1f} over the last 7 days. '
                              f'Consider adding consistency to your training.',
                'severity': 'medium'
            })

    # Insight: Overtraining risk
    cur.execute("""
        SELECT recovery_status, date
        FROM daily_metrics
        WHERE user_id = %s
        AND recovery_status IN ('yellow', 'red')
        ORDER BY date DESC
        LIMIT 3
    """, (user_id,))

    fatigued_days = cur.fetchall()
    if len(fatigued_days) >= 3:
        insights.append({
            'type': 'recovery',
            'title': 'Elevated fatigue detected',
            'description': 'You\'ve been in yellow/red recovery status for 3+ days. '
                          'Consider a deload week to prevent overtraining.',
            'severity': 'high'
        })

    # Insight: Pace improvement
    cur.execute("""
        SELECT
            AVG(avg_pace_sec_per_km) as avg_pace,
            DATE_TRUNC('month', start_time) as month
        FROM activities
        WHERE user_id = %s
        AND activity_type = 'run'
        AND distance_meters > 5000
        GROUP BY DATE_TRUNC('month', start_time)
        ORDER BY month DESC
        LIMIT 2
    """, (user_id,))

    pace_data = cur.fetchall()
    if len(pace_data) == 2:
        current_pace = float(pace_data[0]['avg_pace'] or 0)
        prev_pace = float(pace_data[1]['avg_pace'] or 0)
        if current_pace > 0 and prev_pace > 0:
            pace_improvement = prev_pace - current_pace
            if pace_improvement > 5:  # seconds per km
                mins = int(pace_improvement // 60)
                secs = int(pace_improvement % 60)
                insights.append({
                    'type': 'performance',
                    'title': 'Pace improvement detected',
                    'description': f'Your average pace has improved by {mins}m{secs}s per km '
                                  f'compared to last month. Great progress!',
                    'severity': 'low'
                })

    # Insert insights
    for insight in insights:
        cur.execute("""
            INSERT INTO insights (user_id, insight_type, title, description, severity)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (user_id, insight['type'], insight['title'], insight['description'], insight['severity']))

    conn.commit()
    cur.close()
    conn.close()

    print(f"Generated {len(insights)} insights for user {user_id}")
    return insights

if __name__ == '__main__':
    user_id = sys.argv[1] if len(sys.argv) > 1 else 'sample-user-id'
    generate_insights(user_id)
