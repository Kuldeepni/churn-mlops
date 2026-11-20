import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { useData } from '../../lib/data'
import { formatNumber, formatPercent, humanizeFeature } from '../../lib/format'
import type { DriftPayload, DriftReport } from '../../lib/types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Segmented } from '../ui/Segmented'
import { Skeleton } from '../ui/Skeleton'
import { Tooltip } from '../ui/Tooltip'
import { SectionHeader } from '../visuals/SectionHeader'

type Traffic = 'no_shift' | 'shifted'

const PSI_THRESHOLD = 0.2

export function Monitoring() {
  const { data } = useData<DriftPayload>('drift_demo.json')
  const [traffic, setTraffic] = useState<Traffic>('no_shift')
  const report: DriftReport | null = data ? data[traffic] : null

  const sorted = useMemo(() => {
    if (!report) return []
    return [...report.features].sort((a, b) => b.psi - a.psi)
  }, [report])

  const maxPsi = sorted[0]?.psi ?? 0
  const scaleMax = Math.max(0.5, maxPsi * 1.08)
  const alertLine = report ? report.threshold : 0.3
  const flagged = report ? report.n_drifted : 0
  const total = report ? report.n_features : 19
  const flaggedShare = report ? report.drifted_share : 0

  return (
    <section id="monitoring" className="border-b border-border py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          overline="Knowing when it breaks"
          title={
            <>
              Drift is a number, <em className="text-accent">not a feeling.</em>
            </>
          }
          description="A model that was right last quarter can be wrong today. Every feature in the serving path is compared with the reference distribution it was trained on."
          aside={
            <a
              href={siteConfig.links.drift}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-ink"
            >
              drift.py
              <ArrowUpRight size={11} aria-hidden="true" />
            </a>
          }
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="overline">Traffic sample</div>
                <Tooltip content="Both samples are generated from the real reference statistics by monitoring/simulate.py. They are illustrative traffic, not production telemetry.">
                  <button
                    type="button"
                    aria-label="Where the traffic samples come from"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-faint transition-colors hover:text-ink"
                  >
                    <Info size={13} aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
              <div className="mt-3">
                <Segmented<Traffic>
                  label="Traffic sample"
                  value={traffic}
                  onChange={setTraffic}
                  options={[
                    { value: 'no_shift', label: 'Normal' },
                    { value: 'shifted', label: 'Shifted' },
                  ]}
                />
              </div>
              <p className="mt-3 text-[12px] leading-5 text-muted">
                {traffic === 'no_shift'
                  ? 'A fresh sample drawn from the same distribution as the reference.'
                  : 'The same sample with tenure and monthly charges pushed upward, and contracts moved toward month-to-month.'}
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="overline">Verdict</div>
                {report ? (
                  <Badge tone={report.drift_detected ? 'danger' : 'success'} dot>
                    {report.drift_detected ? 'Drift alert' : 'Within tolerance'}
                  </Badge>
                ) : (
                  <Skeleton className="h-6 w-24" />
                )}
              </div>

              <dl className="mt-4 space-y-3">
                <Stat label="Rows compared" value={report ? String(report.n_samples) : null} />
                <Stat label="Features checked" value={report ? String(total) : null} />
                <Stat
                  label="Flagged features"
                  value={report ? `${flagged} / ${total}` : null}
                  tone={flagged > 0 ? 'warning' : 'success'}
                />
                <Stat
                  label="Share flagged"
                  value={report ? formatPercent(flaggedShare, 1) : null}
                  note={`alert above ${formatPercent(alertLine, 0)}`}
                />
              </dl>

              <div className="mt-4 border-t border-border pt-4 text-[11px] leading-5 text-faint">
                {report?.drift_detected ? (
                  <span className="inline-flex items-start gap-1.5 text-danger">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                    More than {formatPercent(alertLine, 0)} of features drifted. The pipeline raises an alert.
                  </span>
                ) : (
                  <span className="inline-flex items-start gap-1.5">
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                    {flagged === 0
                      ? 'No feature crossed a drift rule in this sample.'
                      : `${flagged} of ${total} features crossed a rule, which is below the ${formatPercent(alertLine, 0)} alert line.`}
                  </span>
                )}
              </div>
            </Card>

            <div className="rounded-[10px] border border-border bg-surface px-4 py-3.5 text-[11px] leading-5 text-faint">
              <div className="font-medium text-muted">The rules</div>
              <p className="mt-1">
                A numeric feature is flagged at PSI ≥ {PSI_THRESHOLD.toFixed(2)} or KS ≥ 0.15. A categorical feature is
                flagged at PSI ≥ {PSI_THRESHOLD.toFixed(2)} or χ² p &lt; 0.01. The alert fires only when more than{' '}
                {formatPercent(alertLine, 0)} of features are flagged, so one noisy column does not page anyone.
              </p>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 md:px-5">
              <div>
                <div className="overline">Population stability index</div>
                <h3 className="mt-1 text-[14px] font-semibold text-ink">All 19 model inputs</h3>
              </div>
              <span className="mono text-[10px] text-faint">sorted by PSI · threshold {PSI_THRESHOLD.toFixed(2)}</span>
            </div>

            {report ? (
              <ul className="divide-y divide-border">
                {sorted.map((feature) => {
                  const width = Math.max(feature.psi > 0 ? 0.8 : 0, (feature.psi / scaleMax) * 100)
                  const marker = (PSI_THRESHOLD / scaleMax) * 100
                  return (
                    <li
                      key={feature.feature}
                      className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,150px)_minmax(0,1fr)_64px_64px] md:px-5"
                    >
                      <span className="truncate text-[12px] text-ink" title={humanizeFeature(feature.feature)}>
                        {humanizeFeature(feature.feature)}
                      </span>
                      <span
                        className="relative col-span-2 row-start-2 block h-2.5 overflow-hidden rounded-sm bg-bg md:col-span-1 md:row-start-auto"
                        aria-hidden="true"
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-sm"
                          style={{
                            width: `${width}%`,
                            background: feature.drifted ? 'var(--warning)' : 'var(--border-strong)',
                          }}
                        />
                        <span
                          className="absolute inset-y-0 w-px bg-danger/70"
                          style={{ left: `${Math.min(99, marker)}%` }}
                        />
                      </span>
                      <span
                        className={`mono col-start-2 row-start-1 text-right text-[11px] md:col-start-auto md:row-start-auto ${
                          feature.drifted ? 'text-warning' : 'text-muted'
                        }`}
                      >
                        {feature.psi > 0 && feature.psi < 0.001
                          ? '<0.001'
                          : formatNumber(feature.psi, 3)}
                      </span>
                      <span className="hidden text-right md:block">
                        {feature.drifted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-warning">
                            <AlertTriangle size={10} aria-hidden="true" />
                            flagged
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-[0.06em] text-faint">stable</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="space-y-3 p-5">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-6 w-full" />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-[10px] text-faint md:px-5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-px bg-danger/70" aria-hidden="true" />
                PSI {PSI_THRESHOLD.toFixed(2)} flag line
              </span>
              <span>
                {report
                  ? `${report.status === 'ok' ? 'Report complete' : report.status} · ${report.n_samples} rows`
                  : 'Loading report'}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string | null
  note?: string
  tone?: 'warning' | 'success'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-right">
        {value ? (
          <span
            className={`mono text-[14px] font-medium ${
              tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-ink'
            }`}
          >
            {value}
          </span>
        ) : (
          <Skeleton className="inline-block h-4 w-12 align-middle" />
        )}
        {note ? <span className="mt-0.5 block text-[10px] text-faint">{note}</span> : null}
      </dd>
    </div>
  )
}
