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
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'high':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
    case 'low':
      return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    default:
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }
}

export function riskScoreColor(score: number) {
  if (score >= 80) return '#ef4444'; // Red
  if (score >= 60) return '#f59e0b'; // Amber
  if (score >= 40) return '#eab308'; // Yellow
  return '#10b981'; // Emerald
}