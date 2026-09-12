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
            <stop offset="5%" stopColor="#71717a" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />
        <XAxis dataKey="month" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#121215', borderColor: '#27272a', color: '#e4e4e7', fontSize: '11px', borderRadius: '6px' }}
          itemStyle={{ color: '#a1a1aa' }}
        />
        <Area 
          type="monotone" 
          dataKey="count" 
          stroke="#a1a1aa" 
          strokeWidth={1.5}
          fillOpacity={1} 
          fill="url(#colorCount)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
