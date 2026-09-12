"use client";

import { ExposureStats } from '@/types';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldCheck } from 'lucide-react';

interface SeverityDonutProps {
  data?: ExposureStats;
}

export function SeverityDonut({ data }: SeverityDonutProps) {
  if (!data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-text-faint text-xs">
        Loading severity distribution...
      </div>
    );
  }

  const total = (data.critical || 0) + (data.high || 0) + (data.medium || 0) + (data.low || 0);

  if (total === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
        <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center mb-2">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <span className="text-xs font-semibold text-text-secondary">0 Active Exposures</span>
        <p className="text-2xs text-text-faint mt-0.5 max-w-[180px] leading-tight">
          No critical, high, or medium credential threats detected.
        </p>
      </div>
    );
  }

  const chartData = [
    { name: 'Critical', value: data.critical, color: '#ef4444' },
    { name: 'High', value: data.high, color: '#f97316' },
    { name: 'Medium', value: data.medium, color: '#eab308' },
    { name: 'Low', value: data.low, color: '#22c55e' },
  ].filter(d => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={4}
          dataKey="value"
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ backgroundColor: '#111113', borderColor: '#27272a', color: '#d4d4d8', fontSize: '10px', borderRadius: '6px' }}
          itemStyle={{ color: '#fafafa' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
