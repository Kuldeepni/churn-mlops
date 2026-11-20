import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import type { ApiStatus } from '../../hooks/useApiStatus'

interface DemoBannerProps {
  status: ApiStatus
  onRetry: () => void
}

export function DemoBanner({ status, onRetry }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (status === 'online') setDismissed(false)
  }, [status])

  if (status !== 'offline' || dismissed) return null

  return (
    <div role="status" className="border-b border-warning/20 bg-warning-soft">
      <div className="container-page flex items-center gap-3 py-2.5 text-[12px] leading-5 text-warning">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          The free-tier API is asleep. Showing precomputed predictions from real test-set customers.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
        >
          <RefreshCw size={12} aria-hidden="true" />
          Retry
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss demo mode notice"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
