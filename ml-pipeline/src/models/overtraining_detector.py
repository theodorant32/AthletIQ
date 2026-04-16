"""
Overtraining Detector
Detects early signs of overtraining using anomaly detection
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta


class OvertrainingDetector:
    """
    Detects overtraining risk using HRV trends, RHR, and training load
    """

    def __init__(self, contamination: float = 0.1):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42
        )
        self.is_trained = False
        self.baseline_hrv: Optional[float] = None
        self.baseline_rhr: Optional[float] = None

    def prepare_features(self, daily_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Prepare features from daily metrics for anomaly detection

        Features:
        - hrv_average: HRV value
        - hrv_deviation: % deviation from baseline
        - rhr: Resting heart rate
        - rhr_deviation: Deviation from baseline RHR
        - ctl: Chronic training load
        - atl: Acute training load
        - tsb: Training stress balance
        - training_load: Daily training load
        - sleep_score: Sleep quality
        - stress_score: Stress level
        """
        rows = []
        for day in daily_data:
            hrv = day.get('hrv_average')
            rhr = day.get('resting_heart_rate')

            hrv_deviation = 0
            if hrv and self.baseline_hrv:
                hrv_deviation = ((hrv - self.baseline_hrv) / self.baseline_hrv) * 100

            rhr_deviation = 0
            if rhr and self.baseline_rhr:
                rhr_deviation = rhr - self.baseline_rhr

            rows.append({
                'hrv': hrv or 50,
                'hrv_deviation': hrv_deviation,
                'rhr': rhr or 60,
                'rhr_deviation': rhr_deviation,
                'ctl': day.get('ctl_score', 50),
                'atl': day.get('atl_score', 40),
                'tsb': day.get('tsb_score', 10),
                'training_load': day.get('training_load_sum', 100),
                'sleep_score': day.get('sleep_score', 70),
                'stress_score': day.get('stress_score', 50),
            })

        return pd.DataFrame(rows)

    def set_baselines(self, hrv: float, rhr: float):
        """Set athlete baselines for HRV and RHR"""
        self.baseline_hrv = hrv
        self.baseline_rhr = rhr

    def calculate_baselines(self, daily_data: List[Dict[str, Any]], days: int = 30):
        """
        Calculate baselines from recent data
        Uses median to be robust against outliers
        """
        recent_data = daily_data[-days:] if len(daily_data) > days else daily_data

        hrv_values = [d.get('hrv_average') for d in recent_data if d.get('hrv_average')]
        rhr_values = [d.get('resting_heart_rate') for d in recent_data if d.get('resting_heart_rate')]

        if hrv_values:
            self.baseline_hrv = np.median(hrv_values)
        if rhr_values:
            self.baseline_rhr = np.median(rhr_values)

        print(f"Baselines set: HRV={self.baseline_hrv:.1f}ms, RHR={self.baseline_rhr:.1f}bpm")

    def train(self, daily_data: List[Dict[str, Any]]):
        """
        Train the anomaly detection model on historical data
        """
        if not self.baseline_hrv or not self.baseline_rhr:
            self.calculate_baselines(daily_data)

        X = self.prepare_features(daily_data)
        self.model.fit(X)
        self.is_trained = True

        print(f"Model trained on {len(daily_data)} days of data")

    def detect(self, daily_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Detect overtraining risk from recent data

        Returns:
        {
            'status': 'green' | 'yellow' | 'red',
            'risk_score': 0-100,
            'signals': [...],
            'recommendation': '...'
        }
        """
        if not self.is_trained:
            # Fall back to rule-based detection
            return self._rule_based_detect(daily_data)

        X = self.prepare_features(daily_data)

        # Get anomaly scores (-1 = anomaly, 1 = normal)
        predictions = self.model.predict(X)
        # Get continuous anomaly scores (more negative = more anomalous)
        anomaly_scores = self.model.score_samples(X)

        # Analyze recent 7 days
        recent_predictions = predictions[-7:] if len(predictions) >= 7 else predictions
        recent_scores = anomaly_scores[-7:] if len(anomaly_scores) >= 7 else anomaly_scores

        # Count anomalous days
        anomalous_days = sum(1 for p in recent_predictions if p == -1)
        avg_anomaly_score = np.mean(recent_scores)

        # Determine status
        if anomalous_days >= 4:
            status = 'red'
            risk_score = min(100, 70 + anomalous_days * 5)
        elif anomalous_days >= 2:
            status = 'yellow'
            risk_score = 40 + anomalous_days * 10
        else:
            status = 'green'
            risk_score = max(0, 30 + avg_anomaly_score * 10)

        signals = self._identify_signals(daily_data[-7:])
        recommendation = self._generate_recommendation(status, signals)

        return {
            'status': status,
            'risk_score': int(risk_score),
            'signals': signals,
            'recommendation': recommendation,
        }

    def _rule_based_detect(self, daily_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Fallback rule-based detection when model not trained
        """
        if not daily_data:
            return {'status': 'unknown', 'risk_score': 50, 'signals': [], 'recommendation': 'Insufficient data'}

        recent = daily_data[-7:]
        signals = self._identify_signals(recent)

        # Count negative signals
        negative_signals = sum(1 for s in signals if s['status'] == 'negative')

        if negative_signals >= 3:
            status = 'red'
            risk_score = 80
        elif negative_signals >= 2:
            status = 'yellow'
            risk_score = 50
        else:
            status = 'green'
            risk_score = 20

        recommendation = self._generate_recommendation(status, signals)

        return {
            'status': status,
            'risk_score': risk_score,
            'signals': signals,
            'recommendation': recommendation,
        }

    def _identify_signals(self, recent_data: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Identify specific concerning signals"""
        signals = []

        if not recent_data:
            return signals

        # HRV trend
        hrv_values = [d.get('hrv_average') for d in recent_data if d.get('hrv_average')]
        if len(hrv_values) >= 3:
            hrv_trend = hrv_values[-1] - np.mean(hrv_values[:-1])
            if hrv_trend < -5:
                signals.append({
                    'name': 'HRV Decline',
                    'status': 'negative',
                    'description': f'HRV down {abs(hrv_trend):.1f}ms from recent average'
                })
            elif hrv_trend > 3:
                signals.append({
                    'name': 'HRV Improvement',
                    'status': 'positive',
                    'description': f'HRV up {hrv_trend:.1f}ms'
                })

        # RHR trend
        rhr_values = [d.get('resting_heart_rate') for d in recent_data if d.get('resting_heart_rate')]
        if len(rhr_values) >= 3:
            rhr_trend = rhr_values[-1] - np.mean(rhr_values[:-1])
            if rhr_trend > 3:
                signals.append({
                    'name': 'Elevated RHR',
                    'status': 'negative',
                    'description': f'RHR up {rhr_trend:.1f}bpm'
                })

        # TSB trend
        tsb_values = [d.get('tsb_score') for d in recent_data if d.get('tsb_score')]
        if len(tsb_values) >= 3:
            tsb_trend = tsb_values[-1] - np.mean(tsb_values[:-1])
            if tsb_trend < -10:
                signals.append({
                    'name': 'Declining Form',
                    'status': 'negative',
                    'description': f'TSB down {abs(tsb_trend):.1f}'
                })

        # Sleep quality
        sleep_scores = [d.get('sleep_score') for d in recent_data if d.get('sleep_score')]
        if sleep_scores:
            avg_sleep = np.mean(sleep_scores)
            if avg_sleep < 60:
                signals.append({
                    'name': 'Poor Sleep',
                    'status': 'negative',
                    'description': f'Avg sleep score: {avg_sleep:.0f}'
                })
            elif avg_sleep > 80:
                signals.append({
                    'name': 'Good Sleep',
                    'status': 'positive',
                    'description': f'Avg sleep score: {avg_sleep:.0f}'
                })

        # Training load spike
        tl_values = [d.get('training_load_sum') for d in recent_data if d.get('training_load_sum')]
        if len(tl_values) >= 2:
            recent_tl = np.mean(tl_values[-2:])
            prev_tl = np.mean(tl_values[:-2]) if len(tl_values) > 2 else tl_values[0]
            if prev_tl > 0 and recent_tl > prev_tl * 1.3:
                signals.append({
                    'name': 'Training Spike',
                    'status': 'negative',
                    'description': f'Load up {(recent_tl/prev_tl - 1)*100:.0f}%'
                })

        return signals

    def _generate_recommendation(self, status: str, signals: List[Dict[str, str]]) -> str:
        """Generate actionable recommendation"""
        if status == 'green':
            return "Recovery looks good. You're ready for quality training."

        negative_signals = [s for s in signals if s['status'] == 'negative']

        if status == 'yellow':
            if any('HRV' in s['name'] for s in negative_signals):
                return "HRV showing stress. Consider reducing intensity this week."
            if any('Sleep' in s['name'] for s in negative_signals):
                return "Sleep quality is low. Prioritize rest and recovery tonight."
            if any('Training' in s['name'] for s in negative_signals):
                return "Training load spiked recently. Easy days ahead recommended."
            return "Some recovery concerns. Monitor how you feel and adjust if needed."

        # Red status
        return "High overtraining risk. Take 2-3 easy days or complete rest. " \
               "Focus on sleep, nutrition, and stress management before resuming hard training."


if __name__ == "__main__":
    # Test with synthetic data
    detector = OvertrainingDetector()

    # Generate 60 days of synthetic data
    np.random.seed(42)
    data = []
    for i in range(60):
        # Simulate declining HRV in last 10 days (overtraining scenario)
        hrv_decline = max(0, (i - 50)) * 2 if i > 50 else 0

        data.append({
            'date': (datetime.now() - timedelta(days=60-i)).strftime('%Y-%m-%d'),
            'hrv_average': 65 + np.random.normal(0, 5) - hrv_decline,
            'resting_heart_rate': 55 + np.random.normal(0, 2) + (hrv_decline / 2),
            'ctl_score': 50 + i * 0.5 + np.random.normal(0, 5),
            'atl_score': 40 + np.random.normal(0, 10),
            'tsb_score': 10 + np.random.normal(0, 8),
            'training_load_sum': 100 + np.random.normal(0, 20),
            'sleep_score': 70 + np.random.normal(0, 10),
            'stress_score': 40 + np.random.normal(0, 10),
        })

    # Train and detect
    detector.calculate_baselines(data)
    detector.train(data)

    result = detector.detect(data)
    print(f"\nOvertraining Detection Result:")
    print(f"Status: {result['status']}")
    print(f"Risk Score: {result['risk_score']}")
    print(f"Signals: {result['signals']}")
    print(f"Recommendation: {result['recommendation']}")
