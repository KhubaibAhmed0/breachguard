"use client";

import { riskScoreColor } from '@/lib/utils';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface RiskScoreGaugeProps {
  score: number;
}

export function RiskScoreGauge({ score }: RiskScoreGaugeProps) {
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ];

  const color = riskScoreColor(score);

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={52}
            outerRadius={68}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell key="cell-0" fill={color} />
            <Cell key="cell-1" fill="#27272a" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
        <span className="text-3xl font-semibold tracking-tight text-white">{score}</span>
        <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Security rating</span>
      </div>
    </div>
  );
}