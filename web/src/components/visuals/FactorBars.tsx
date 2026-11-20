import { motion, useReducedMotion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { humanizeFeature } from '../../lib/format'
import type { TopFactor } from '../../lib/types'

interface FactorBarsProps {
  factors: TopFactor[]
  emptyLabel?: string
}

export function FactorBars({ factors, emptyLabel = 'No factor explanation returned.' }: FactorBarsProps) {
  const reduced = useReducedMotion()
  if (factors.length === 0) {
    return <p className="text-[13px] text-faint">{emptyLabel}</p>
  }
  const max = Math.max(...factors.map((factor) => Math.abs(factor.impact)), 0.001)

  return (
    <ul className="space-y-2.5">
      {factors.map((factor) => {
        const positive = factor.impact >= 0
        const width = Math.max(4, (Math.abs(factor.impact) / max) * 50)
        const Icon = positive ? ArrowUpRight : ArrowDownRight
        return (
          <li key={factor.feature} className="grid grid-cols-[minmax(0,1fr)_96px_64px] items-center gap-2">
            <span className="truncate text-[12px] text-muted" title={humanizeFeature(factor.feature)}>
              {humanizeFeature(factor.feature)}
            </span>
            <span
              className="relative block h-3 rounded-sm bg-surface-2"
              aria-hidden="true"
              title={`${humanizeFeature(factor.feature)}: ${factor.impact.toFixed(3)}`}
            >
              <span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
              <motion.span
                className={`absolute inset-y-0 ${positive ? 'rounded-r-sm bg-danger/70' : 'rounded-l-sm bg-success/70'}`}
                style={positive ? { left: '50%' } : { right: '50%' }}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            <span
              className={`mono inline-flex items-center justify-end gap-1 text-[11px] ${
                positive ? 'text-danger' : 'text-success'
              }`}
            >
              <Icon size={11} aria-hidden="true" />
              {positive ? '+' : '−'}
              {Math.abs(factor.impact).toFixed(2)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
