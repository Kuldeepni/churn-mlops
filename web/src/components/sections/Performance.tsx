import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Info } from 'lucide-react'
import { useData } from '../../lib/data'
import { formatNumber, formatPercent, humanizeFeature } from '../../lib/format'
import type {
  CalibrationPayload,
  ImportancePayload,
  MetricsPayload,
  PrCurve,
  RocCurve,
} from '../../lib/types'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import { Tooltip } from '../ui/Tooltip'
import { CountUp } from '../visuals/CountUp'
import { SectionHeader } from '../visuals/SectionHeader'

const TABS = [
  { id: 'roc', label: 'ROC' },
  { id: 'pr', label: 'Precision–recall' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'importance', label: 'Feature importance' },
] as const

const TAKEAWAYS: Record<string, string> = {
  roc: 'At every cutoff, the model ranks a random churner above a random non-churner 84.6% of the time.',
  pr: 'With 26.5% churn prevalence, a random classifier would score 0.265 average precision. This model scores 0.636.',
  calibration:
    'After isotonic calibration, predicted probabilities sit closer to the diagonal, so a 0.18 cutoff means roughly an 18% churn risk.',
  importance:
    'Tenure, month-to-month contracts and average monthly spend dominate the model’s decisions.',
}

const HOW_TO_READ: Record<string, string> = {
  roc: 'The x-axis is the false-positive rate; the y-axis is the true-positive rate. The dashed diagonal is random guessing. Higher and further left is better.',
  pr: 'The x-axis is recall (share of churners found); the y-axis is precision (share of targeted customers who actually churn). The dashed line is the churn base rate.',
  calibration:
    'Each point is a probability bin. The x-axis is the mean predicted probability; the y-axis is the observed churn rate. Points on the diagonal are perfectly calibrated.',
  importance:
    'Mean absolute SHAP value per feature on 300 test customers. It measures how much a feature moves the model output, not whether it raises or lowers risk.',
}

interface PerformanceProps {
  metrics: MetricsPayload | null
}

