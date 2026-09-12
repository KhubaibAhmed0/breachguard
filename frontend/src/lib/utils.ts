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
      return 'bg-red-500/8 text-red-300 border border-red-500/20';
    case 'high':
      return 'bg-orange-500/8 text-orange-300 border border-orange-500/20';
    case 'medium':
      return 'bg-yellow-500/8 text-yellow-300 border border-yellow-500/20';
    case 'low':
      return 'bg-green-500/8 text-green-300 border border-green-500/20';
    default:
      return 'bg-bg-inset text-text-muted border border-border-default';
  }
}

export function riskScoreColor(score: number) {
  if (score >= 75) return '#ef4444'; // Critical (red)
  if (score >= 60) return '#f97316'; // High (orange)
  if (score >= 35) return '#eab308'; // Medium (yellow)
  return '#22c55e'; // Low (green)
}