import { cn } from '@/lib/utils';

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toLowerCase();
  const getBadgeStyle = () => {
    switch (s) {
      case 'critical':
        return 'bg-red-500/8 text-red-300 border-red-500/20';
      case 'high':
        return 'bg-orange-500/8 text-orange-300 border-orange-500/20';
      case 'medium':
        return 'bg-yellow-500/8 text-yellow-300 border-yellow-500/20';
      case 'low':
        return 'bg-green-500/8 text-green-300 border-green-500/20';
      default:
        return 'bg-bg-inset text-text-muted border-border-default';
    }
  };

  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-medium uppercase tracking-wide border",
      getBadgeStyle()
    )}>
      {severity}
    </span>
  );
}
