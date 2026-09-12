import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'flat';
  description?: string;
  color?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, description }: StatsCardProps) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-muted">{title}</span>
        <div className="p-1 rounded bg-bg-inset text-text-muted border border-border-subtle">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold font-mono tracking-tight text-text-primary">{value}</span>
          {trend && (
            <span className={cn(
              "text-xs font-mono font-medium",
              trend === 'up' ? "text-amber-400" : trend === 'down' ? "text-emerald-400" : "text-text-faint"
            )}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
            </span>
          )}
        </div>
        {description && (
          <p className="text-2xs text-text-faint mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}