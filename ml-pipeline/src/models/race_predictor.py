"""
Race Time Predictor
Predicts half marathon and marathon finish times based on training data
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor
from joblib import dump, load
from typing import Optional, Dict, Any
import json


class RaceTimePredictor:
    """
    Predicts race finish times using XGBoost
    """

    def __init__(self):
        self.model = XGBRegressor(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
        self.is_trained = False

    def prepare_features(self, athlete_data: Dict[str, Any]) -> pd.DataFrame:
        """
        Prepare features from athlete data

        Features:
        - vo2_max: Current VO2 max estimate
        - ctl: Chronic training load (fitness)
        - atl: Acute training load (fatigue)
        - tsb: Training stress balance (form)
        - long_run_pace: Average pace of long runs (sec/km)
        - tempo_pace: Average tempo pace (sec/km)
        - weekly_mileage: Average weekly distance (km)
        - recent_5k_time: Recent 5k time if available (sec)
        - recent_10k_time: Recent 10k time if available (sec)
        - training_age: Weeks of consistent training
        - age: Athlete age (optional)
        - weight: Athlete weight in kg (optional)
        """
        features = {
            'vo2_max': athlete_data.get('vo2_max', 40),
            'ctl': athlete_data.get('ctl', 50),
            'atl': athlete_data.get('atl', 40),
            'tsb': athlete_data.get('tsb', 10),
            'long_run_pace': athlete_data.get('long_run_pace', 360),
            'tempo_pace': athlete_data.get('tempo_pace', 330),
            'weekly_mileage': athlete_data.get('weekly_mileage', 40),
            'recent_5k_time': athlete_data.get('recent_5k_time', 1500),
            'recent_10k_time': athlete_data.get('recent_10k_time', 3100),
            'training_age': athlete_data.get('training_age', 20),
            'age': athlete_data.get('age', 30),
            'weight': athlete_data.get('weight', 75),
        }
        return pd.DataFrame([features])

    def train(self, training_data: pd.DataFrame, target_column: str):
        """
        Train the model on historical data

        training_data: DataFrame with features and target times
        target_column: 'half_marathon_time' or 'marathon_time'
        """
        X = training_data.drop(columns=[target_column])
        y = training_data[target_column]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        self.model.fit(X_train, y_train)
        self.is_trained = True

        # Evaluate
        train_score = self.model.score(X_train, y_train)
        test_score = self.model.score(X_test, y_test)

        print(f"Training R²: {train_score:.4f}")
        print(f"Test R²: {test_score:.4f}")

        return {
            'train_score': train_score,
            'test_score': test_score,
            'feature_importance': dict(zip(X.columns, self.model.feature_importances_))
        }

    def predict(self, athlete_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict race time with confidence interval

        Returns:
        {
            'predicted_time': int,  # seconds
            'confidence_lower': int,  # seconds
            'confidence_upper': int,  # seconds
            'pace': str,  # min:sec per km
        }
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before predicting")

        X = self.prepare_features(athlete_data)
        prediction = self.model.predict(X)[0]

        # Calculate confidence interval based on feature uncertainty
        # Typical MAE for race prediction is ~2-3%
        margin = prediction * 0.025

        return {
            'predicted_time': int(prediction),
            'confidence_lower': int(prediction - margin),
            'confidence_upper': int(prediction + margin),
            'pace': self._seconds_to_pace(int(prediction))
        }

    def _seconds_to_pace(self, total_seconds: int, distance_km: float = 21.0975) -> str:
        """Convert total race time to pace per km"""
        pace_sec_per_km = total_seconds / distance_km
        minutes = int(pace_sec_per_km // 60)
        seconds = int(pace_sec_per_km % 60)
        return f"{minutes}:{seconds:02d}/km"

    def save(self, filepath: str):
        """Save model to disk"""
        dump(self.model, filepath)
        print(f"Model saved to {filepath}")

    def load(self, filepath: str):
        """Load model from disk"""
        self.model = load(filepath)
        self.is_trained = True
        print(f"Model loaded from {filepath}")


def generate_synthetic_training_data(n_samples: int = 1000) -> pd.DataFrame:
    """
    Generate synthetic training data for initial model training
    In production, this would come from actual user data
    """
    np.random.seed(42)

    data = []
    for _ in range(n_samples):
        vo2_max = np.random.normal(50, 10)
        ctl = np.random.normal(60, 20)
        atl = np.random.normal(50, 15)
        tsb = ctl - atl

        # Base pace from VO2 max (higher VO2 = faster pace)
        base_pace = 400 - (vo2_max * 2) + np.random.normal(0, 20)

        # Recent race times (correlated with fitness)
        fitness_factor = (vo2_max / 50) * (ctl / 60)
        recent_5k = (1200 + np.random.normal(0, 120)) / fitness_factor
        recent_10k = (2500 + np.random.normal(0, 200)) / fitness_factor

        # Half marathon time
        half_marathon_time = (
            base_pace * 21.0975 *
            (1 + (100 - ctl) / 200) *  # Fitness adjustment
            (1 + max(0, atl - ctl) / 100) *  # Fatigue adjustment
            (1 + np.random.normal(0, 0.03))  # Random variation
        )

        # Marathon time (additional endurance factor)
        marathon_time = (
            base_pace * 42.195 *
            (1 + (100 - ctl) / 150) *
            (1 + max(0, atl - ctl) / 80) *
            (1 + np.random.normal(0, 0.04))
        )

        data.append({
            'vo2_max': max(20, vo2_max),
            'ctl': max(0, ctl),
            'atl': max(0, atl),
            'tsb': tsb,
            'long_run_pace': base_pace + 20,
            'tempo_pace': base_pace - 15,
            'weekly_mileage': np.random.normal(50, 20),
            'recent_5k_time': max(900, recent_5k),
            'recent_10k_time': max(1800, recent_10k),
            'training_age': np.random.uniform(4, 100),
            'age': np.random.uniform(18, 65),
            'weight': np.random.uniform(50, 100),
            'half_marathon_time': max(3600, half_marathon_time),
            'marathon_time': max(7200, marathon_time),
        })

    return pd.DataFrame(data)


if __name__ == "__main__":
    # Generate training data and train model
    print("Generating synthetic training data...")
    train_df = generate_synthetic_training_data(2000)

    # Train half marathon predictor
    print("\nTraining Half Marathon Predictor...")
    half_predictor = RaceTimePredictor()
    half_results = half_predictor.train(train_df, 'half_marathon_time')
    half_predictor.save('models/half_marathon_predictor.joblib')

    # Train marathon predictor
    print("\nTraining Marathon Predictor...")
    marathon_predictor = RaceTimePredictor()
    marathon_results = marathon_predictor.train(train_df, 'marathon_time')
    marathon_predictor.save('models/marathon_predictor.joblib')

    # Test prediction
    print("\nTest Prediction:")
    test_athlete = {
        'vo2_max': 52,
        'ctl': 75,
        'atl': 45,
        'tsb': 30,
        'long_run_pace': 340,
        'tempo_pace': 315,
        'weekly_mileage': 60,
        'recent_5k_time': 1320,
        'recent_10k_time': 2760,
        'training_age': 52,
        'age': 28,
        'weight': 72,
    }

    result = half_predictor.predict(test_athlete)
    print(f"Predicted Half Marathon: {result['predicted_time'] // 3600}h "
          f"{(result['predicted_time'] % 3600) // 60}m {result['predicted_time'] % 60}s")
    print(f"Confidence: {result['pace']} pace")
