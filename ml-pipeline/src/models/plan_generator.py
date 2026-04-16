"""
Adaptive Training Plan Generator
Generates and adjusts training plans based on performance and recovery
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum


class TrainingPhase(Enum):
    BASE = "base"
    BUILD = "build"
    PEAK = "peak"
    TAPER = "taper"
    RECOVERY = "recovery"


class WorkoutType(Enum):
    LONG_RUN = "long_run"
    TEMPO = "tempo"
    INTERVALS = "intervals"
    RECOVERY = "recovery"
    REST = "rest"
    CROSS_TRAIN = "cross_train"
    STRENGTH = "strength"


class PlanGenerator:
    """
    Generates adaptive training plans based on:
    - Target race date and distance
    - Current fitness (CTL, TSB)
    - Recent performance
    - Recovery status
    """

    # Weekly workout structure by phase
    PHASE_WORKOUTS = {
        TrainingPhase.BASE: {
            'monday': WorkoutType.REST,
            'tuesday': WorkoutType.LONG_RUN,
            'wednesday': WorkoutType.RECOVERY,
            'thursday': WorkoutType.TEMPO,
            'friday': WorkoutType.REST,
            'saturday': WorkoutType.CROSS_TRAIN,
            'sunday': WorkoutType.LONG_RUN,
        },
        TrainingPhase.BUILD: {
            'monday': WorkoutType.REST,
            'tuesday': WorkoutType.INTERVALS,
            'wednesday': WorkoutType.RECOVERY,
            'thursday': WorkoutType.TEMPO,
            'friday': WorkoutType.REST,
            'saturday': WorkoutType.STRENGTH,
            'sunday': WorkoutType.LONG_RUN,
        },
        TrainingPhase.PEAK: {
            'monday': WorkoutType.REST,
            'tuesday': WorkoutType.INTERVALS,
            'wednesday': WorkoutType.RECOVERY,
            'thursday': WorkoutType.TEMPO,
            'friday': WorkoutType.REST,
            'saturday': WorkoutType.SHORT_EASY,
            'sunday': WorkoutType.LONG_RUN,
        },
        TrainingPhase.TAPER: {
            'monday': WorkoutType.REST,
            'tuesday': WorkoutType.SHORT_INTERVALS,
            'wednesday': WorkoutType.RECOVERY,
            'thursday': WorkoutType.TEMPO_SHORT,
            'friday': WorkoutType.REST,
            'saturday': WorkoutType.SHAKEOUT,
            'sunday': WorkoutType.RACE,
        },
    }

    def __init__(self, race_date: datetime, race_type: str = 'half_marathon'):
        self.race_date = race_date
        self.race_type = race_type
        self.current_phase = TrainingPhase.BASE
        self.weeks_until_race = self._calculate_weeks_until_race()

    def _calculate_weeks_until_race(self) -> int:
        """Calculate weeks remaining until race"""
        days_until = (self.race_date - datetime.now()).days
        return max(0, days_until // 7)

    def determine_phase(self) -> TrainingPhase:
        """Determine current training phase based on weeks until race"""
        weeks = self._calculate_weeks_until_race()

        if self.race_type == 'half_marathon':
            if weeks >= 14:
                return TrainingPhase.BASE
            elif weeks >= 8:
                return TrainingPhase.BUILD
            elif weeks >= 2:
                return TrainingPhase.PEAK
            else:
                return TrainingPhase.TAPER
        elif self.race_type == 'marathon':
            if weeks >= 16:
                return TrainingPhase.BASE
            elif weeks >= 10:
                return TrainingPhase.BUILD
            elif weeks >= 3:
                return TrainingPhase.PEAK
            else:
                return TrainingPhase.TAPER
        else:
            return TrainingPhase.BASE

    def generate_weekly_plan(
        self,
        athlete_data: Dict[str, Any],
        last_week_completion: float = 1.0,
        recovery_status: str = 'green'
    ) -> Dict[str, Any]:
        """
        Generate weekly training plan

        Args:
            athlete_data: Current fitness metrics (CTL, TSB, VO2 max, etc.)
            last_week_completion: 0.0-1.0, how much of last week's plan was completed
            recovery_status: 'green', 'yellow', or 'red'

        Returns:
            Weekly plan with daily workouts
        """
        self.current_phase = self.determine_phase()

        # Adjust plan based on completion and recovery
        plan_modifier = self._calculate_plan_modifier(
            last_week_completion,
            recovery_status,
            athlete_data.get('tsb', 0)
        )

        # Get base workouts for current phase
        base_workouts = self.PHASE_WORKOUTS.get(
            self.current_phase,
            self.PHASE_WORKOUTS[TrainingPhase.BASE]
        )

        # Generate workouts with adjusted intensity/volume
        workouts = []
        for day, workout_type in base_workouts.items():
            workout = self._create_workout(
                day,
                workout_type,
                athlete_data,
                plan_modifier
            )
            workouts.append(workout)

        # Calculate weekly targets
        weekly_distance = sum(w['target_distance_km'] for w in workouts)
        weekly_workouts = len([w for w in workouts if w['type'] != WorkoutType.REST.value])

        return {
            'phase': self.current_phase.value,
            'week_start': datetime.now().strftime('%Y-%m-%d'),
            'plan_modifier': plan_modifier,
            'weekly_distance_km': round(weekly_distance, 1),
            'weekly_workouts': weekly_workouts,
            'focus': self._get_phase_focus(),
            'workouts': workouts,
            'notes': self._generate_notes(plan_modifier, recovery_status),
        }

    def _calculate_plan_modifier(
        self,
        completion: float,
        recovery: str,
        tsb: float
    ) -> float:
        """
        Calculate plan adjustment factor
        1.0 = normal progression
        < 1.0 = deload/reduce volume
        > 1.0 = can handle more
        """
        modifier = 1.0

        # Adjust based on last week's completion
        if completion < 0.7:
            modifier -= 0.15  # Significant reduction
        elif completion < 0.9:
            modifier -= 0.05  # Slight reduction

        # Adjust based on recovery
        if recovery == 'red':
            modifier -= 0.2  # Major deload
        elif recovery == 'yellow':
            modifier -= 0.1  # Moderate deload

        # Adjust based on TSB (form)
        if tsb > 25:
            modifier += 0.05  # Very fresh, can push
        elif tsb < -20:
            modifier -= 0.1  # Fatigued

        return max(0.6, min(1.2, modifier))

    def _create_workout(
        self,
        day: str,
        workout_type: WorkoutType,
        athlete_data: Dict[str, Any],
        modifier: float
    ) -> Dict[str, Any]:
        """Create individual workout with targets"""

        # Base distances by workout type (for half marathon)
        base_distances = {
            WorkoutType.LONG_RUN: 16.0,
            WorkoutType.TEMPO: 8.0,
            WorkoutType.INTERVALS: 10.0,
            WorkoutType.RECOVERY: 6.0,
            WorkoutType.CROSS_TRAIN: 0,  # Time-based
            WorkoutType.REST: 0,
            WorkoutType.STRENGTH: 0,
        }

        # Base paces (sec/km) from athlete data
        vo2_max = athlete_data.get('vo2_max', 45)
        base_pace = 420 - (vo2_max * 2.5)  # Rough estimate

        pace_zones = {
            'easy': base_pace + 30,
            'moderate': base_pace + 10,
            'threshold': base_pace - 10,
            'vo2_max': base_pace - 20,
        }

        workout = {
            'day': day,
            'type': workout_type.value,
            'target_distance_km': base_distances.get(workout_type, 0) * modifier,
            'target_duration_min': None,
            'pace_zone': None,
            'target_pace_min': None,
            'target_pace_max': None,
            'hr_zone': None,
            'purpose': None,
            'instructions': None,
        }

        # Fill in workout-specific details
        if workout_type == WorkoutType.LONG_RUN:
            workout['pace_zone'] = 'easy'
            workout['target_pace_min'] = pace_zones['easy']
            workout['target_pace_max'] = pace_zones['easy'] + 30
            workout['hr_zone'] = 2
            workout['purpose'] = 'Build aerobic endurance and mental toughness'
            workout['instructions'] = 'Start conservative, finish strong. Last 20% should feel controlled.'

        elif workout_type == WorkoutType.TEMPO:
            workout['pace_zone'] = 'threshold'
            workout['target_pace_min'] = pace_zones['threshold'] - 5
            workout['target_pace_max'] = pace_zones['threshold'] + 5
            workout['hr_zone'] = 3
            workout['purpose'] = 'Improve lactate threshold and race pace efficiency'
            workout['instructions'] = '2km warmup, tempo effort at threshold pace, 1km cooldown'

        elif workout_type == WorkoutType.INTERVALS:
            workout['pace_zone'] = 'vo2_max'
            workout['target_pace_min'] = pace_zones['vo2_max'] - 5
            workout['target_pace_max'] = pace_zones['vo2_max'] + 5
            workout['hr_zone'] = 4
            workout['purpose'] = 'Increase VO2 max and running economy'
            workout['instructions'] = 'Warm up well. Intervals at 5K pace with equal time recovery.'

        elif workout_type == WorkoutType.RECOVERY:
            workout['pace_zone'] = 'easy'
            workout['target_pace_min'] = pace_zones['easy']
            workout['target_pace_max'] = pace_zones['easy'] + 45
            workout['hr_zone'] = 1
            workout['purpose'] = 'Active recovery, promote blood flow'
            workout['instructions'] = 'Truly easy. Should feel conversational throughout.'

        elif workout_type == WorkoutType.REST:
            workout['purpose'] = 'Full recovery'
            workout['instructions'] = 'No running. Optional: light stretching, foam rolling, or complete rest.'

        elif workout_type == WorkoutType.CROSS_TRAIN:
            workout['target_duration_min'] = 45 * modifier
            workout['hr_zone'] = 2
            workout['purpose'] = 'Aerobic fitness with reduced impact'
            workout['instructions'] = 'Cycling, swimming, or elliptical. Moderate effort, keep HR in zone 2.'

        return workout

    def _get_phase_focus(self) -> str:
        """Get the focus of current training phase"""
        focus = {
            TrainingPhase.BASE: 'Build aerobic base and running economy',
            TrainingPhase.BUILD: 'Increase threshold and race-specific fitness',
            TrainingPhase.PEAK: 'Maximize fitness and practice race pace',
            TrainingPhase.TAPER: 'Recover and sharpen for race day',
        }
        return focus.get(self.current_phase, 'Build fitness')

    def _generate_notes(self, modifier: float, recovery: str) -> str:
        """Generate weekly training notes"""
        notes = []

        if modifier < 0.8:
            notes.append("Reduced volume this week due to fatigue or missed workouts.")
        elif modifier > 1.1:
            notes.append("You\'re in great shape - can handle increased training load.")

        if recovery == 'red':
            notes.append("Priority: Recovery. Don\'t hesitate to skip or modify workouts.")
        elif recovery == 'yellow':
            notes.append("Monitor how you feel. Easy days should be truly easy.")

        if self.current_phase == TrainingPhase.TAPER:
            notes.append("Trust the taper. You\'ve done the work - now rest up for race day!")

        return " ".join(notes) if notes else "Stay consistent and listen to your body."

    def adjust_for_race_performance(
        self,
        actual_time: int,
        predicted_time: int,
        felt_effort: str
    ) -> Dict[str, Any]:
        """
        Adjust future plans based on race performance

        Args:
            actual_time: Actual race time in seconds
            predicted_time: Predicted race time in seconds
            felt_effort: 'easy', 'moderate', 'hard', 'brutal'
        """
        adjustments = {}

        time_ratio = actual_time / predicted_time

        if time_ratio < 0.95 and felt_effort in ['easy', 'moderate']:
            adjustments['fitness_underestimated'] = True
            adjustments['increase_intensity'] = True
        elif time_ratio > 1.05:
            adjustments['fitness_overestimated'] = True
            adjustments['reduce_intensity'] = True

        if felt_effort == 'brutal':
            adjustments['extended_recovery'] = True
            adjustments['reduce_volume_next_week'] = 0.7

        return adjustments


if __name__ == "__main__":
    # Test plan generation
    race_date = datetime.now() + timedelta(weeks=16)
    generator = PlanGenerator(race_date, 'half_marathon')

    athlete_data = {
        'vo2_max': 50,
        'ctl': 65,
        'tsb': 15,
    }

    plan = generator.generate_weekly_plan(
        athlete_data,
        last_week_completion=0.95,
        recovery_status='green'
    )

    print(f"Training Phase: {plan['phase']}")
    print(f"Weekly Distance: {plan['weekly_distance_km']} km")
    print(f"Focus: {plan['focus']}")
    print(f"\nWorkouts:")
    for workout in plan['workouts']:
        print(f"  {workout['day']}: {workout['type']} - {workout['target_distance_km']}km "
              f"({workout.get('pace_zone', 'N/A')})")
