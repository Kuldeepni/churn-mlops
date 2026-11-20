import { ArrowDown, ArrowRight, ArrowUpRight, Check, CornerDownLeft } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { Card } from '../ui/Card'
import { SectionHeader } from '../visuals/SectionHeader'
import { Reveal } from '../visuals/Reveal'

interface Stage {
  name: string
  description: string
  artifact: string
  href: string
}

const STAGES: Stage[] = [
  {
    name: 'Ingest',
    description: 'Download the public Telco dataset, verify its checksum and write a manifest.',
    artifact: 'raw CSV + manifest',
    href: `${siteConfig.repo}/blob/main/src/churn/data/ingest.py`,
  },
  {
    name: 'Validate & split',
    description: 'Pandera schema checks, then a stratified 60 / 20 / 20 split with a fixed seed.',
    artifact: 'train, val, test parquet',
    href: `${siteConfig.repo}/blob/main/src/churn/data/split.py`,
  },
  {
    name: 'Train',
    description: 'Five-fold CV over a logistic baseline and a tuned LightGBM, tracked in MLflow.',
    artifact: 'uncalibrated pipeline',
    href: siteConfig.links.train,
  },
  {
    name: 'Calibrate',
    description: 'Isotonic and sigmoid calibration on validation; the better Brier score wins.',
    artifact: 'calibrated pipeline',
    href: siteConfig.links.calibrate,
  },
  {
    name: 'Set the cutoff',
    description: 'Sweep 99 thresholds on validation data and keep the profit-maximising one.',
    artifact: 'threshold.json',
    href: siteConfig.links.threshold,
  },
  {
    name: 'Bundle',
    description: 'Package the pipeline, metadata and reference statistics into one serving artifact.',
    artifact: 'pipeline.joblib',
    href: siteConfig.links.bundle,
  },
  {
    name: 'Evaluate',
    description: 'One held-out pass. The build fails if PR-AUC or recall fall below the gate.',
    artifact: 'metrics.json',
    href: siteConfig.links.evaluate,
  },
  {
    name: 'Serve & monitor',
    description: 'FastAPI with Prometheus metrics, plus PSI drift checks against the reference.',
    artifact: '/predict · /health · /metrics',
    href: siteConfig.links.api,
  },
]

const TOOLS = [
  {
    name: 'MLflow',
    role: 'Experiment tracking, model registry and every CV run.',
    href: siteConfig.links.train,
  },
  {
    name: 'DVC',
    role: 'Stage graph, data versioning and one-command reproduction.',
    href: siteConfig.links.dvc,
  },
  {
    name: 'FastAPI',
    role: 'Typed request and response models, health and readiness probes.',
    href: siteConfig.links.api,
  },
  {
    name: 'Prometheus',
    role: 'Prediction counters, latency histograms and score distributions.',
    href: siteConfig.links.apiMetrics,
  },
  {
    name: 'Docker',
    role: 'A reproducible image, smoke-tested against /health in CI.',
    href: siteConfig.links.docker,
  },
  {
    name: 'GitHub Actions',
    role: 'Lint, a Python 3.10–3.12 test matrix, pipeline, image and Pages.',
    href: siteConfig.links.ci,
  },
]

export function Pipeline() {
  return (
    <section id="pipeline" className="border-b border-border py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          overline="Under the hood"
          title={
            <>
              One graph. <em className="text-accent">Every artifact.</em>
            </>
          }
          description="Every artifact on this page comes from the same DVC graph. Change a parameter and only the stages downstream of it re-run."
          aside={
            <div className="mono text-right text-[10px] leading-5 text-faint">
              <div>8 steps · 6 DVC stages</div>
              <div>seed 42 · deterministic</div>
            </div>
          }
        />

        <Reveal>
          <ol className="mt-10 grid overflow-hidden rounded-card border border-border bg-border xl:grid-cols-4">
            {STAGES.map((stage, index) => {
              const last = index === STAGES.length - 1
              return (
                <li key={stage.name} className="group relative bg-surface">
                  <a
                    href={stage.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-full flex-col p-5 transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  >
                    <div className="flex items-center justify-between">
                      <span className="mono text-[11px] tracking-[0.08em] text-faint">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {last ? (
                        <Check size={13} className="text-success" aria-hidden="true" />
                      ) : index === 3 ? (
                        <>
                          <CornerDownLeft
                            size={13}
                            className="hidden text-faint transition-colors group-hover:text-accent xl:block"
                            aria-hidden="true"
                          />
                          <ArrowDown
                            size={13}
                            className="text-faint transition-colors group-hover:text-accent xl:hidden"
                            aria-hidden="true"
                          />
                        </>
                      ) : (
                        <>
                          <ArrowRight
                            size={13}
                            className="hidden text-faint transition-colors group-hover:text-accent xl:block"
                            aria-hidden="true"
                          />
                          <ArrowDown
                            size={13}
                            className="text-faint transition-colors group-hover:text-accent xl:hidden"
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em] text-ink">{stage.name}</h3>
                    <p className="mt-1.5 flex-1 text-[12px] leading-5 text-muted">{stage.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="mono truncate text-[10px] text-faint">{stage.artifact}</span>
                      <ArrowUpRight
                        size={11}
                        className="shrink-0 text-faint transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                        aria-hidden="true"
                      />
                    </div>
                  </a>
                </li>
              )
            })}
          </ol>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-6 flex flex-col gap-2 rounded-[10px] border border-border bg-surface px-4 py-3 text-[11px] leading-5 text-faint sm:flex-row sm:items-center sm:justify-between">
            <span>
              One <span className="mono text-muted">dvc repro</span> runs the graph. Unchanged stages are skipped by
              content hash, not by timestamp.
            </span>
            <a
              href={siteConfig.links.dvc}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 font-medium text-muted transition-colors hover:text-ink"
            >
              Read dvc.yaml
              <ArrowUpRight size={11} aria-hidden="true" />
            </a>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          <Reveal>
            <div>
              <div className="overline">Tooling</div>
              <h3 className="display mt-2 text-[26px] leading-[1.1] tracking-[-0.02em] text-ink">
                Chosen for the job, not the logo wall.
              </h3>
              <p className="mt-3 text-[13px] leading-6 text-muted">
                Six pieces carry the whole path from raw CSV to a monitored endpoint.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <Card className="overflow-hidden">
              <ul>
                {TOOLS.map((tool, index) => (
                  <li key={tool.name} className={index === 0 ? '' : 'border-t border-border'}>
                    <a
                      href={tool.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group grid grid-cols-[104px_minmax(0,1fr)_16px] items-baseline gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:grid-cols-[130px_minmax(0,1fr)_16px] sm:px-5"
                    >
                      <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{tool.name}</span>
                      <span className="text-[12px] leading-5 text-muted">{tool.role}</span>
                      <ArrowUpRight
                        size={13}
                        className="self-center text-faint transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
