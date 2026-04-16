'use client';

import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, Heart } from 'lucide-react';

interface Metric {
  date: string;
  ctl_score: number | null;
  atl_score: number | null;
  tsb_score: number | null;
  total_distance_meters: number | null;
  avg_heart_rate: number | null;
  recovery_status: string | null;
}

export default function ProgressPage() {
  const { data: metrics, isLoading } = useQuery<{ metrics: Metric[] }>({
    queryKey: ['metrics', 30],
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/metrics?days=30');
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

  const chartData = metrics?.metrics?.map(m => ({
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ctl: m.ctl_score ?? 0,
    atl: m.atl_score ?? 0,
    tsb: m.tsb_score ?? 0,
    distance: (m.total_distance_meters ?? 0) / 1000,
  })) || [];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Progress</h1>

      {/* CTL/ATL/TSB Chart */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-semibold">Fitness & Form</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Area type="monotone" dataKey="ctl" stroke="#3B82F6" fill="#3B82F633" name="CTL (Fitness)" />
              <Area type="monotone" dataKey="atl" stroke="#F59E0B" fill="#F59E0B33" name="ATL (Fatigue)" />
              <Line type="monotone" dataKey="tsb" stroke="#10B981" name="TSB (Form)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Distance */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-6 h-6 text-green-400" />
          <h2 className="text-lg font-semibold">Daily Distance</h2>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Bar dataKey="distance" fill="#10B981" name="Distance (km)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recovery Status Timeline */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 mb-4">
          <Heart className="w-6 h-6 text-red-400" />
          <h2 className="text-lg font-semibold">Recovery Timeline</h2>
        </div>
        <div className="flex gap-1 flex-wrap">
          {metrics?.metrics?.slice(-21).map((m, i) => (
            <div
              key={m.date}
              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium
                ${m.recovery_status === 'green' ? 'bg-green-500/20 text-green-400 border border-green-500' : ''}
                ${m.recovery_status === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' : ''}
                ${m.recovery_status === 'red' ? 'bg-red-500/20 text-red-400 border border-red-500' : ''}
                ${!m.recovery_status || m.recovery_status === 'unknown' ? 'bg-gray-500/20 text-gray-400 border border-gray-500' : ''}
              `}
              title={new Date(m.date).toLocaleDateString()}
            >
              {new Date(m.date).getDate()}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500/20 border border-green-500"></span> Green
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500"></span> Yellow
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500"></span> Red
          </span>
        </div>
      </div>
    </div>
  );
}
