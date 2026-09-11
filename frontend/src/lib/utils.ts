import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, formatStr: string = "MMM d, yyyy") {
  try {
    return format(new Date(date), formatStr);
  } catch {
    return String(date);
  }
}

export function severityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-rose-500/10 text-rose-300 border border-rose-500/35 shadow-[0_0_12px_rgba(244,63,94,0.18)]';
    case 'high':
      return 'bg-orange-500/10 text-orange-300 border border-orange-500/35 shadow-[0_0_12px_rgba(249,115,22,0.18)]';
    case 'medium':
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.18)]';
    case 'low':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.14)]';
    default:
      return 'bg-zinc-900 text-zinc-400 border border-zinc-750';
  }
}

export function riskScoreColor(score: number) {
  if (score >= 80) return '#f43f5e'; // Rose
  if (score >= 60) return '#f97316'; // Orange
  if (score >= 40) return '#f59e0b'; // Amber
  return '#10b981'; // Emerald
}