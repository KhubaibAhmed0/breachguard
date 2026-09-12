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
      "relative p-6 rounded-lg bg-bg-surface border flex flex-col transition-colors",
      isPopular ? "border-border-strong bg-bg-surface" : "border-border-default"
    )}>
      {isPopular && (
        <span className="absolute -top-2.5 left-6 px-2 py-0.5 bg-accent text-accent-text text-2xs font-mono font-semibold uppercase tracking-normal rounded">
          {badge}
        </span>
      )}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-text-muted mt-1 min-h-[32px] leading-relaxed">{description}</p>
        )}
      </div>
      <div className="mb-5 flex items-baseline gap-1">
        <span className="text-3xl font-bold font-mono text-text-primary tracking-tight">{price}</span>
        {price !== 'Custom' && <span className="text-xs text-text-faint font-mono">/ month</span>}
      </div>
      <ul className="space-y-2.5 mb-6 flex-1 text-xs">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2.5 text-text-secondary">
            <Check className="w-3.5 h-3.5 text-text-muted shrink-0" />
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
                ? "bg-accent hover:bg-accent-hover text-accent-text" 
                : "bg-border-strong hover:bg-border-strong text-text-secondary"
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
                ? "bg-accent hover:bg-accent-hover text-accent-text" 
                : "bg-border-strong hover:bg-border-strong text-text-secondary"
            )}
          >
            {ctaText}
          </Link>
        )}
        {subtext && (
          <p className="text-2xs text-text-faint text-center mt-2">{subtext}</p>
        )}
      </div>
    </div>
  );
}