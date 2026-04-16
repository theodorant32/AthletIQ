/**
 * Alerts Service
 * Sends SMS via SNS and emails via SES
 */

import { snsClient, sesClient, SNS_TOPIC_ARN, SES_FROM_EMAIL } from '../config/aws';
import { PublishCommand } from '@aws-sdk/client-sns';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { query } from '../config/database';

interface AlertOptions {
  userId: string;
  type: 'sms' | 'email' | 'push';
  channel: 'sns' | 'ses' | 'firebase';
  subject?: string;
  body: string;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Send SMS alert via SNS
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<void> {
  try {
    const command = new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
    });

    const result = await snsClient.send(command);
    console.log(`SMS sent to ${phoneNumber}:`, result.MessageId);

    // Log alert
    await logAlert({
      userId: 'system',
      type: 'sms',
      channel: 'sns',
      body: message,
    });
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}

/**
 * Send SMS to topic subscribers
 */
export async function sendSMSToTopic(message: string, topicArn?: string): Promise<void> {
  try {
    const command = new PublishCommand({
      TopicArn: topicArn || SNS_TOPIC_ARN,
      Message: message,
      Subject: 'AthletIQ Alert',
    });

    const result = await snsClient.send(command);
    console.log(`SMS sent to topic:`, result.MessageId);
  } catch (error) {
    console.error('Failed to send SMS to topic:', error);
    throw error;
  }
}

/**
 * Send email via SES
 */
export async function sendEmail(
  toAddress: string,
  subject: string,
  body: string,
  htmlBody?: string
): Promise<void> {
  try {
    const command = new SendEmailCommand({
      Source: SES_FROM_EMAIL || 'noreply@athletiq.com',
      Destination: {
        ToAddresses: [toAddress],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: body,
            Charset: 'UTF-8',
          },
          ...(htmlBody && {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    const result = await sesClient.send(command);
    console.log(`Email sent to ${toAddress}:`, result.MessageId);

    // Log alert
    await logAlert({
      userId: 'system',
      type: 'email',
      channel: 'ses',
      subject,
      body,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Send daily recovery status SMS
 */
export async function sendDailyRecoverySMS(
  phoneNumber: string,
  recoveryStatus: string,
  ctl: number | null,
  tsb: number | null,
  workout: any
): Promise<void> {
  const statusEmoji = {
    green: '🟢',
    yellow: '🟡',
    red: '🔴',
    unknown: '⚪',
  };

  const statusText = {
    green: 'Ready to train',
    yellow: 'Moderate fatigue',
    red: 'High fatigue - rest recommended',
    unknown: 'No data',
  };

  let message = `Good morning! ${statusEmoji[recoveryStatus]} ${statusText[recoveryStatus]}`;

  if (ctl) {
    message += ` CTL: ${ctl}`;
  }
  if (tsb) {
    message += ` TSB: ${tsb}`;
  }

  if (workout && workout.workout_type !== 'rest') {
    const distanceKm = workout.target_distance_meters
      ? (workout.target_distance_meters / 1000).toFixed(1)
      : '';
    message += ` | Today: ${distanceKm}km ${workout.workout_type.replace('_', ' ')}`;
  }

  message += '\n\nAthletIQ';

  await sendSMS(phoneNumber, message);
}

/**
 * Send weekly training summary email
 */
export async function sendWeeklySummary(
  toAddress: string,
  summary: {
    weekStart: string;
    totalWorkouts: number;
    totalDistance: number;
    totalDuration: number;
    avgCTL: number | null;
    avgTSB: number | null;
    bestWorkout: string;
    recoveryDays: number;
  }
): Promise<void> {
  const subject = `Your Week in Review - ${summary.weekStart}`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
        .stat { display: inline-block; margin: 10px 20px 10px 0; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { color: #666; font-size: 14px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏃 Your Week in Review</h1>
          <p>${summary.weekStart}</p>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-value">${summary.totalWorkouts}</div>
            <div class="stat-label">Workouts</div>
          </div>
          <div class="stat">
            <div class="stat-value">${(summary.totalDistance / 1000).toFixed(1)}</div>
            <div class="stat-label">Kilometers</div>
          </div>
          <div class="stat">
            <div class="stat-value">${Math.round(summary.totalDuration / 3600)}</div>
            <div class="stat-label">Hours</div>
          </div>
          <div class="stat">
            <div class="stat-value">${summary.recoveryDays}</div>
            <div class="stat-label">Recovery Days</div>
          </div>
        </div>

        ${summary.avgCTL ? `
          <p><strong>Average Fitness (CTL):</strong> ${Math.round(summary.avgCTL)}</p>
          <p><strong>Average Form (TSB):</strong> ${Math.round(summary.avgTSB || 0)}</p>
        ` : ''}

        ${summary.bestWorkout ? `
          <p><strong>Highlight:</strong> ${summary.bestWorkout}</p>
        ` : ''}

        <div class="footer">
          <p>Keep pushing! Your next training block awaits.</p>
          <p>Sent by AthletIQ</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Your Week in Review - ${summary.weekStart}

Workouts: ${summary.totalWorkouts}
Distance: ${(summary.totalDistance / 1000).toFixed(1)} km
Duration: ${Math.round(summary.totalDuration / 3600)} hours
Recovery Days: ${summary.recoveryDays}

${summary.avgCTL ? `Average Fitness (CTL): ${Math.round(summary.avgCTL)}\n` : ''}
${summary.avgTSB ? `Average Form (TSB): ${Math.round(summary.avgTSB)}\n` : ''}

Keep pushing! Your next training block awaits.

- AthletIQ
  `.trim();

  await sendEmail(toAddress, subject, textBody, htmlBody);
}

/**
 * Send overtraining alert
 */
export async function sendOvertrainingAlert(
  phoneNumber: string,
  riskLevel: 'yellow' | 'red',
  recommendation: string
): Promise<void> {
  const emoji = riskLevel === 'red' ? '🔴' : '🟡';
  const urgency = riskLevel === 'red' ? 'HIGH' : 'MODERATE';

  const message = `${emoji} ${urgency} OVERTRAINING RISK\n\n${recommendation}\n\nCheck your AthletIQ dashboard for details.`;

  await sendSMS(phoneNumber, message);
}

/**
 * Send PR (personal record) alert
 */
export async function sendPRAlert(
  phoneNumber: string,
  activityType: string,
  newValue: string,
  previousValue: string
): Promise<void> {
  const message = `🎉 NEW PR!\n\n${activityType}: ${newValue} (was ${previousValue})\n\nGreat work! Keep it up.`;

  await sendSMS(phoneNumber, message);
}

/**
 * Log alert to database
 */
async function logAlert(options: AlertOptions): Promise<void> {
  try {
    await query(`
      INSERT INTO alerts (user_id, alert_type, channel, subject, body, status, sent_at)
      VALUES ($1, $2, $3, $4, $5, 'sent', NOW())
    `, [options.userId, options.type, options.channel, options.subject || null, options.body]);
  } catch (error) {
    console.error('Failed to log alert:', error);
  }
}

/**
 * Get user alert preferences
 */
export async function getUserAlertPreferences(userId: string): Promise<{
  smsEnabled: boolean;
  emailEnabled: boolean;
  phoneNumber?: string;
  emailAddress?: string;
}> {
  const result = await query(`
    SELECT garmin_user_id -- placeholder, would need alert_preferences table
    FROM user_profile WHERE id = $1
  `, [userId]);

  // For now, return defaults
  return {
    smsEnabled: true,
    emailEnabled: true,
  };
}
