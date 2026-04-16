/**
 * Recovery Calculator
 * Determines athlete recovery status based on multiple signals
 */

export interface RecoverySignals {
  tsb: number | null; // Training Stress Balance
  hrvAverage: number | null; // HRV average (ms)
  hrvStatus: string | null; // 'balanced', 'unbalanced', 'poor'
  restingHR: number | null; // Resting heart rate
  sleepScore: number | null; // Sleep score (0-100)
  sleepHours: number | null; // Hours of sleep
  stressScore: number | null; // Stress score (0-100)
  recentTrainingLoad: number | null; // Last 3 days avg training load
  hrvBaseline: number | null; // User's typical HRV
  restingHRBaseline: number | null; // User's typical RHR
}

export interface RecoveryResult {
  status: 'green' | 'yellow' | 'red';
  score: number; // 0-100, higher = better recovered
  factors: RecoveryFactor[];
  recommendation: string;
}

export interface RecoveryFactor {
  name: string;
  status: 'positive' | 'neutral' | 'negative';
  description: string;
}

/**
 * Calculate recovery status from multiple physiological signals
 */
export function calculateRecovery(signals: RecoverySignals): RecoveryResult {
  const factors: RecoveryFactor[] = [];
  let score = 100;

  // TSB Factor (weight: 30 points)
  if (signals.tsb !== null) {
    if (signals.tsb > 25) {
      factors.push({
        name: 'TSB (Form)',
        status: 'positive',
        description: `Very fresh (TSB: ${signals.tsb})`,
      });
    } else if (signals.tsb >= 0) {
      factors.push({
        name: 'TSB (Form)',
        status: 'positive',
        description: `Good form (TSB: ${signals.tsb})`,
      });
    } else if (signals.tsb >= -10) {
      factors.push({
        name: 'TSB (Form)',
        status: 'neutral',
        description: `Neutral (TSB: ${signals.tsb})`,
      });
      score -= 10;
    } else if (signals.tsb >= -20) {
      factors.push({
        name: 'TSB (Form)',
        status: 'negative',
        description: `Fatigued (TSB: ${signals.tsb})`,
      });
      score -= 20;
    } else {
      factors.push({
        name: 'TSB (Form)',
        status: 'negative',
        description: `Very fatigued (TSB: ${signals.tsb})`,
      });
      score -= 30;
    }
  }

  // HRV Factor (weight: 25 points)
  if (signals.hrvStatus === 'poor') {
    factors.push({
      name: 'HRV Status',
      status: 'negative',
      description: 'Poor HRV - body under stress',
    });
    score -= 25;
  } else if (signals.hrvStatus === 'unbalanced') {
    factors.push({
      name: 'HRV Status',
      status: 'negative',
      description: 'Unbalanced HRV',
    });
    score -= 15;
  } else if (signals.hrvStatus === 'balanced') {
    factors.push({
      name: 'HRV Status',
      status: 'positive',
      description: 'Balanced HRV',
    });
  } else if (signals.hrvAverage !== null && signals.hrvBaseline !== null) {
    const hrvDeviation = ((signals.hrvAverage - signals.hrvBaseline) / signals.hrvBaseline) * 100;
    if (hrvDeviation > -5) {
      factors.push({
        name: 'HRV',
        status: 'positive',
        description: `HRV above baseline (${Math.round(hrvDeviation)}%)`,
      });
    } else if (hrvDeviation > -15) {
      factors.push({
        name: 'HRV',
        status: 'neutral',
        description: `HRV slightly below baseline (${Math.round(hrvDeviation)}%)`,
      });
      score -= 10;
    } else {
      factors.push({
        name: 'HRV',
        status: 'negative',
        description: `HRV significantly below baseline (${Math.round(hrvDeviation)}%)`,
      });
      score -= 20;
    }
  }

  // Resting HR Factor (weight: 15 points)
  if (signals.restingHR !== null && signals.restingHRBaseline !== null) {
    const rhrDeviation = signals.restingHR - signals.restingHRBaseline;
    if (rhrDeviation <= 2) {
      factors.push({
        name: 'RHR',
        status: 'positive',
        description: `Normal RHR (${signals.restingHR} bpm)`,
      });
    } else if (rhrDeviation <= 5) {
      factors.push({
        name: 'RHR',
        status: 'neutral',
        description: `Slightly elevated RHR (${signals.restingHR} bpm)`,
      });
      score -= 8;
    } else {
      factors.push({
        name: 'RHR',
        status: 'negative',
        description: `Elevated RHR (+${rhrDeviation} bpm)`,
      });
      score -= 15;
    }
  }

  // Sleep Factor (weight: 20 points)
  if (signals.sleepScore !== null) {
    if (signals.sleepScore >= 80) {
      factors.push({
        name: 'Sleep',
        status: 'positive',
        description: `Great sleep (score: ${signals.sleepScore})`,
      });
    } else if (signals.sleepScore >= 60) {
      factors.push({
        name: 'Sleep',
        status: 'neutral',
        description: `Fair sleep (score: ${signals.sleepScore})`,
      });
      score -= 10;
    } else {
      factors.push({
        name: 'Sleep',
        status: 'negative',
        description: `Poor sleep (score: ${signals.sleepScore})`,
      });
      score -= 20;
    }
  } else if (signals.sleepHours !== null) {
    if (signals.sleepHours >= 7.5) {
      factors.push({
        name: 'Sleep',
        status: 'positive',
        description: `${signals.sleepHours.toFixed(1)} hours`,
      });
    } else if (signals.sleepHours >= 6) {
      factors.push({
        name: 'Sleep',
        status: 'neutral',
        description: `${signals.sleepHours.toFixed(1)} hours`,
      });
      score -= 10;
    } else {
      factors.push({
        name: 'Sleep',
        status: 'negative',
        description: `Only ${signals.sleepHours.toFixed(1)} hours`,
      });
      score -= 20;
    }
  }

  // Recent Training Load Factor (weight: 10 points)
  if (signals.recentTrainingLoad !== null) {
    if (signals.recentTrainingLoad > 150) {
      factors.push({
        name: 'Training Load',
        status: 'negative',
        description: 'High recent training load',
      });
      score -= 10;
    } else if (signals.recentTrainingLoad > 100) {
      factors.push({
        name: 'Training Load',
        status: 'neutral',
        description: 'Moderate training load',
      });
    } else {
      factors.push({
        name: 'Training Load',
        status: 'positive',
        description: 'Manageable training load',
      });
    }
  }

  // Determine overall status
  let status: 'green' | 'yellow' | 'red' = 'green';
  if (score < 50) {
    status = 'red';
  } else if (score < 75) {
    status = 'yellow';
  }

  // Generate recommendation
  const recommendation = generateRecommendation(status, factors);

  return {
    status,
    score: Math.max(0, Math.min(100, score)),
    factors,
    recommendation,
  };
}

function generateRecommendation(
  status: 'green' | 'yellow' | 'red',
  factors: RecoveryFactor[]
): string {
  const negativeFactors = factors.filter(f => f.status === 'negative');

  if (status === 'green') {
    return 'You\'re well recovered. Good day for a quality workout or race.';
  }

  if (status === 'yellow') {
    const mainIssue = negativeFactors[0]?.name;
    if (mainIssue === 'TSB (Form)') {
      return 'Consider an easier day. Your training load has been high.';
    }
    if (mainIssue === 'Sleep') {
      return 'Prioritize rest tonight. Consider moving hard workouts to later in the week.';
    }
    return 'Listen to your body. May want to reduce intensity today.';
  }

  // Red status
  if (negativeFactors.some(f => f.name === 'HRV Status' || f.name === 'HRV')) {
    return 'High recovery priority. Your body is showing stress signals. Take rest or very easy activity.';
  }
  return 'Critical recovery needed. Skip hard training. Focus on sleep, nutrition, and stress management.';
}
