'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle, Circle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
  instructions: string | null;
  status: 'scheduled' | 'completed' | 'skipped';
}

interface PlanResponse {
  weekStart: string;
  workouts: Workout[];
}

function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}/km`;
}

function formatPaceRange(min: number | null, max: number | null): string {
  if (!min || !max) return '';
  const minPace = formatPace(min);
  const maxPace = formatPace(max);
  return minPace === maxPace ? minPace : `${minPace} - ${maxPace}`;
}

const workoutLabels: Record<string, string> = {
  long_run: 'Long Run',
  tempo: 'Tempo Run',
  intervals: 'Intervals',
  recovery: 'Recovery Run',
  rest: 'Rest Day',
  cross_train: 'Cross Training',
  strength: 'Strength',
};

const workoutColors: Record<string, string> = {
  long_run: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  tempo: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  intervals: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  recovery: 'bg-green-500/20 text-green-400 border-green-500/50',
  rest: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  cross_train: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  strength: 'bg-red-500/20 text-red-400 border-red-500/50',
};

export default function PlanPage() {
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  const { data: plan, isLoading, error } = useQuery<PlanResponse>({
    queryKey: ['plan'],
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/plan');
      if (!res.ok) throw new Error('Failed to fetch plan');
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Failed to load training plan. Is the backend running?
      </div>
    );
  }

  const weekStart = plan?.weekStart ? new Date(plan.weekStart) : new Date();
  const weekDates = generateWeekDates(weekStart);

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
          {weekDates.map((date) => {
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
                    <div className={`w-3 h-3 rounded-full mx-auto ${
                      dayWorkout.status === 'completed' ? 'bg-green-500' :
                      dayWorkout.status === 'skipped' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    <p className="text-xs text-gray-300">
                      {workoutLabels[dayWorkout.workout_type] || dayWorkout.workout_type}
                    </p>
                    {dayWorkout.target_distance_meters && (
                      <p className="text-xs text-gray-500">
                        {(dayWorkout.target_distance_meters / 1000).toFixed(1)} km
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">Rest</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Workout List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Daily Workouts</h2>
        {plan?.workouts?.map((workout) => {
          const isExpanded = expandedWorkout === workout.id;
          const paceRange = formatPaceRange(
            workout.target_pace_min_sec_per_km,
            workout.target_pace_max_sec_per_km
          );

          return (
            <div
              key={workout.id}
              className={`rounded-xl border overflow-hidden transition-all ${
                workout.status === 'completed' ? 'border-green-500/30 bg-green-500/5' :
                workout.status === 'skipped' ? 'border-red-500/30 bg-red-500/5' :
                'border-gray-800 bg-gray-900/50'
              }`}
            >
              {/* Header - always visible */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/30"
                onClick={() => setExpandedWorkout(isExpanded ? null : workout.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    workout.status === 'completed' ? 'bg-green-500/20' :
                    workout.status === 'skipped' ? 'bg-red-500/20' : 'bg-gray-500/20'
                  }`}>
                    {workout.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {workout.status === 'skipped' && <XCircle className="w-5 h-5 text-red-400" />}
                    {workout.status === 'scheduled' && <Circle className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {format(new Date(workout.scheduled_date), 'EEEE, MMM d')}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${workoutColors[workout.workout_type] || 'bg-gray-500/20 text-gray-400 border-gray-500/50'}`}>
                        {workoutLabels[workout.workout_type] || workout.workout_type}
                      </span>
                      {workout.target_distance_meters && (
                        <span>{(workout.target_distance_meters / 1000).toFixed(1)} km</span>
                      )}
                      {paceRange && <span>{paceRange}</span>}
                      {workout.target_hr_zone && <span>HR Zone {workout.target_hr_zone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {workout.instructions && (
                    isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && workout.instructions && (
                <div className="px-4 pb-4 border-t border-gray-800">
                  <div className="mt-4 space-y-3">
                    {workout.purpose && (
                      <div>
                        <p className="text-sm font-medium text-gray-300 mb-1">Purpose</p>
                        <p className="text-sm text-gray-400">{workout.purpose}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-1">Instructions</p>
                      <p className="text-sm text-gray-400">{workout.instructions}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