export function Performance({ metrics }: PerformanceProps) {
  const { data: roc } = useData<RocCurve>('roc_curve.json')
  const { data: pr } = useData<PrCurve>('pr_curve.json')
  const { data: calibration } = useData<CalibrationPayload>('calibration.json')
  const { data: importance } = useData<ImportancePayload>('importance.json')
  const [tab, setTab] = useState<string>('roc')
  const test = metrics?.test
  const threshold = metrics?.threshold.threshold ?? 0.18
  const positives = test ? test.confusion_matrix[1][0] + test.confusion_matrix[1][1] : 0
  const prevalence = test ? positives / test.n_test : 0.265

  const kpis = [
    {
      label: 'PR-AUC',
      value: test?.pr_auc,
      note: test ? `95% CI ${test.pr_auc_ci[0].toFixed(3)}–${test.pr_auc_ci[1].toFixed(3)}` : '',
    },
    { label: 'ROC-AUC', value: test?.roc_auc, note: 'rank quality across cutoffs' },
    { label: 'Recall', value: test?.recall, note: `at cutoff ${threshold.toFixed(2)}` },
    { label: 'Brier', value: test?.brier, note: 'lower is better; calibrated' },
  ]

  return (
    <section id="performance" className="border-b border-border py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          overline="Measured, not claimed"
          title={
            <>
              The numbers, <em className="text-accent">held out.</em>
            </>
          }
          description="One evaluation on 1,409 customers the model never saw. No leaderboard cherry-picking, no test-set tuning."
          aside={
            <div className="mono text-right text-[10px] leading-5 text-faint">
              <div>n = {test?.n_test ?? 1409}</div>
              <div>single held-out pass</div>
            </div>
          }
        />

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="p-4 md:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{kpi.label}</div>
              <div className="mono mt-2 text-[28px] font-medium leading-none text-ink md:text-[32px]">
                {kpi.value != null ? <CountUp value={kpi.value} decimals={3} /> : <Skeleton className="h-8 w-20" />}
              </div>
              <div className="mt-2 text-[10px] leading-4 text-faint">{kpi.note}</div>
            </Card>
          ))}
        </div>

        <Card className="mt-5 overflow-hidden">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex flex-col gap-3 border-b border-border px-4 pt-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <TabsList label="Evaluation charts">
                {TABS.map((item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="flex items-center gap-1.5 pb-2 text-[11px] text-faint sm:pb-0">
                <span>How to read this</span>
                <Tooltip content={HOW_TO_READ[tab]}>
                  <button
                    type="button"
                    aria-label="How to read this chart"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-faint hover:text-ink"
                  >
                    <Info size={12} aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <TabsContent value="roc">
                {roc ? (
                  <>
                    <ChartLegend
                      items={[
                        { label: 'Model', color: 'var(--accent)' },
                        { label: 'Random guessing', dashed: true },
                      ]}
                    />
                    <ChartFrame
                    label={`ROC curve. Area under the curve ${roc.auc.toFixed(3)}.`}
                    summary={`False positive rate on the x-axis, true positive rate on the y-axis. The model reaches an AUC of ${roc.auc.toFixed(3)}.`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={roc.fpr.map((fpr, index) => ({ fpr, tpr: roc.tpr[index] }))}
                        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                        <XAxis
                          dataKey="fpr"
                          type="number"
                          domain={[0, 1]}
                          ticks={[0, 0.25, 0.5, 0.75, 1]}
                          tickFormatter={(value: number) => (value >= 1 ? '1.0' : value <= 0 ? '0' : value.toFixed(2))}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 1]}
                          ticks={[0, 0.25, 0.5, 0.75, 1]}
                          tickFormatter={(value: number) => (value >= 1 ? '1.0' : value <= 0 ? '0' : value.toFixed(2))}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <RechartsTooltip content={<RocTooltip />} />
                        <ReferenceLine
                          segment={[
                            { x: 0, y: 0 },
                            { x: 1, y: 1 },
                          ]}
                          stroke="var(--text-faint)"
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="monotone"
                          dataKey="tpr"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive
                          animationDuration={700}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                  </>
                ) : (
                  <Skeleton className="h-[300px] w-full" />
                )}
              </TabsContent>

              <TabsContent value="pr">
                {pr ? (
                  <>
                    <ChartLegend
                      items={[
                        { label: 'Model', color: 'var(--accent)' },
                        { label: `Base rate ${(prevalence * 100).toFixed(1)}%`, dashed: true },
                      ]}
                    />
                    <ChartFrame
                    label={`Precision-recall curve. Average precision ${pr.ap.toFixed(3)}.`}
                    summary={`Recall on the x-axis, precision on the y-axis. Average precision is ${pr.ap.toFixed(3)} against a base rate of ${prevalence.toFixed(3)}.`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={pr.recall.map((recall, index) => ({ recall, precision: pr.precision[index] }))}
                        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                        <XAxis
                          dataKey="recall"
                          type="number"
                          domain={[0, 1]}
                          ticks={[0, 0.25, 0.5, 0.75, 1]}
                          tickFormatter={(value: number) => (value >= 1 ? '1.0' : value <= 0 ? '0' : value.toFixed(2))}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 1]}
                          ticks={[0, 0.25, 0.5, 0.75, 1]}
                          tickFormatter={(value: number) => (value >= 1 ? '1.0' : value <= 0 ? '0' : value.toFixed(2))}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <RechartsTooltip content={<PrTooltip />} />
                        <ReferenceLine y={prevalence} stroke="var(--text-faint)" strokeDasharray="4 4" />
                        <Line
                          type="monotone"
                          dataKey="precision"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive
                          animationDuration={700}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                  </>
                ) : (
                  <Skeleton className="h-[300px] w-full" />
                )}
              </TabsContent>

              <TabsContent value="calibration">
                {calibration ? (
                  <>
                    <ChartLegend
                      items={[
                        { label: 'Uncalibrated', color: 'var(--text-faint)', dot: true },
                        { label: 'Isotonic calibrated', color: 'var(--accent)', dot: true },
                        { label: 'Perfect', dashed: true },
                      ]}
                    />
                    <ChartFrame
                    label="Calibration curve before and after isotonic calibration."
                    summary="Mean predicted probability on the x-axis, observed churn rate on the y-axis. The calibrated line is closer to the diagonal."
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={[0, 1]}
                          ticks={[0, 0.25, 0.5, 0.75, 1]}
                          tickFormatter={(value: number) => (value >= 1 ? '1.0' : value <= 0 ? '0' : value.toFixed(2))}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          domain={[0, 1]}
                          ticks={[0, 0.25, 0.5, 0.75, 1]}
                          tickFormatter={(value: number) => (value >= 1 ? '1.0' : value <= 0 ? '0' : value.toFixed(2))}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <RechartsTooltip content={<CalibrationTooltip />} />
                        <ReferenceLine
                          segment={[
                            { x: 0, y: 0 },
                            { x: 1, y: 1 },
                          ]}
                          stroke="var(--text-faint)"
                          strokeDasharray="4 4"
                        />
                        <Scatter
                          name="Uncalibrated"
                          data={calibration.before.mean_predicted.map((x, index) => ({
                            x,
                            y: calibration.before.fraction_positive[index],
                          }))}
                          fill="var(--text-faint)"
                        />
                        <Scatter
                          name="Calibrated"
                          data={calibration.after.mean_predicted.map((x, index) => ({
                            x,
                            y: calibration.after.fraction_positive[index],
                          }))}
                          fill="var(--accent)"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                  </>
                ) : (
                  <Skeleton className="h-[300px] w-full" />
                )}
              </TabsContent>

              <TabsContent value="importance">
                {importance ? (
                  <ChartFrame
                    label="Top ten features by mean absolute SHAP value."
                    summary="Horizontal bars show mean absolute SHAP value on 300 test customers. Tenure, month-to-month contract and average monthly spend are the largest."
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(importance)
                          .map(([name, value]) => ({ name: humanizeFeature(name), value }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 10)}
                        layout="vertical"
                        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(value: number) => (value >= 1 ? '1.0' : value <= 0 ? '0' : value.toFixed(2))}
                          tick={{ fill: 'var(--text-faint)', fontSize: 10 }}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={150}
                          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip content={<ImportanceTooltip />} />
                        <Bar
                          dataKey="value"
                          fill="var(--accent)"
                          radius={[0, 3, 3, 0]}
                          isAnimationActive
                          animationDuration={700}
                          barSize={12}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                ) : (
                  <Skeleton className="h-[300px] w-full" />
                )}
              </TabsContent>

              <p className="mt-3 max-w-[80ch] text-[13px] leading-6 text-muted">{TAKEAWAYS[tab]}</p>
            </div>
          </Tabs>
        </Card>
      </div>
    </section>
  )
}

