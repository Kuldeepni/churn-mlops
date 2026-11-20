import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, ArrowUpRight, Github, ShieldCheck, Target } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { formatCompactCurrency, formatNumber, formatPercent } from '../../lib/format'
import type { Example, MetricsPayload } from '../../lib/types'
import { buttonClass } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { FactorBars } from '../visuals/FactorBars'
import { Gauge } from '../visuals/Gauge'

interface HeroProps {
  metrics: MetricsPayload | null
  examples: Example[] | null
  testCount: number | null
}

export function Hero({ metrics, examples, testCount }: HeroProps) {
  const reduced = useReducedMotion()
  const test = metrics?.test
  const threshold = metrics?.threshold.threshold ?? test?.threshold ?? 0.18

  const picks = useMemo(() => {
    if (!examples?.length) return []
    const byBand = (band: Example['risk_band']) => examples.find((example) => example.risk_band === band)
    const chosen = [byBand('high'), byBand('medium'), byBand('low')].filter(Boolean) as Example[]
    return chosen.length ? chosen : examples.slice(0, 3)
  }, [examples])

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || picks.length < 2) return
    const timer = setInterval(() => setIndex((value) => (value + 1) % picks.length), 6000)
    return () => clearInterval(timer)
  }, [paused, picks.length])

  useEffect(() => {
    if (index >= picks.length) setIndex(0)
  }, [index, picks.length])

  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  const stats = [
    {
      label: 'PR-AUC',
      value: test ? formatNumber(test.pr_auc, 3) : null,
      note: 'held-out test',
    },
    {
      label: 'Recall',
      value: test ? formatPercent(test.recall, 1) : null,
      note: `at cutoff ${threshold.toFixed(2)}`,
    },
    {
      label: 'Extra profit',
      value: test ? formatCompactCurrency(test.net_benefit_per_1000) : null,
      note: 'per 1,000 customers',
    },
    {
      label: 'Tests',
      value: testCount ? String(testCount) : null,
      note: 'CI on every push',
    },
  ]

  return (
    <section id="top" className="relative overflow-hidden border-b border-border">
      <div className="hero-grid absolute inset-0" aria-hidden="true" />
      <div className="hero-glow absolute inset-x-0 top-0 h-[520px]" aria-hidden="true" />
      <div className="container-page relative pb-16 pt-12 md:pb-24 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-14">
          <div>
            <motion.div {...enter(0)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-3 py-1.5 text-[11px] font-semibold tracking-[0.02em] text-accent">
                <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                Open-source MLOps case study
              </span>
            </motion.div>

            <h1 className="display mt-6 text-[clamp(3rem,1.7rem+5.4vw,5.4rem)] leading-[0.94] tracking-[-0.045em] text-ink">
              <span className="block overflow-hidden pb-1">
                <motion.span
                  className="block"
                  initial={reduced ? false : { y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  Predict churn.
                </motion.span>
              </span>
              <span className="block overflow-hidden pb-1">
                <motion.span
                  className="block"
                  initial={reduced ? false : { y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.75, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  Decide by <em className="text-accent">profit.</em>
                </motion.span>
              </span>
            </h1>

            <motion.p {...enter(0.3)} className="mt-5 max-w-[48ch] text-[17px] leading-[1.6] text-muted text-pretty">
              A production-grade pipeline that turns calibrated probabilities into retention decisions that
              maximise expected profit — with experiment tracking, CI/CD and drift monitoring.
            </motion.p>

            <motion.div {...enter(0.4)} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#predict" className={buttonClass('primary', 'group')}>
                Try the live model
                <ArrowRight
                  size={15}
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
              <a
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClass('secondary')}
              >
                <Github size={14} aria-hidden="true" />
                Read the source
              </a>
            </motion.div>

            <motion.div {...enter(0.5)} className="mt-10 border-t border-border pt-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:items-start sm:gap-0">
                {stats.map((stat, statIndex) => (
                  <div
                    key={stat.label}
                    className={
                      statIndex === 0
                        ? 'sm:pr-6'
                        : 'sm:border-l sm:border-border sm:px-6 sm:last:pr-0'
                    }
                  >
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
                      {stat.label}
                    </dt>
                    <dd className="mt-1.5">
                      {stat.value ? (
                        <span className="mono text-[19px] font-medium leading-none text-ink">{stat.value}</span>
                      ) : (
                        <Skeleton className="h-4 w-14" />
                      )}
                      <span className="mt-1 block text-[10px] leading-4 text-faint">{stat.note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[11px] text-faint">
                Held-out test set · {test?.n_test ?? 1409} customers · evaluated once
              </p>
            </motion.div>
          </div>

          <motion.div
            {...enter(0.35)}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <HeroPreview
              picks={picks}
              index={index}
              setIndex={setIndex}
              threshold={threshold}
              loading={!examples}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function HeroPreview({
  picks,
  index,
  setIndex,
  threshold,
  loading,
}: {
  picks: Example[]
  index: number
  setIndex: (index: number) => void
  threshold: number
  loading: boolean
}) {
  const example = picks[index]
  const reduced = useReducedMotion()

  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" aria-hidden="true" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="overline">Customer record</div>
          <div className="mt-1 text-[13px] font-medium text-ink">Held-out test set</div>
        </div>
        <div className="mono text-right text-[10px] leading-4 text-faint">
          <div>{String(index + 1).padStart(2, '0')} / {String(Math.max(picks.length, 3)).padStart(2, '0')}</div>
          <div className="text-accent">precomputed</div>
        </div>
      </div>

      <div className="mt-4 rounded-[10px] border border-border bg-bg/60 p-4">
        {loading || !example ? (
          <div className="space-y-3">
            <Skeleton className="mx-auto h-24 w-48 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Gauge value={example.churn_probability} threshold={threshold} />

              <div className="mt-2 flex items-center justify-between gap-3">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    example.will_churn
                      ? 'border-danger/30 bg-danger-soft text-danger'
                      : 'border-success/30 bg-success-soft text-success'
                  }`}
                >
                  {example.will_churn ? (
                    <Target size={11} aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={11} aria-hidden="true" />
                  )}
                  {example.will_churn ? 'Target' : 'Hold'}
                </div>
                <span className="mono text-[10px] text-faint">
                  cutoff {threshold.toFixed(2)}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.08em] text-faint">Contract</dt>
                  <dd className="truncate text-[12px] text-ink">{example.features.Contract}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.08em] text-faint">Tenure</dt>
                  <dd className="mono text-[12px] text-ink">{example.features.tenure} mo</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.08em] text-faint">Monthly</dt>
                  <dd className="mono text-[12px] text-ink">${example.features.MonthlyCharges.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.08em] text-faint">Internet</dt>
                  <dd className="truncate text-[12px] text-ink">{example.features.InternetService}</dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-faint">Why</span>
                  <span className="mono text-[10px] text-faint">SHAP · top 3</span>
                </div>
                <FactorBars factors={example.top_factors} />
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-label="Example customers">
          {picks.map((pick, dotIndex) => (
            <button
              key={`${pick.churn_probability}-${dotIndex}`}
              type="button"
              aria-pressed={dotIndex === index}
              aria-label={`Show example ${dotIndex + 1}, ${pick.risk_band} risk`}
              onClick={() => setIndex(dotIndex)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                dotIndex === index ? 'w-5 bg-accent' : 'w-1.5 bg-border-strong hover:bg-faint'
              }`}
            />
          ))}
        </div>
        <a
          href="#predict"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
        >
          Run your own
          <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}
