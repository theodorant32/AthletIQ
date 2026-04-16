import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={`rounded-2xl border border-gray-800 bg-gray-900/50 ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({ icon, title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-sky-500/10">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-lg font-medium text-white">{title}</h2>
          {description && (
            <p className="text-sm text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export function Stat({ label, value, trend, trendDirection = 'neutral' }: StatProps) {
  const trendColor = trendDirection === 'up' ? 'text-green-400' : trendDirection === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div>
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-semibold text-white">{value}</p>
        {trend && (
          <p className={`text-xs ${trendColor}`}>{trend}</p>
        )}
      </div>
    </div>
  );
}
