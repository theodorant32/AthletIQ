'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Activity, TrendingUp, Heart, Clock } from 'lucide-react';

interface TodayData {
  date: string;
  recovery: 'green' | 'yellow' | 'red' | 'unknown';
  ctl: number | null;
  tsb: number | null;
  workout: any | null;
}

export default function HomePage() {
  const { data: today, isLoading } = useQuery<TodayData>({
    queryKey: ['today'],
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/today');
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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Today</h1>
        <p className="text-gray-400">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Recovery Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RecoveryCard status={today?.recovery || 'unknown'} />
        <FitnessCard ctl={today?.ctl} tsb={today?.tsb} />
        <WorkoutCard workout={today?.workout} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="7-Day Load"
          value={today?.workout ? 'Loading...' : '--'}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Weekly Distance"
          value="-- km"
        />
        <StatCard
          icon={<Heart className="w-5 h-5" />}
          label="Avg HR (7d)"
          value="-- bpm"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Days to Race"
          value="--"
        />
      </div>
    </div>
  );
}

function RecoveryCard({ status }: { status: string }) {
  const colors = {
    green: 'bg-green-500/20 border-green-500 text-green-400',
    yellow: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    red: 'bg-red-500/20 border-red-500 text-red-400',
    unknown: 'bg-gray-500/20 border-gray-500 text-gray-400',
  };

  const labels = {
    green: 'Ready to Train',
    yellow: 'Moderate Fatigue',
    red: 'High Fatigue',
    unknown: 'No Data',
  };

  return (
    <div className={`p-6 rounded-xl border ${colors[status]} transition-all`}>
      <div className="flex items-center gap-3 mb-2">
        <Heart className="w-6 h-6" />
        <h2 className="text-lg font-semibold">Recovery Status</h2>
      </div>
      <p className="text-2xl font-bold mb-1">{labels[status]}</p>
      <p className="text-sm opacity-75">
        {status === 'green' && 'Good day for quality training'}
        {status === 'yellow' && 'Consider reducing intensity'}
        {status === 'red' && 'Prioritize rest and recovery'}
        {status === 'unknown' && 'Sync your first activity'}
      </p>
    </div>
  );
}

function FitnessCard({ ctl, tsb }: { ctl: number | null; tsb: number | null }) {
  return (
    <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="w-6 h-6 text-blue-400" />
        <h2 className="text-lg font-semibold">Fitness Metrics</h2>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-400">CTL (Fitness)</p>
          <p className="text-2xl font-bold text-white">{ctl ?? '--'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">TSB (Form)</p>
          <p className={`text-2xl font-bold ${tsb && tsb > 0 ? 'text-green-400' : tsb && tsb < -10 ? 'text-red-400' : 'text-white'}`}>
            {tsb ?? '--'}
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkoutCard({ workout }: { workout: any }) {
  if (!workout) {
    return (
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-6 h-6 text-purple-400" />
          <h2 className="text-lg font-semibold">Today's Workout</h2>
        </div>
        <p className="text-gray-400">Rest day or no plan scheduled</p>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    long_run: 'Long Run',
    tempo: 'Tempo Run',
    intervals: 'Intervals',
    recovery: 'Recovery Run',
    rest: 'Rest Day',
    cross_train: 'Cross Training',
  };

  return (
    <div className="p-6 rounded-xl border border-purple-500/30 bg-purple-500/10">
      <div className="flex items-center gap-3 mb-2">
        <Activity className="w-6 h-6 text-purple-400" />
        <h2 className="text-lg font-semibold">Today's Workout</h2>
      </div>
      <p className="text-xl font-bold text-white mb-2">
        {typeLabels[workout.workout_type] || workout.workout_type}
      </p>
      {workout.target_distance_meters && (
        <p className="text-gray-300">
          Distance: {(workout.target_distance_meters / 1000).toFixed(1)} km
        </p>
      )}
      {workout.purpose && (
        <p className="text-sm text-gray-400 mt-2">{workout.purpose}</p>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
