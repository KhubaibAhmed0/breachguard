"use client";

import { ExposureStats } from '@/types';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface SeverityDonutProps {
  data?: ExposureStats;
}

export function SeverityDonut({ data }: SeverityDonutProps) {
  if (!data) return null;

  const chartData = [
    { name: 'Critical', value: data.critical, color: '#ef4444' },
    { name: 'High', value: data.high, color: '#f97316' },
    { name: 'Medium', value: data.medium, color: '#eab308' },
    { name: 'Low', value: data.low, color: '#3b82f6' },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', color: '#f3f4f6', borderRadius: '0.5rem' }}
          itemStyle={{ color: '#fff' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
