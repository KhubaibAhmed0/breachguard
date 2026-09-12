import { cn } from '@/lib/utils';

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toLowerCase();
  const getBadgeStyle = () => {
    switch (s) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/25';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      case 'low':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      default:
        return 'bg-zinc-850 text-zinc-400 border-zinc-800';
    }
  };

  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium uppercase tracking-normal border",
      getBadgeStyle()
    )}>
      {severity}
    </span>
  );
}
