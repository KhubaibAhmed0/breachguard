import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = (s: string) => {
    switch(s?.toLowerCase()) {
      case 'open': 
        return {
          wrapper: 'bg-rose-500/10 text-rose-300 border-rose-500/35 shadow-[0_0_10px_rgba(244,63,94,0.15)]',
          dot: 'bg-rose-400 animate-pulse shadow-[0_0_6px_rgba(251,113,133,0.8)]'
        };
      case 'acknowledged': 
      case 'investigating':
        return {
          wrapper: 'bg-amber-500/10 text-amber-300 border-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
          dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
        };
      case 'remediated': 
      case 'resolved':
        return {
          wrapper: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.14)]',
          dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
        };
      default: 
        return {
          wrapper: 'bg-zinc-900 text-zinc-400 border-zinc-750',
          dot: 'bg-zinc-500'
        };
    }
  };

  const style = getStatusStyle(status);

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-roboto font-semibold uppercase tracking-wider border backdrop-blur-sm",
      style.wrapper
    )}>
      {status}
    </span>
  );
}
