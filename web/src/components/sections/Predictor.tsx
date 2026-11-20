import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, ArrowRight, Info, RefreshCw, ShieldCheck, Target } from 'lucide-react'
import { ApiError, predictOne } from '../../lib/api'
import { formatPercent, riskLabel } from '../../lib/format'
import { nearestExample } from '../../lib/threshold'
import type { CustomerFeatures, Example, MetricsPayload, Prediction } from '../../lib/types'
import type { ApiStatus } from '../../hooks/useApiStatus'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { Slider } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { Tooltip } from '../ui/Tooltip'
import { SectionHeader } from '../visuals/SectionHeader'
import { FactorBars } from '../visuals/FactorBars'
import { Gauge } from '../visuals/Gauge'

const OPTIONS = {
  gender: ['Female', 'Male'],
  SeniorCitizen: ['No', 'Yes'],
  Partner: ['Yes', 'No'],
  Dependents: ['Yes', 'No'],
  PhoneService: ['Yes', 'No'],
  MultipleLines: ['No', 'Yes', 'No phone service'],
  InternetService: ['DSL', 'Fiber optic', 'No'],
  OnlineSecurity: ['No', 'Yes', 'No internet service'],
  OnlineBackup: ['No', 'Yes', 'No internet service'],
  DeviceProtection: ['No', 'Yes', 'No internet service'],
  TechSupport: ['No', 'Yes', 'No internet service'],
  StreamingTV: ['No', 'Yes', 'No internet service'],
  StreamingMovies: ['No', 'Yes', 'No internet service'],
  Contract: ['Month-to-month', 'One year', 'Two year'],
  PaperlessBilling: ['Yes', 'No'],
  PaymentMethod: ['Electronic check', 'Mailed check', 'Bank transfer (automatic)', 'Credit card (automatic)'],
} as const

const SERVICE_KEYS = [
  'OnlineSecurity',
  'OnlineBackup',
  'DeviceProtection',
  'TechSupport',
  'StreamingTV',
  'StreamingMovies',
] as const

const DEFAULT_FORM: CustomerFeatures = {
  gender: 'Female',
  SeniorCitizen: 'No',
  Partner: 'Yes',
  Dependents: 'No',
  tenure: 12,
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'DSL',
  OnlineSecurity: 'No',
  OnlineBackup: 'Yes',
  DeviceProtection: 'No',
  TechSupport: 'No',
  StreamingTV: 'No',
  StreamingMovies: 'No',
  Contract: 'Month-to-month',
  PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check',
  MonthlyCharges: 70.35,
  TotalCharges: 844.2,
}

type Preset = 'high' | 'loyal' | 'random'
type Source = 'live' | 'demo'

interface PredictionView {
  prediction: Prediction
  source: Source
  latencyMs: number | null
  modelVersion: string
  requestId: string | null
  threshold: number
  nearest?: Example
}

interface PredictorProps {
  metrics: MetricsPayload | null
  examples: Example[] | null
  apiStatus: ApiStatus
  modelVersion: string | null
}