function ChartLegend({ items }: { items: { label: string; color?: string; dashed?: boolean; dot?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-faint">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          {item.dashed ? (
            <span className="h-px w-4 border-t border-dashed border-faint" aria-hidden="true" />
          ) : (
            <span
              className={item.dot ? 'h-2 w-2 rounded-full' : 'h-0.5 w-4 rounded-full'}
              style={{ background: item.color ?? 'var(--accent)' }}
              aria-hidden="true"
            />
          )}
          {item.label}
        </span>
      ))}
    </div>
  )
}

function ChartFrame({
  label,
  summary,
  children,
}: {
  label: string
  summary: string
  children: React.ReactNode
}) {
  return (
    <figure role="img" aria-label={label}>
      <div className="h-[300px] w-full">{children}</div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}

function TooltipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] shadow-[0_12px_36px_rgba(0,0,0,0.3)]">
      {children}
    </div>
  )
}

function RocTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <TooltipShell>
      <div className="text-faint">False positive rate <span className="mono text-ink">{formatNumber(point.fpr, 2)}</span></div>
      <div className="text-faint">True positive rate <span className="mono text-ink">{formatNumber(point.tpr, 2)}</span></div>
    </TooltipShell>
  )
}

function PrTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <TooltipShell>
      <div className="text-faint">Recall <span className="mono text-ink">{formatNumber(point.recall, 2)}</span></div>
      <div className="text-faint">Precision <span className="mono text-ink">{formatNumber(point.precision, 2)}</span></div>
    </TooltipShell>
  )
}

function CalibrationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <TooltipShell>
      <div className="text-faint">Mean predicted <span className="mono text-ink">{formatNumber(point.x, 3)}</span></div>
      <div className="text-faint">Observed churn <span className="mono text-ink">{formatPercent(point.y, 1)}</span></div>
    </TooltipShell>
  )
}

function ImportanceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <TooltipShell>
      <div className="text-faint">{point.name}</div>
      <div className="text-faint">mean |SHAP| <span className="mono text-ink">{formatNumber(point.value, 3)}</span></div>
    </TooltipShell>
  )
}
