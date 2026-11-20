import { cn } from '../../lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="20" height="20" rx="6" stroke="currentColor" strokeWidth="1.3" opacity="0.75" />
        <path
          d="M4.5 15.5 8 11.5l3 1.6 5.2-6.6"
          stroke="var(--accent)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16.2" cy="6.5" r="1.4" fill="var(--accent)" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
        churn<span className="mono ml-1 text-[11px] font-normal tracking-normal text-faint">/ mlops</span>
      </span>
    </span>
  )
}
