import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, RotateCcw } from 'lucide-react'
import { useData } from '../../lib/data'
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatNumber,
} from '../../lib/format'
import { optimizeThreshold } from '../../lib/threshold'
import type { BusinessParams, MetricsPayload, Score } from '../../lib/types'
import { Card } from '../ui/Card'
import { Slider } from '../ui/Slider'
import { Skeleton } from '../ui/Skeleton'
import { SectionHeader } from '../visuals/SectionHeader'

interface ImpactProps {
  metrics: MetricsPayload | null
}

export function Impact({ metrics }: ImpactProps) {
  const { data: scores } = useData<Score[]>('validation_scores.json')
  const { data: params } = useData<BusinessParams>('business_params.json')
  const deployed = metrics?.threshold.threshold ?? 0.18

  const [clv, setClv] = useState(1200)
  const [offerCost, setOfferCost] = useState(60)
  const [successRate, setSuccessRate] = useState(0.35)
  const [baseSize, setBaseSize] = useState(100_000)
  const loadedParams = useRef(false)

  useEffect(() => {
    if (!params || loadedParams.current) return
    setClv(params.customer_lifetime_value)
    setOfferCost(params.retention_offer_cost)
    setSuccessRate(params.offer_success_rate)
    loadedParams.current = true
  }, [params])

  const optimum = useMemo(() => {
    if (!scores?.length) return null
    return optimizeThreshold(
      scores,
      {
        clv,
        offerCost,
        successRate,
        baseSize,
        min: params?.sweep_min ?? 0.01,
        max: params?.sweep_max ?? 0.99,
        steps: params?.sweep_steps ?? 99,
      },
      deployed,
    )
  }, [scores, clv, offerCost, successRate, baseSize, params, deployed])

  const reset = () => {
    setClv(params?.customer_lifetime_value ?? 1200)
    setOfferCost(params?.retention_offer_cost ?? 60)
    setSuccessRate(params?.offer_success_rate ?? 0.35)
    setBaseSize(100_000)
  }

  return (
    <section id="impact" className="border-b border-border py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          overline="Business impact"
          title={
            <>
              What it is <em className="text-accent">worth.</em>
            </>
          }
          description="Accuracy is the wrong objective. A cutoff of 0.5 leaves money on the table because a missed churner and a wasted offer do not cost the same."
          aside={
            <div className="mono text-right text-[10px] leading-5 text-faint">
              <div>deployed cutoff <span className="text-ink">{deployed.toFixed(2)}</span></div>
              <div>{scores?.length ?? '—'} validation customers</div>
            </div>
          }
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="overline">Assumptions</div>
                <h3 className="mt-1 text-[15px] font-semibold text-ink">Unit economics</h3>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] text-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <RotateCcw size={12} aria-hidden="true" />
                Reset
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <Slider
                label="Customer lifetime value"
                value={clv}
                onValueChange={setClv}
                min={200}
                max={5000}
                step={50}
                format={(value) => formatCurrency(value)}
                hint="if retained"
              />
              <Slider
                label="Retention offer cost"
                value={offerCost}
                onValueChange={setOfferCost}
                min={10}
                max={300}
                step={5}
                format={(value) => formatCurrency(value)}
                hint="per targeted customer"
              />
              <Slider
                label="Offer success rate"
                value={successRate}
                onValueChange={setSuccessRate}
                min={0.05}
                max={0.9}
                step={0.05}
                format={(value) => `${(value * 100).toFixed(0)}%`}
                hint="if the customer would churn"
              />
              <Slider
                label="Customer base"
                value={baseSize}
                onValueChange={setBaseSize}
                min={10_000}
                max={1_000_000}
                step={10_000}
                format={(value) => formatCompactNumber(value)}
                hint="customers"
              />
            </div>

            <div className="mt-6 border-t border-border pt-4 text-[11px] leading-5 text-faint">
              The sweep applies each cutoff to the {scores?.length ?? 1409} validation customers and uses their
              true outcomes. Value of a targeted churner:{' '}
              <span className="mono text-muted">
                {formatCurrency(clv * successRate - offerCost)}
              </span>
              . Cost of a targeted non-churner:{' '}
              <span className="mono text-muted">{formatCurrency(-offerCost)}</span>.
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            {optimum ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <div className="overline">Live optimum</div>
                    <div className="display mt-1 text-[clamp(3.5rem,7vw,5.5rem)] leading-[0.85] tracking-[-0.05em] text-ink">
                      {optimum.optimum.toFixed(2)}
                    </div>
                    <p className="mt-2 text-[12px] text-muted">
                      <span className="mono text-ink">{formatCompactCurrency(optimum.optimumPer1000)}</span> net
                      benefit per 1,000 customers
                    </p>
                  </div>
                  <div className="text-right text-[11px] leading-5 text-faint">
                    <div>
                      at deployed cutoff <span className="mono text-ink">{deployed.toFixed(2)}</span>
                    </div>
                    <div className="mono text-[13px] text-muted">
                      {formatCompactCurrency(optimum.atDeployedPer1000)} / 1k
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5">
                      <span className="h-px w-4 bg-accent" aria-hidden="true" />
                      live optimum
                      <span className="ml-2 h-px w-4 border-t border-dashed border-faint" aria-hidden="true" />
                      deployed
                    </div>
                  </div>
                </div>

                <figure className="mt-6" aria-label="Expected net benefit by decision threshold">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={optimum.curve} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                        <XAxis
                          dataKey="threshold"
                          type="number"
                          domain={[0.01, 0.99]}
                          ticks={[0.01, 0.25, 0.5, 0.75, 0.99]}
                          tickFormatter={(value: number) => value.toFixed(2)}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(value: number) => formatCompactCurrency(value)}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={52}
                        />
                        <RechartsTooltip content={<ProfitTooltip />} />
                        <ReferenceLine x={deployed} stroke="var(--text-faint)" strokeDasharray="3 4" />
                        <ReferenceLine x={optimum.optimum} stroke="var(--accent)" strokeDasharray="4 4" />
                        <Area
                          type="monotone"
                          dataKey="per1000"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          fill="url(#profitFill)"
                          isAnimationActive
                          animationDuration={700}
                          dot={false}
                          activeDot={{ r: 3, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
                    <span>Decision threshold</span>
                    <span>
                      Recomputed in your browser. The deployed cutoff comes from the pipeline&apos;s own
                      validation run.
                    </span>
                  </figcaption>
                </figure>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ProfitKpi
                    label="Profit at optimum"
                    value={formatCompactCurrency(optimum.profitAtOptimum)}
                    note={`${formatCompactNumber(baseSize)} customers`}
                  />
                  <ProfitKpi
                    label="vs naive 0.5"
                    value={formatCompactCurrency(optimum.profitAtOptimum - optimum.profitAtHalf)}
                    note={`${formatCompactCurrency(optimum.profitAtHalf)} at 0.5`}
                    positive={optimum.profitAtOptimum >= optimum.profitAtHalf}
                  />
                  <ProfitKpi
                    label="vs target everyone"
                    value={formatCompactCurrency(optimum.profitAtOptimum - optimum.profitTargetAll)}
                    note={`${formatCompactCurrency(optimum.profitTargetAll)} if all targeted`}
                    positive={optimum.profitAtOptimum >= optimum.profitTargetAll}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <Skeleton className="h-16 w-40" />
                <Skeleton className="h-[280px] w-full" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}

function ProfitKpi({
  label,
  value,
  note,
  positive,
}: {
  label: string
  value: string
  note: string
  positive?: boolean
}) {
  return (
    <div className="rounded-[10px] border border-border bg-bg/40 p-3.5">
      <div className="text-[10px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="mono mt-1.5 text-[18px] font-medium text-ink">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-[10px] text-faint">
        {positive != null ? (
          positive ? (
            <ArrowUpRight size={11} className="text-success" aria-hidden="true" />
          ) : (
            <ArrowDownRight size={11} className="text-danger" aria-hidden="true" />
          )
        ) : null}
        {note}
      </div>
    </div>
  )
}

function ProfitTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] shadow-[0_12px_36px_rgba(0,0,0,0.3)]">
      <div className="text-faint">
        Cutoff <span className="mono text-ink">{formatNumber(Number(label), 2)}</span>
      </div>
      <div className="mono mt-0.5 text-[13px] text-ink">
        {formatCurrency(Number(payload[0].value))} <span className="text-[10px] text-faint">/ 1,000</span>
      </div>
    </div>
  )
}
