import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = (s: string) => {
    switch(s.toLowerCase()) {
      case 'open': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'acknowledged': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'remediated': return 'bg-green-500/10 text-green-400 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
      getStatusStyle(status)
    )}>
      {status}
    </span>
  );
}
