'use client';

import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, Heart } from 'lucide-react';
import { format } from 'date-fns';

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
  const { data: metrics, isLoading, error } = useQuery<{ metrics: Metric[] }>({
    queryKey: ['metrics', 30],
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/metrics?days=30');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !metrics?.metrics?.length) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-gray-400">
        No data available. Sync some activities to see your progress.
      </div>
    );
  }

  const chartData = metrics.metrics.map(m => ({
    date: format(new Date(m.date), 'MMM d'),
    ctl: m.ctl_score ?? 0,
    atl: m.atl_score ?? 0,
    tsb: m.tsb_score ?? 0,
    distance: (m.total_distance_meters ?? 0) / 1000,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Progress</h1>
        <p className="text-gray-400 mt-1">Track your fitness and training trends</p>
      </div>

      {/* Fitness & Form Chart */}
      <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Fitness & Form</h2>
              <p className="text-sm text-gray-500">CTL, ATL, and TSB over time</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-400">CTL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm text-gray-400">ATL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-400">TSB</span>
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="ctlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                tick={{ fill: '#6B7280', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6B7280"
                tick={{ fill: '#6B7280', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ color: '#F9FAFB', marginBottom: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="ctl"
                stroke="#0EA5E9"
                strokeWidth={2}
                fill="url(#ctlGradient)"
                name="CTL (Fitness)"
              />
              <Line
                type="monotone"
                dataKey="atl"
                stroke="#F97316"
                strokeWidth={2}
                dot={false}
                name="ATL (Fatigue)"
              />
              <Line
                type="monotone"
                dataKey="tsb"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="TSB (Form)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distance & Recovery Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Distance */}
        <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Daily Distance</h2>
              <p className="text-sm text-gray-500">Kilometers per day</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6B7280"
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '12px'
                  }}
                />
                <Bar
                  dataKey="distance"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  name="Distance (km)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recovery Timeline */}
        <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Heart className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Recovery Status</h2>
              <p className="text-sm text-gray-500">Daily recovery indicators</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {metrics.metrics.slice(-21).map((m) => (
              <div
                key={m.date}
                className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all hover:scale-110
                  ${m.recovery_status === 'green' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50' : ''}
                  ${m.recovery_status === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50' : ''}
                  ${m.recovery_status === 'red' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50' : ''}
                  ${!m.recovery_status || m.recovery_status === 'unknown' ? 'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/50' : ''}
                `}
                title={`${format(new Date(m.date), 'MMM d')}: ${m.recovery_status || 'unknown'}`}
              >
                <span className="text-xs">{new Date(m.date).getDate()}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500/20 ring-1 ring-green-500/50" />
              <span className="text-gray-400">Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500/20 ring-1 ring-yellow-500/50" />
              <span className="text-gray-400">Fatigued</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500/20 ring-1 ring-red-500/50" />
              <span className="text-gray-400">Exhausted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
