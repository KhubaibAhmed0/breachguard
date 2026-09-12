import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import Link from 'next/link';

interface PricingCardProps {
  title: string;
  price: string;
  description?: string;
  features: string[];
  isPopular?: boolean;
  badge?: string;
  ctaText?: string;
  subtext?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
}

export function PricingCard({ 
  title, 
  price, 
  description,
  features, 
  isPopular, 
  badge = "MOST POPULAR",
  ctaText = "Get started",
  subtext,
  ctaHref = "/register",
  onCtaClick
}: PricingCardProps) {
  return (
    <div className={cn(
      "relative p-6 sm:p-7 rounded-xl bg-zinc-900/50 border flex flex-col transition-all",
      isPopular ? "border-zinc-500 shadow-xl ring-1 ring-zinc-500/40 bg-zinc-900/70" : "border-zinc-800/80"
    )}>
      {isPopular && (
        <span className="absolute -top-2.5 left-6 px-2.5 py-0.5 bg-zinc-100 text-zinc-950 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
          {badge}
        </span>
      )}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-zinc-400 mt-1 min-h-[32px] leading-snug">{description}</p>
        )}
      </div>
      <div className="mb-5 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white tracking-tight">{price}</span>
        {price !== 'Custom' && <span className="text-xs text-zinc-400">/ month</span>}
      </div>
      <ul className="space-y-3 mb-6 flex-1 text-xs">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2.5 text-zinc-300">
            <Check className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div>
        {onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className={cn(
              "w-full py-2.5 px-3.5 rounded-lg text-xs font-semibold transition-colors text-center block cursor-pointer",
              isPopular 
                ? "bg-zinc-100 hover:bg-white text-zinc-950 shadow" 
                : "bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200"
            )}
          >
            {ctaText}
          </button>
        ) : (
          <Link 
            href={ctaHref}
            className={cn(
              "w-full py-2.5 px-3.5 rounded-lg text-xs font-semibold transition-colors text-center block",
              isPopular 
                ? "bg-zinc-100 hover:bg-white text-zinc-950 shadow" 
                : "bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200"
            )}
          >
            {ctaText}
          </Link>
        )}
        {subtext && (
          <p className="text-[11px] text-zinc-500 text-center mt-2 font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
}