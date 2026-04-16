'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle, Circle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Workout {
  id: string;
  workout_type: string;
  scheduled_date: string;
  target_distance_meters: number | null;
  target_pace_min_sec_per_km: number | null;
  target_pace_max_sec_per_km: number | null;
  target_hr_zone: number | null;
  purpose: string | null;
  status: 'scheduled' | 'completed' | 'skipped';
}

interface PlanResponse {
  weekStart: string;
  workouts: Workout[];
}

export default function PlanPage() {
  const { data: plan, isLoading } = useQuery<PlanResponse>({
    queryKey: ['plan'],
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/plan');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const weekStart = plan?.weekStart ? new Date(plan.weekStart) : new Date();
  const weekDates = generateWeekDates(weekStart);

  const workoutTypeLabels: Record<string, string> = {
    long_run: 'Long Run',
    tempo: 'Tempo',
    intervals: 'Intervals',
    recovery: 'Recovery',
    rest: 'Rest',
    cross_train: 'Cross Train',
    strength: 'Strength',
  };

  const statusIcons = {
    scheduled: <Circle className="w-5 h-5 text-gray-400" />,
    completed: <CheckCircle className="w-5 h-5 text-green-400" />,
    skipped: <XCircle className="w-5 h-5 text-red-400" />,
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Training Plan</h1>
        <p className="text-gray-400">
          Week of {format(weekStart, 'MMM d, yyyy')}
        </p>
      </div>

      {/* Weekly Overview */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-semibold">This Week</h2>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayWorkout = plan?.workouts?.find(w => w.scheduled_date === dateStr);
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={dateStr}
                className={`p-3 rounded-lg text-center ${
                  isToday ? 'bg-blue-500/20 border border-blue-500' : 'bg-gray-800/50'
                }`}
              >
                <p className="text-xs text-gray-400 mb-1">
                  {format(date, 'EEE')}
                </p>
                <p className="text-lg font-bold mb-2">{format(date, 'd')}</p>
                {dayWorkout ? (
                  <div className="space-y-1">
                    {statusIcons[dayWorkout.status]}
                    <p className="text-xs text-gray-300">
                      {workoutTypeLabels[dayWorkout.workout_type] || dayWorkout.workout_type}
                    </p>
                    {dayWorkout.target_distance_meters && (
                      <p className="text-xs text-gray-500">
                        {(dayWorkout.target_distance_meters / 1000).toFixed(1)} km
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No workout</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Workout List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Daily Workouts</h2>
        {plan?.workouts?.map((workout) => (
          <div
            key={workout.id}
            className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${
                workout.status === 'completed' ? 'bg-green-500/20' :
                workout.status === 'skipped' ? 'bg-red-500/20' : 'bg-gray-500/20'
              }`}>
                {statusIcons[workout.status]}
              </div>
              <div>
                <p className="font-medium text-white">
                  {format(new Date(workout.scheduled_date), 'EEEE, MMM d')}
                </p>
                <p className="text-gray-400">
                  {workoutTypeLabels[workout.workout_type] || workout.workout_type}
                </p>
                {workout.purpose && (
                  <p className="text-sm text-gray-500 mt-1">{workout.purpose}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              {workout.target_distance_meters && (
                <p className="text-white">
                  {(workout.target_distance_meters / 1000).toFixed(1)} km
                </p>
              )}
              {workout.target_hr_zone && (
                <p className="text-sm text-gray-400">HR Zone {workout.target_hr_zone}</p>
              )}
            </div>
          </div>
        ))}
        {(!plan?.workouts || plan.workouts.length === 0) && (
          <p className="text-gray-400 text-center py-8">No workouts scheduled for this week</p>
        )}
      </div>
    </div>
  );
}

function generateWeekDates(weekStart: Date): Date[] {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}
