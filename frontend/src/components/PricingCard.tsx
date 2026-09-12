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
      "relative p-6 rounded-lg bg-zinc-900/40 border flex flex-col transition-colors",
      isPopular ? "border-zinc-700 bg-zinc-900/60" : "border-zinc-800"
    )}>
      {isPopular && (
        <span className="absolute -top-2.5 left-6 px-2 py-0.5 bg-zinc-100 text-zinc-950 text-[10px] font-mono font-semibold uppercase tracking-normal rounded">
          {badge}
        </span>
      )}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-zinc-400 mt-1 min-h-[32px] leading-relaxed">{description}</p>
        )}
      </div>
      <div className="mb-5 flex items-baseline gap-1">
        <span className="text-3xl font-bold font-mono text-zinc-100 tracking-tight">{price}</span>
        {price !== 'Custom' && <span className="text-xs text-zinc-500 font-mono">/ month</span>}
      </div>
      <ul className="space-y-2.5 mb-6 flex-1 text-xs">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2.5 text-zinc-300">
            <Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
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
              "w-full py-2 px-3.5 rounded-md text-xs font-medium transition-colors text-center block cursor-pointer",
              isPopular 
                ? "bg-zinc-100 hover:bg-white text-zinc-950" 
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            )}
          >
            {ctaText}
          </button>
        ) : (
          <Link 
            href={ctaHref}
            className={cn(
              "w-full py-2 px-3.5 rounded-md text-xs font-medium transition-colors text-center block",
              isPopular 
                ? "bg-zinc-100 hover:bg-white text-zinc-950" 
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            )}
          >
            {ctaText}
          </Link>
        )}
        {subtext && (
          <p className="text-[11px] text-zinc-500 text-center mt-2">{subtext}</p>
        )}
      </div>
    </div>
  );
}