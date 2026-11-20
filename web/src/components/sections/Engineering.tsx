import { ArrowUpRight, Check, Minus } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { formatDate, formatNumber, formatPercent } from '../../lib/format'
import type { MetricsPayload, ModelComparison, PipelineStatus } from '../../lib/types'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { SectionHeader } from '../visuals/SectionHeader'
import { Reveal } from '../visuals/Reveal'

interface Fact {
  value: string
  label: string
  note: string
  href: string
}

const FACTS: Fact[] = [
  {
    value: '30',
    label: 'Tests',
    note: 'Unit and integration, including the API and drift rules.',
    href: siteConfig.links.tests,
  },
  {
    value: '69.85%',
    label: 'Coverage',
    note: 'pytest-cov, with the build failing under 65%.',
    href: siteConfig.links.ci,
  },
  {
    value: '3.10–3.12',
    label: 'Python matrix',
    note: 'Every push tests three interpreters, not just one.',
    href: siteConfig.links.ci,
  },
  {
    value: '0.60',
    label: 'PR-AUC floor',
    note: 'The evaluation gate also requires recall ≥ 0.40.',
    href: siteConfig.links.evaluate,
  },
  {
    value: '1',
    label: 'Command to rebuild',
    note: 'dvc repro skips stages whose content has not changed.',
    href: siteConfig.links.dvc,
  },
  {
    value: '0',
    label: 'Manual deploy steps',
    note: 'Pages rebuilds the data and the site on every push to main.',
    href: siteConfig.links.ci,
  },
]

const CHECKS = [
  'ruff check and ruff format --check',
  'mypy over src/churn',
  'pytest on Python 3.10, 3.11 and 3.12',
  'dvc repro from a clean checkout',
  'docker build, then curl /health',
  'Vite build, then GitHub Pages deploy',
]

export function Engineering({
  metrics,
  status,
  modelVersion,
}: {
  metrics: MetricsPayload | null
  status: PipelineStatus | null
  modelVersion: string | null
}) {
  const comparison = metrics?.comparison ?? []
  const winner = comparison.reduce<ModelComparison | null>(
    (best, entry) => (!best || entry.pr_auc_mean > best.pr_auc_mean ? entry : best),
    null,
  )

  return (
    <section id="engineering" className="border-b border-border py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          overline="Engineering"
          title={
            <>
              Built to be <em className="text-accent">trusted.</em>
            </>
          }
          description="A model is only useful if the path around it is boring: deterministic builds, a gate that can fail, and a deploy that does not need a person."
          aside={
            <div className="mono text-right text-[10px] leading-5 text-faint">
              <div>
                model <span className="text-ink">{modelVersion ?? '—'}</span>
              </div>
              <div>{status ? `trained ${formatDate(status.last_trained)}` : 'loading'}</div>
            </div>
          }
        />

        <Reveal>
          <dl className="mt-10 grid overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FACTS.map((fact) => (
              <div key={fact.label} className="bg-surface">
                <a
                  href={fact.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-full flex-col p-5 transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <dd className="display text-[clamp(2.4rem,4vw,3.1rem)] leading-[0.9] tracking-[-0.04em] text-ink">
                    {fact.value}
                  </dd>
                  <dt className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {fact.label}
                    <ArrowUpRight
                      size={11}
                      className="text-faint transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </dt>
                  <p className="mt-1.5 flex-1 text-[12px] leading-5 text-faint">{fact.note}</p>
                </a>
              </div>
            ))}
          </dl>
        </Reveal>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Reveal delay={0.05}>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 md:px-5">
                <div>
                  <div className="overline">Model selection</div>
                  <h3 className="mt-1 text-[14px] font-semibold text-ink">Five-fold cross-validation</h3>
                </div>
                <span className="mono text-[10px] text-faint">mean ± std · train split</span>
              </div>

              {comparison.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <caption className="sr-only">
                      Cross-validated metrics for each candidate model. The highest PR-AUC is shipped.
                    </caption>
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-faint">
                        <th scope="col" className="px-4 py-2.5 font-medium md:px-5">
                          Model
                        </th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">
                          PR-AUC
                        </th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">
                          ROC-AUC
                        </th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">
                          Brier
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium md:px-5">
                          Recall
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((entry) => {
                        const ships = winner?.model === entry.model
                        return (
                          <tr key={entry.model} className="border-b border-border last:border-b-0">
                            <th scope="row" className="px-4 py-3.5 text-left md:px-5">
                              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                                {ships ? (
                                  <Check size={13} className="text-success" aria-hidden="true" />
                                ) : (
                                  <Minus size={13} className="text-faint" aria-hidden="true" />
                                )}
                                {entry.model}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-faint">
                                {ships ? 'shipped' : 'benchmark'}
                              </span>
                            </th>
                            <Cell value={entry.pr_auc_mean} std={entry.pr_auc_std} highlight={ships} />
                            <Cell value={entry.roc_auc_mean} std={entry.roc_auc_std} />
                            <Cell value={entry.brier_mean} std={entry.brier_std} />
                            <Cell value={entry.recall_mean} std={entry.recall_std} />
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              )}

              <p className="border-t border-border px-4 py-3 text-[11px] leading-5 text-faint md:px-5">
                {winner
                  ? `${winner.model} wins on PR-AUC and Brier score, so it is the pipeline that ships — not the model with the highest headline recall.`
                  : 'Loading the cross-validation report.'}
              </p>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="h-full p-5">
              <div className="overline">On every push</div>
              <h3 className="mt-1 text-[14px] font-semibold text-ink">The build has to earn the deploy.</h3>
              <ul className="mt-4 space-y-2.5">
                {CHECKS.map((check) => (
                  <li key={check} className="flex items-start gap-2.5 text-[12px] leading-5 text-muted">
                    <Check size={12} className="mt-1 shrink-0 text-success" aria-hidden="true" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-faint">Coverage gate</span>
                  <span className="mono text-ink">
                    {status ? `${formatNumber(status.coverage, 2)}%` : '—'}{' '}
                    <span className="text-faint">/ 65%</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${Math.min(100, ((status?.coverage ?? 0) / 100) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] leading-4 text-faint">
                  {status
                    ? `${status.test_count} tests · ${formatPercent(status.coverage / 100, 2)} line coverage`
                    : 'Loading the latest pipeline status.'}
                </p>
              </div>
              <a
                href={siteConfig.links.ci}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
              >
                Open the workflow
                <ArrowUpRight size={11} aria-hidden="true" />
              </a>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Cell({ value, std, highlight }: { value: number; std?: number; highlight?: boolean }) {
  return (
    <td className="px-3 py-3.5 text-right align-top">
      <span className={`mono text-[12px] ${highlight ? 'text-accent' : 'text-ink'}`}>{formatNumber(value, 3)}</span>
      <span className="mono mt-0.5 block text-[10px] text-faint">
        {std != null ? `± ${formatNumber(std, 3)}` : '—'}
      </span>
    </td>
  )
}