export function Predictor({ metrics, examples, apiStatus, modelVersion }: PredictorProps) {
  const threshold = metrics?.threshold.threshold ?? 0.18
  const cost = metrics?.threshold.cost_params
  const valueIfChurner = cost
    ? cost.customer_lifetime_value * cost.offer_success_rate - cost.retention_offer_cost
    : 1200 * 0.35 - 60
  const offerCost = cost?.retention_offer_cost ?? 60
  const [form, setForm] = useState<CustomerFeatures>(DEFAULT_FORM)
  const [preset, setPreset] = useState<Preset>('high')
  const [result, setResult] = useState<PredictionView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const initialised = useRef(false)

  useEffect(() => {
    if (initialised.current || !examples?.length) return
    const first = examples.find((example) => example.risk_band === 'high') ?? examples[0]
    setForm(first.features)
    initialised.current = true
  }, [examples])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const update = <K extends keyof CustomerFeatures>(key: K, value: CustomerFeatures[K]) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value }
      if (key === 'tenure' || key === 'MonthlyCharges') {
        next.TotalCharges = Math.round(Number(next.MonthlyCharges) * Math.max(1, Number(next.tenure)) * 100) / 100
      }
      return next
    })
  }

  const choosePreset = (next: Preset) => {
    setPreset(next)
    setResult(null)
    setError(null)
    if (!examples?.length) return
    if (next === 'random') {
      setForm(examples[Math.floor(Math.random() * examples.length)].features)
      return
    }
    const band = next === 'high' ? 'high' : 'low'
    const example = examples.find((item) => item.risk_band === band) ?? examples[0]
    setForm(example.features)
  }

  const runDemo = () => {
    if (!examples?.length) return
    const nearest = nearestExample(form, examples)
    if (!nearest) return
    setResult({
      prediction: nearest,
      source: 'demo',
      latencyMs: null,
      modelVersion: modelVersion ?? '0.1.0',
      requestId: null,
      threshold,
      nearest,
    })
    setError(null)
  }

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      if (apiStatus === 'online') {
        const response = await predictOne(form)
        setResult({
          prediction: response.prediction,
          source: 'live',
          latencyMs: response.latencyMs,
          modelVersion: response.modelVersion,
          requestId: response.requestId,
          threshold: response.threshold,
        })
      } else {
        runDemo()
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 429) {
        setCooldown(cause.retryAfterSeconds ?? 30)
        setError('Rate limited by the model server.')
      } else {
        setError(cause instanceof Error ? cause.message : 'The prediction failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  const source = result?.source ?? (apiStatus === 'online' ? 'live' : 'demo')

  return (
    <section id="predict" className="border-b border-border py-20 md:py-28">
      <div className="container-page">
        <SectionHeader
          overline="Live model"
          title={
            <>
              Try it on a <em className="text-accent">customer.</em>
            </>
          }
          description="Adjust the account, services and billing. The model returns a calibrated probability, a profit-based decision and the factors that moved it."
          aside={
            <div className="flex items-center gap-2 text-[11px] text-faint">
              <span className="mono rounded-md border border-border bg-surface px-2 py-1">
                cutoff {threshold.toFixed(2)}
              </span>
              <Tooltip content="The cutoff is chosen on validation data to maximise expected net benefit, not accuracy. It is not 0.5.">
                <button
                  type="button"
                  aria-label="Why the cutoff is not 0.5"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-ink"
                >
                  <Info size={13} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          }
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,470px)_minmax(0,1fr)] lg:gap-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <div className="overline">Inputs</div>
                <h3 className="mt-1 text-[15px] font-semibold text-ink">Customer profile</h3>
              </div>
              <span className="mono text-[10px] text-faint">19 features</span>
            </div>

            <div className="relative">
              <div
                className={`absolute inset-x-0 top-0 h-0.5 origin-left bg-accent transition-opacity ${
                  loading ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden="true"
              >
                <motion.div
                  className="h-full w-1/2 bg-accent-hover"
                  animate={loading ? { x: ['-100%', '200%'] } : { x: '-100%' }}
                  transition={{ duration: 1.1, repeat: loading ? Infinity : 0, ease: 'linear' }}
                />
              </div>

              <div className="space-y-6 p-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Preset</span>
                    <span className="text-[10px] text-faint">real test-set rows</span>
                  </div>
                  <Segmented
                    label="Customer preset"
                    value={preset}
                    onChange={choosePreset}
                    options={[
                      { value: 'high', label: 'High risk' },
                      { value: 'loyal', label: 'Loyal' },
                      { value: 'random', label: 'Random' },
                    ]}
                  />
                </div>

                <fieldset className="space-y-4">
                  <legend className="mb-3 flex w-full items-center gap-3">
                    <span className="overline">Account</span>
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  </legend>
                  <Slider
                    label="Tenure"
                    value={form.tenure}
                    onValueChange={(value) => update('tenure', value)}
                    min={0}
                    max={72}
                    step={1}
                    format={(value) => `${value} mo`}
                    hint="months with the company"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Contract"
                      value={form.Contract}
                      onValueChange={(value) => update('Contract', value)}
                      options={OPTIONS.Contract}
                    />
                    <Select
                      label="Payment method"
                      value={form.PaymentMethod}
                      onValueChange={(value) => update('PaymentMethod', value)}
                      options={OPTIONS.PaymentMethod}
                    />
                  </div>
                  <Switch
                    label="Paperless billing"
                    description="Sent by email instead of post"
                    checked={form.PaperlessBilling === 'Yes'}
                    onCheckedChange={(checked) => update('PaperlessBilling', checked ? 'Yes' : 'No')}
                  />
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="mb-3 flex w-full items-center gap-3">
                    <span className="overline">Services</span>
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Internet"
                      value={form.InternetService}
                      onValueChange={(value) => update('InternetService', value)}
                      options={OPTIONS.InternetService}
                    />
                    <Select
                      label="Phone"
                      value={form.PhoneService}
                      onValueChange={(value) => update('PhoneService', value)}
                      options={OPTIONS.PhoneService}
                    />
                    {SERVICE_KEYS.map((key) => (
                      <Select
                        key={key}
                        label={key.replace(/([a-z])([A-Z])/g, '$1 $2')}
                        value={form[key]}
                        onValueChange={(value) => update(key, value)}
                        options={OPTIONS[key]}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="mb-3 flex w-full items-center gap-3">
                    <span className="overline">Billing</span>
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  </legend>
                  <Slider
                    label="Monthly charges"
                    value={form.MonthlyCharges}
                    onValueChange={(value) => update('MonthlyCharges', value)}
                    min={18}
                    max={140}
                    step={0.5}
                    format={(value) => `$${value.toFixed(2)}`}
                    hint="per month"
                  />
                  <Field
                    label="Total charges"
                    htmlFor="total-charges"
                    hint="Estimated from tenure × monthly. The API receives this value."
                  >
                    <input
                      id="total-charges"
                      className="input mono"
                      value={`$${form.TotalCharges.toFixed(2)}`}
                      readOnly
                      aria-readonly="true"
                    />
                  </Field>
                </fieldset>

                <div>
                  <Button
                    onClick={() => void run()}
                    disabled={loading || cooldown > 0}
                    className="w-full"
                    aria-busy={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
                        Running model…
                      </>
                    ) : cooldown > 0 ? (
                      <>Try again in {cooldown}s</>
                    ) : (
                      <>
                        Predict churn
                        <ArrowRight size={15} aria-hidden="true" />
                      </>
                    )}
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-faint">
                    {apiStatus === 'online'
                      ? 'Live inference from the FastAPI model server.'
                      : 'Demo mode: nearest real customer in the held-out test set.'}
                  </p>
                </div>

                {error ? (
                  <div role="alert" className="rounded-[10px] border border-danger/25 bg-danger-soft p-3">
                    <div className="flex items-start gap-2 text-[12px] leading-5 text-danger">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 pl-6 text-[11px]">
                      <button
                        type="button"
                        onClick={() => void run()}
                        className="font-medium text-danger underline underline-offset-4"
                      >
                        Retry
                      </button>
                      {apiStatus === 'online' ? (
                        <button
                          type="button"
                          onClick={runDemo}
                          className="font-medium text-muted underline underline-offset-4 hover:text-ink"
                        >
                          Use nearest precomputed customer
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="space-y-4 lg:sticky lg:top-[76px] lg:self-start" aria-live="polite">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="overline">Decision</div>
                  <h3 className="mt-1 text-[15px] font-semibold text-ink">
                    {result ? riskLabel(result.prediction.risk_band) : 'Awaiting a prediction'}
                  </h3>
                </div>
                <Badge tone={source === 'live' ? 'success' : 'warning'} dot>
                  {source === 'live' ? 'Live API' : 'Precomputed'}
                </Badge>
              </div>

              <div className="mt-4">
                <Gauge value={result?.prediction.churn_probability ?? null} threshold={result?.threshold ?? threshold} />
              </div>

              {result ? (
                <motion.div
                  key={`${result.prediction.churn_probability}-${result.source}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={`mt-4 rounded-[10px] border p-3.5 ${
                    result.prediction.will_churn
                      ? 'border-danger/25 bg-danger-soft'
                      : 'border-success/25 bg-success-soft'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 text-[13px] font-semibold ${
                      result.prediction.will_churn ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {result.prediction.will_churn ? (
                      <Target size={15} aria-hidden="true" />
                    ) : (
                      <ShieldCheck size={15} aria-hidden="true" />
                    )}
                    {result.prediction.will_churn ? 'Target with a retention offer' : 'No action needed'}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {formatPercent(result.prediction.churn_probability, 1)} churn probability at cutoff{' '}
                    <span className="mono text-ink">{result.threshold.toFixed(2)}</span>. Expected value of a
                    targeted churner is{' '}
                    <span className="mono text-ink">${valueIfChurner.toFixed(0)}</span>; a targeted
                    non-churner costs <span className="mono text-ink">${offerCost.toFixed(0)}</span>.
                  </p>
                </motion.div>
              ) : (
                <div className="mt-4 rounded-[10px] border border-dashed border-border-strong bg-bg/40 p-4 text-[12px] leading-5 text-faint">
                  No prediction yet. Choose a preset or edit the profile, then run the model to see the
                  probability, decision and top factors.
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="overline">Explanation</div>
                  <h3 className="mt-1 text-[15px] font-semibold text-ink">Why this prediction</h3>
                </div>
                <Tooltip content="SHAP values from the underlying gradient-boosted model, aggregated to the top three features. Red increases churn risk; green decreases it.">
                  <button
                    type="button"
                    aria-label="How to read the factor chart"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-ink"
                  >
                    <Info size={13} aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
              <div className="mt-4">
                {result ? (
                  <FactorBars factors={result.prediction.top_factors} />
                ) : (
                  <p className="text-[13px] text-faint">
                    The top three drivers appear here after a prediction.
                  </p>
                )}
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[10px] border border-border bg-surface px-4 py-3 text-[11px] text-faint">
              <span>
                Model <span className="mono text-muted">{result?.modelVersion ?? modelVersion ?? '0.1.0'}</span>
              </span>
              <span>
                Latency{' '}
                <span className="mono text-muted">
                  {result?.latencyMs != null ? `${result.latencyMs} ms` : 'precomputed'}
                </span>
              </span>
              <span>
                Source <span className="mono text-muted">{result?.source === 'live' ? 'API' : 'test set'}</span>
              </span>
              {result?.requestId ? (
                <span className="hidden sm:inline">
                  Req <span className="mono text-muted">{result.requestId.slice(0, 8)}</span>
                </span>
              ) : null}
              {result?.nearest ? (
                <Tooltip content="Nearest neighbour by L1 distance over tenure, monthly and total charges (scaled), plus mismatches in contract, internet, payment and paperless billing.">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-ink"
                  >
                    <Info size={11} aria-hidden="true" />
                    nearest real customer
                  </button>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
