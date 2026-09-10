import { severityColor, cn } from '@/lib/utils';

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
      severityColor(severity)
    )}>
      {severity}
    </span>
  );
}
