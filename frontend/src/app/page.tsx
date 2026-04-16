'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Activity,
  TrendingUp,
  Heart,
  Clock,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface TodayData {
  date: string;
  recovery: 'green' | 'yellow' | 'red' | 'unknown';
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  workout: any | null;
}

export default function HomePage() {
  const { data: today, isLoading } = useQuery<TodayData>({
    queryKey: ['today'],
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/today');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-white">Good morning</h1>
          <p className="text-gray-400 mt-1">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Recovery Status</p>
          <RecoveryBadge status={today?.recovery || 'unknown'} />
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CTL Card */}
        <StatCard
          title="Fitness (CTL)"
          value={today?.ctl ?? '--'}
          trend="+2.4"
          trendDirection="up"
          icon={TrendingUp}
          color="blue"
          description="42-day training load average"
        />

        {/* TSB Card */}
        <StatCard
          title="Form (TSB)"
          value={today?.tsb ?? '--'}
          trend={today?.tsb && today.tsb > 0 ? 'Fresh' : today?.tsb && today.tsb < -10 ? 'Fatigued' : 'Balanced'}
          trendDirection={today?.tsb && today.tsb > 0 ? 'up' : today?.tsb && today.tsb < -10 ? 'down' : 'neutral'}
          icon={Zap}
          color="purple"
          description="Training stress balance"
        />

        {/* Today's Workout Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-blue-200" />
            <span className="text-sm font-medium text-blue-100">Today's Workout</span>
          </div>
          {today?.workout ? (
            <>
              <p className="text-xl font-semibold mb-1">
                {today.workout.workout_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
              <p className="text-sm text-blue-200">
                {today.workout.target_distance_meters
                  ? `${(today.workout.target_distance_meters / 1000).toFixed(1)} km`
                  : 'Rest day'}
              </p>
            </>
          ) : (
            <p className="text-lg font-medium text-blue-100">No workout scheduled</p>
          )}
        </div>

        {/* Quick Action Card */}
        <div className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-400">This Week</span>
          </div>
          <p className="text-2xl font-semibold text-white">3/5</p>
          <p className="text-sm text-gray-500 mt-1">Workouts completed</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat
          icon={Heart}
          label="Avg HR (7d)"
          value="148 bpm"
        />
        <MiniStat
          icon={Activity}
          label="Distance (7d)"
          value="42.5 km"
        />
        <MiniStat
          icon={Clock}
          label="Time (7d)"
          value="4h 32m"
        />
        <MiniStat
          icon={Target}
          label="Race Countdown"
          value="120 days"
        />
      </div>
    </div>
  );
}

function RecoveryBadge({ status }: { status: string }) {
  const config = {
    green: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Ready to Train' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Moderate Fatigue' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'High Fatigue' },
    unknown: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'No Data' },
  };

  const { bg, text, label } = config[status as keyof typeof config] || config.unknown;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'purple' | 'green' | 'orange';
  description: string;
}

function StatCard({ title, value, trend, trendDirection = 'neutral', icon: Icon, color, description }: StatCardProps) {
  const colors = {
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400' },
    green: { bg: 'bg-green-500/10', icon: 'text-green-400' },
    orange: { bg: 'bg-orange-500/10', icon: 'text-orange-400' },
  };

  const TrendIcon = trendDirection === 'up' ? ArrowUpRight : trendDirection === 'down' ? ArrowDownRight : Minus;
  const trendColor = trendDirection === 'up' ? 'text-green-400' : trendDirection === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-400">{title}</span>
        <Icon className={`w-5 h-5 ${colors[color].icon}`} />
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-semibold text-white">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">{description}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-medium text-white">{value}</p>
    </div>
  );
}
