"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExposureTimeline } from '@/hooks/useApi';
import { Loader2 } from 'lucide-react';

export function ExposureChart() {
  const { data: timeline, isLoading } = useExposureTimeline();

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-roboto">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" />
        Loading exposure timeline...
      </div>
    );
  }

  const chartData = (timeline && timeline.length > 0) ? timeline : [
    { month: 'Past', count: 0 },
    { month: 'Current', count: 0 }
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis dataKey="month" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#f3f4f6' }}
          itemStyle={{ color: '#06b6d4' }}
        />
        <Area 
          type="monotone" 
          dataKey="count" 
          stroke="#06b6d4" 
          fillOpacity={1} 
          fill="url(#colorCount)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
