"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const mockTimelineData = [
  { month: 'Jan', count: 12 },
  { month: 'Feb', count: 19 },
  { month: 'Mar', count: 15 },
  { month: 'Apr', count: 25 },
  { month: 'May', count: 22 },
  { month: 'Jun', count: 30 },
  { month: 'Jul', count: 28 },
  { month: 'Aug', count: 35 },
  { month: 'Sep', count: 42 },
  { month: 'Oct', count: 38 },
  { month: 'Nov', count: 45 },
  { month: 'Dec', count: 50 },
];

export function ExposureChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={mockTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis dataKey="month" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
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
