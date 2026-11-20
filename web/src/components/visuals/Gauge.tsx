import { motion, useReducedMotion } from 'motion/react'

interface GaugeProps {
  value: number | null
  threshold: number
  label?: string
}

const RADIUS = 96
const LENGTH = Math.PI * RADIUS

export function Gauge({ value, threshold, label = 'Churn probability' }: GaugeProps) {
  const reduced = useReducedMotion()
  const pct = value == null ? 0 : Math.min(1, Math.max(0, value))
  const color =
    value == null
      ? 'var(--border-strong)'
      : pct >= Math.max(0.5, threshold * 1.8)
        ? 'var(--danger)'
        : pct >= threshold
          ? 'var(--warning)'
          : 'var(--success)'

  const angle = Math.PI - pct * Math.PI
  const dotX = 120 + RADIUS * Math.cos(angle)
  const dotY = 120 - RADIUS * Math.sin(angle)
  const tickAngle = Math.PI - Math.min(1, Math.max(0, threshold)) * Math.PI
  const tickX = 120 + (RADIUS + 9) * Math.cos(tickAngle)
  const tickY = 120 - (RADIUS + 9) * Math.sin(tickAngle)

  return (
    <div
      role="img"
      aria-label={
        value == null
          ? `${label}: no prediction yet. Decision threshold ${threshold.toFixed(2)}.`
          : `${label}: ${(pct * 100).toFixed(1)} percent. Decision threshold ${threshold.toFixed(2)}.`
      }
      className="relative mx-auto w-full max-w-[260px]"
    >
      <svg viewBox="0 0 240 146" className="w-full" aria-hidden="true">
        <path
          d="M 24 120 A 96 96 0 0 1 216 120"
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <motion.path
          d="M 24 120 A 96 96 0 0 1 216 120"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${pct * LENGTH} ${LENGTH}`}
          initial={reduced ? false : { strokeDasharray: `0 ${LENGTH}` }}
          animate={{ strokeDasharray: `${pct * LENGTH} ${LENGTH}` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <line
          x1={tickX}
          y1={tickY}
          x2={120 + (RADIUS + 16) * Math.cos(tickAngle)}
          y2={120 - (RADIUS + 16) * Math.sin(tickAngle)}
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {value != null ? <circle cx={dotX} cy={dotY} r="4.5" fill={color} stroke="var(--bg)" strokeWidth="2" /> : null}
        <text
          x="120"
          y="98"
          textAnchor="middle"
          style={{
            fill: 'var(--text)',
            fontFamily: '"JetBrains Mono Variable", monospace',
            fontSize: 38,
            fontWeight: 500,
            letterSpacing: '-0.04em',
          }}
        >
          {value == null ? '—' : `${(pct * 100).toFixed(0)}%`}
        </text>
        <text
          x="120"
          y="119"
          textAnchor="middle"
          style={{
            fill: 'var(--text-faint)',
            fontFamily: '"Instrument Sans Variable", sans-serif',
            fontSize: 11,
            letterSpacing: '0.02em',
          }}
        >
          {label.toLowerCase()}
        </text>
      </svg>
      <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-faint">
        <span className="mono">0.00</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-px bg-accent" aria-hidden="true" />
          cutoff <span className="mono text-accent">{threshold.toFixed(2)}</span>
        </span>
        <span className="mono">1.00</span>
      </div>
    </div>
  )
}
