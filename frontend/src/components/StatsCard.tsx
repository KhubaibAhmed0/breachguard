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
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-400">{title}</span>
        <div className="p-1 rounded bg-zinc-850 text-zinc-400 border border-zinc-800">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold font-mono tracking-tight text-zinc-100">{value}</span>
          {trend && (
            <span className={cn(
              "text-xs font-mono font-medium",
              trend === 'up' ? "text-amber-400" : trend === 'down' ? "text-emerald-400" : "text-zinc-500"
            )}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-zinc-500 mt-1 font-roboto">{description}</p>
        )}
      </div>
    </div>
  );
}