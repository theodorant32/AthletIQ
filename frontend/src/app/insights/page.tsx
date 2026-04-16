'use client';

import { useQuery } from '@tanstack/react-query';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Insight {
  id: string;
  insight_type: string;
  title: string;
  description: string | null;
  severity: string | null;
  created_at: string;
}

export default function InsightsPage() {
  const { data: insights, isLoading } = useQuery<{ insights: Insight[] }>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch('http://localhost:4000/api/insights');
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

  const getIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <TrendingUp className="w-6 h-6 text-green-400" />;
      case 'recovery':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      case 'recommendation':
        return <Lightbulb className="w-6 h-6 text-blue-400" />;
      default:
        return <CheckCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-500/50 bg-red-500/10';
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'low':
        return 'border-blue-500/50 bg-blue-500/10';
      default:
        return 'border-gray-500/50 bg-gray-500/10';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Insights</h1>
        <p className="text-gray-400 mt-1">AI-generated insights from your training data</p>
      </div>

      {(!insights?.insights || insights.insights.length === 0) ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="p-4 rounded-2xl bg-yellow-500/10 mb-4">
            <Lightbulb className="w-10 h-10 text-yellow-400" />
          </div>
          <p className="text-lg font-medium text-white mb-2">No insights yet</p>
          <p className="text-sm text-gray-400 max-w-sm">
            Complete some workouts and we'll start generating personalized insights about your training
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-5 rounded-2xl border ${getSeverityColor(insight.severity || '')}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl ${
                  insight.insight_type === 'performance' ? 'bg-green-500/10' :
                  insight.insight_type === 'recovery' ? 'bg-yellow-500/10' :
                  'bg-blue-500/10'
                }`}>
                  {getIcon(insight.insight_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-base font-semibold text-white">
                      {insight.title}
                    </h3>
                    {insight.severity && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${
                        insight.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                        insight.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {insight.severity}
                      </span>
                    )}
                  </div>
                  {insight.description && (
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">{insight.description}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {format(new Date(insight.created_at), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
