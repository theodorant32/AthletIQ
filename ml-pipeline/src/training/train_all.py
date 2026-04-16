"""
Train all ML models and upload to S3
"""

import sys
import os
import json
import boto3
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.race_predictor import RaceTimePredictor, generate_synthetic_training_data
from models.overtraining_detector import OvertrainingDetector

S3_BUCKET = os.environ.get('S3_MODELS_BUCKET', 'athletiq-models')

def train_race_predictors():
    """Train and save race prediction models"""
    print("=" * 50)
    print("Training Race Predictors")
    print("=" * 50)

    # Generate synthetic training data
    print("Generating synthetic training data...")
    train_df = generate_synthetic_training_data(2000)

    # Train half marathon predictor
    print("\nTraining Half Marathon Predictor...")
    half_predictor = RaceTimePredictor()
    half_results = half_predictor.train(train_df, 'half_marathon_time')

    # Train marathon predictor
    print("\nTraining Marathon Predictor...")
    marathon_predictor = RaceTimePredictor()
    marathon_results = marathon_predictor.train(train_df, 'marathon_time')

    # Save models locally
    models_dir = Path(__file__).parent.parent.parent / 'models'
    models_dir.mkdir(exist_ok=True)

    half_path = models_dir / 'half_marathon_predictor.joblib'
    marathon_path = models_dir / 'marathon_predictor.joblib'

    half_predictor.save(str(half_path))
    marathon_predictor.save(str(marathon_path))

    # Upload to S3
    s3 = boto3.client('s3')
    date_str = datetime.now().strftime('%Y%m%d')

    print(f"\nUploading models to S3 ({S3_BUCKET})...")

    s3.upload_file(
        str(half_path),
        S3_BUCKET,
        f'race_predictors/half_marathon_{date_str}.joblib'
    )
    s3.upload_file(
        str(marathon_path),
        S3_BUCKET,
        f'race_predictors/marathon_{date_str}.joblib'
    )

    # Save model metadata
    metadata = {
        'trained_at': datetime.now().isoformat(),
        'half_marathon': {
            'train_score': half_results['train_score'],
            'test_score': half_results['test_score'],
            'feature_importance': half_results['feature_importance'],
        },
        'marathon': {
            'train_score': marathon_results['train_score'],
            'test_score': marathon_results['test_score'],
            'feature_importance': marathon_results['feature_importance'],
        },
    }

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f'race_predictors/metadata_{date_str}.json',
        Body=json.dumps(metadata, indent=2)
    )

    print(f"\nModel performance:")
    print(f"  Half Marathon - Train R²: {half_results['train_score']:.4f}, Test R²: {half_results['test_score']:.4f}")
    print(f"  Marathon - Train R²: {marathon_results['train_score']:.4f}, Test R²: {marathon_results['test_score']:.4f}")

    return metadata

def train_overtraining_detector():
    """Train overtraining detection model"""
    print("\n" + "=" * 50)
    print("Training Overtraining Detector")
    print("=" * 50)

    # Generate synthetic daily metrics data
    print("Generating synthetic daily metrics...")

    from datetime import timedelta
    import numpy as np

    np.random.seed(42)
    data = []

    # Generate 90 days of normal training
    for i in range(90):
        data.append({
            'hrv_average': 60 + np.random.normal(0, 8),
            'resting_heart_rate': 55 + np.random.normal(0, 3),
            'ctl_score': 50 + i * 0.3 + np.random.normal(0, 5),
            'atl_score': 45 + np.random.normal(0, 12),
            'tsb_score': 10 + np.random.normal(0, 10),
            'training_load_sum': 100 + np.random.normal(0, 25),
            'sleep_score': 72 + np.random.normal(0, 10),
            'stress_score': 35 + np.random.normal(0, 12),
        })

    # Add some overtraining scenarios (for the model to learn)
    for i in range(20):
        data.append({
            'hrv_average': 45 + np.random.normal(0, 5),  # Low HRV
            'resting_heart_rate': 65 + np.random.normal(0, 4),  # Elevated RHR
            'ctl_score': 90 + np.random.normal(0, 5),  # Very high fitness
            'atl_score': 80 + np.random.normal(0, 10),  # High fatigue
            'tsb_score': -25 + np.random.normal(0, 8),  # Very negative form
            'training_load_sum': 180 + np.random.normal(0, 20),  # High load
            'sleep_score': 50 + np.random.normal(0, 12),  # Poor sleep
            'stress_score': 70 + np.random.normal(0, 10),  # High stress
        })

    detector = OvertrainingDetector(contamination=0.15)
    detector.calculate_baselines(data)
    detector.train(data)

    # Save model
    from joblib import dump
    models_dir = Path(__file__).parent.parent.parent / 'models'
    models_dir.mkdir(exist_ok=True)

    model_path = models_dir / 'overtraining_detector.joblib'
    dump(detector.model, str(model_path))

    # Upload to S3
    s3 = boto3.client('s3')
    date_str = datetime.now().strftime('%Y%m%d')

    print(f"\nUploading model to S3 ({S3_BUCKET})...")
    s3.upload_file(
        str(model_path),
        S3_BUCKET,
        f'overtraining_detector/{date_str}.joblib'
    )

    # Test detection
    result = detector.detect(data[-14:])
    print(f"\nTest detection result:")
    print(f"  Status: {result['status']}")
    print(f"  Risk Score: {result['risk_score']}")

    return result

if __name__ == '__main__':
    print("AthletIQ ML Pipeline - Model Training")
    print(f"Date: {datetime.now().isoformat()}")
    print()

    # Train all models
    race_metadata = train_race_predictors()
    ot_result = train_overtraining_detector()

    print("\n" + "=" * 50)
    print("Training Complete!")
    print("=" * 50)
