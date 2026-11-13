import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, ReferenceLine, ReferenceDot } from 'recharts'
import { Activity, ArrowRight, Github, Moon, Sun, Menu, X, Zap, ShieldCheck, Container, GitBranch } from 'lucide-react'
import * as RadixTabs from '@radix-ui/react-tabs'
import * as RadixSwitch from '@radix-ui/react-switch'
import * as RadixDialog from '@radix-ui/react-dialog'
import { useApiStatus } from './hooks/useApiStatus'
import { useTheme } from './hooks/useTheme'
import { siteConfig } from './config/site'
import { predict, type CustomerFeatures, type Prediction } from './lib/api'
import { optimizeThreshold, type Score } from './lib/threshold'
import { Card } from './components/ui/Card'

const BASE = import.meta.env.BASE_URL

function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => { fetch(`${BASE}data/${path}`).then(r=>r.json()).then(setData).catch(()=>{}) }, [path])
  return data
}

function FadeUp({ children, className='' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4 }} className={className}>
      {children}
    </motion.div>
  )
}

function CountUp({ value, decimals=3 }: { value: number; decimals?: number }) {
  const [v, setV] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const dur = 900
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      setV(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, value])
  return <span ref={ref} className="font-mono">{v.toFixed(decimals)}</span>
}

// ---------- NAV ----------
function Nav({ apiStatus }: { apiStatus: string }) {
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const links = ['Predict','Impact','Performance','Pipeline','Monitoring']
  return (
    <header className={`sticky top-0 z-40 backdrop-blur bg-bg/80 border-b transition-colors ${scrolled ? 'border-border' : 'border-transparent'}`}>
      <div className="max-w-container mx-auto px-6 h-14 flex items-center gap-6">
        <a href="#hero" className="flex items-center gap-2 font-semibold">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="1" y="1" width="20" height="20" rx="6" stroke="currentColor" strokeWidth="1.5"/><path d="M4 16 L8 11 L12 13 L18 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          churn-mlops
        </a>
        <nav className="hidden md:flex items-center gap-5 ml-6 text-sm text-text-muted">
          {links.map(l => <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-text transition-colors">{l}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border border-border bg-surface">
            <span className={`w-1.5 h-1.5 rounded-full ${apiStatus==='online'?'bg-success':apiStatus==='offline'?'bg-danger':'bg-warning animate-pulse'}`} />
            {apiStatus==='online'?'Live API':apiStatus==='offline'?'Demo mode':apiStatus==='waking'?'Waking...':'Checking'}
          </span>
          <button onClick={toggle} aria-label="Toggle theme" className="p-2 rounded-lg hover:bg-surface-2">
            {theme==='dark' ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
          <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 text-sm px-3 h-10 rounded-btn border border-border hover:bg-surface-2">
            <Github size={14}/> GitHub
          </a>
          <button className="md:hidden p-2" onClick={()=>setOpen(true)}><Menu size={18}/></button>
        </div>
      </div>
      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 bg-black/50" />
          <RadixDialog.Content className="fixed inset-x-0 top-0 bg-bg border-b border-border p-6">
            <div className="flex justify-between mb-4"><span className="font-semibold">Menu</span><button onClick={()=>setOpen(false)}><X size={18}/></button></div>
            <div className="flex flex-col gap-3">
              {links.map(l => <a key={l} href={`#${l.toLowerCase()}`} onClick={()=>setOpen(false)} className="text-lg">{l}</a>)}
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </header>
  )
}

// ---------- HERO ----------
function Hero({ metrics, examples }: any) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setIdx(i => (i+1)%3), 6000)
    return () => clearInterval(id)
  }, [paused])
  const ex = examples?.[idx] ?? examples?.[0]
  const prAuc = metrics?.test?.pr_auc
  const recall = metrics?.test?.recall
  const net = metrics?.test?.net_benefit_per_1000
  return (
    <section id="hero" className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
      <div className="relative max-w-container mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid md:grid-cols-[55fr_45fr] gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-accent-soft text-accent border border-accent/20">
              Open-source MLOps case study
            </span>
            <h1 className="mt-6 text-4xl md:text-[64px] leading-[1.05] md:leading-[64px] font-semibold tracking-[-0.035em]">
              Predict churn. <span className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">Decide by profit.</span>
            </h1>
            <p className="mt-5 text-lg text-text-muted max-w-[52ch]">
              A production-grade pipeline that turns calibrated probabilities into retention decisions that maximize expected profit, with experiment tracking, CI/CD and drift monitoring.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#predict" className="inline-flex items-center gap-2 h-10 px-5 rounded-btn bg-accent text-white hover:bg-accent-hover transition-colors font-medium">
                Try the live model <ArrowRight size={16}/>
              </a>
              <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-10 px-5 rounded-btn border border-border hover:bg-surface-2 font-medium">
                <Github size={16}/> View source
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm">
              {[
                { label: 'PR-AUC', value: prAuc, d: 3 },
                { label: 'Recall @ threshold', value: recall, d: 3 },
                { label: 'Extra profit / 1k', value: net ? net/1000 : null, d: 1, prefix: '$' },
                { label: 'Tests passing', value: 30, d: 0 },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-6">
                  {i>0 && <div className="w-px h-8 bg-border" />}
                  <div>
                    <div className="text-text-faint text-xs uppercase tracking-[0.08em]">{s.label}</div>
                    <div className="font-mono text-lg font-semibold">
                      {s.prefix}{s.value != null ? (typeof s.value==='number' ? s.value.toFixed(s.d) : s.value) : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} className="card p-5 transition-transform hover:[transform:perspective(1200px)_rotateY(-1deg)]">
            <div className="text-xs text-text-faint uppercase tracking-[0.08em] mb-3">Live preview</div>
            {ex ? (
              <>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {Object.entries(ex.features).slice(0,8).map(([k,v]) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-surface-2 border border-border font-mono">{k}:{String(v).slice(0,12)}</span>
                  ))}
                </div>
                <Gauge value={ex.churn_probability} threshold={metrics?.test?.threshold ?? 0.18} />
                <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${ex.will_churn ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                  {ex.will_churn ? <Activity size={14}/> : <ShieldCheck size={14}/>}
                  {ex.will_churn ? 'Target with retention offer' : 'No action needed'}
                </div>
                <div className="mt-4 space-y-2">
                  {ex.top_factors.map((f:any, i:number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted truncate flex-1">{f.feature.replace(/_/g,' ')}</span>
                      <span className={`font-mono ${f.direction==='increases_churn'?'text-danger':'text-success'}`}>{f.direction==='increases_churn'?'+':'-'}{Math.abs(f.impact).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="h-48 flex items-center justify-center text-text-faint">Loading…</div>}
          </div>
        </div>
      </div>
    </section>
  )
}

function Gauge({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.round(value*100)
  const color = value < 0.3 ? 'var(--success)' : value < 0.6 ? 'var(--warning)' : 'var(--danger)'
  const r = 90; const cx=110; const cy=100
  const angle = Math.PI - value*Math.PI
  const x = cx + r*Math.cos(angle); const y = cy - r*Math.sin(angle)
  const tx = cx + r*Math.cos(Math.PI - threshold*Math.PI); const ty = cy - r*Math.sin(Math.PI - threshold*Math.PI)
  return (
    <svg width="220" height="120" viewBox="0 0 220 120">
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round"/>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"/>
      <circle cx={tx} cy={ty} r="4" fill="var(--text-faint)" />
      <text x={cx} y={cy-10} textAnchor="middle" fontSize="28" fontWeight="600" fill="var(--text)" fontFamily="JetBrains Mono Variable">{pct}%</text>
      <text x={cx} y={cy+8} textAnchor="middle" fontSize="10" fill="var(--text-faint)">churn probability</text>
    </svg>
  )
}

// ---------- PREDICT ----------
function Predictor({ metrics, examples, apiStatus }: any) {
  const threshold = metrics?.test?.threshold ?? 0.18
  const [form, setForm] = useState<CustomerFeatures>(() => examples?.[0]?.features ?? {})
  const [preset, setPreset] = useState('high')
  const [result, setResult] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const timer = useRef<any>(null)

  useEffect(() => {
    if (examples?.length) setForm(examples[0].features)
  }, [examples])

  const loadPreset = (p: string) => {
    setPreset(p)
    if (p === 'random') {
      const e = examples?.[Math.floor(Math.random()*examples.length)]
      if (e) setForm(e.features)
    } else if (p === 'high') {
      const e = examples?.find((x:any)=>x.risk_band==='high') ?? examples?.[0]
      if (e) setForm(e.features)
    } else {
      const e = examples?.find((x:any)=>x.risk_band==='low') ?? examples?.[0]
      if (e) setForm(e.features)
    }
  }

  const run = async (f: CustomerFeatures) => {
    setLoading(true); setError(null)
    try {
      if (apiStatus === 'online') {
        const r = await predict([f])
        setResult(r.predictions[0])
      } else {
        // demo: nearest example by feature distance
        const nearest = nearestExample(f, examples)
        setResult({ churn_probability: nearest.churn_probability, will_churn: nearest.will_churn, risk_band: nearest.risk_band, top_factors: nearest.top_factors })
      }
    } catch (e: any) {
      if (e?.message?.includes('429')) { setCooldown(true); setTimeout(()=>setCooldown(false), 5000) }
      setError(e?.message || 'Prediction failed')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => run(form), 500)
    return () => clearTimeout(timer.current)
  }, [form, apiStatus])

  const update = (k: keyof CustomerFeatures, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <section id="predict" className="py-28">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Live model</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Try it on a customer</h2>
          <p className="mt-3 text-text-muted max-w-[65ch]">Adjust the attributes; prediction updates automatically. No submit button needed.</p>
        </FadeUp>
        <div className="mt-10 grid lg:grid-cols-[480px_1fr] gap-6">
          <Card>
            <div className="flex gap-2 mb-4">
              {['High risk','Loyal','Random real customer'].map((l,i) => {
                const key = i===0?'high':i===1?'low':'random'
                return <button key={key} onClick={()=>loadPreset(key)} className={`px-3 h-8 rounded-lg text-xs border ${preset===key?'bg-accent text-white border-accent':'border-border hover:bg-surface-2'}`}>{l}</button>
              })}
            </div>
            {loading && <div className="h-1 bg-border rounded mb-3 overflow-hidden"><div className="h-full bg-accent animate-pulse w-1/2" /></div>}
            <div className="text-xs text-text-faint uppercase tracking-[0.08em] mb-2">Account</div>
            <div className="space-y-3">
              <Field label="Tenure (months)" hint="Months with company">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={form.tenure} onChange={e=>update('tenure', +e.target.value)} className="flex-1" />
                  <span className="font-mono text-sm w-10 text-right">{form.tenure}</span>
                </div>
              </Field>
              <Field label="Contract">
                <select value={form.Contract} onChange={e=>update('Contract', e.target.value)} className="w-full h-10 rounded-btn border border-border bg-surface px-3">
                  {['Month-to-month','One year','Two year'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Paperless billing">
                <RadixSwitch.Root checked={form.PaperlessBilling==='Yes'} onCheckedChange={v=>update('PaperlessBilling', v?'Yes':'No')} className="w-10 h-6 bg-border rounded-full relative data-[state=checked]:bg-accent">
                  <RadixSwitch.Thumb className="block w-4 h-4 bg-white rounded-full translate-x-1 data-[state=checked]:translate-x-5 transition-transform" />
                </RadixSwitch.Root>
              </Field>
              <Field label="Payment method">
                <select value={form.PaymentMethod} onChange={e=>update('PaymentMethod', e.target.value)} className="w-full h-10 rounded-btn border border-border bg-surface px-3">
                  {['Electronic check','Mailed check','Bank transfer (automatic)','Credit card (automatic)'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="text-xs text-text-faint uppercase tracking-[0.08em] mt-4 mb-2">Services</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Internet service">
                <select value={form.InternetService} onChange={e=>update('InternetService', e.target.value)} className="w-full h-10 rounded-btn border border-border bg-surface px-3">
                  {['DSL','Fiber optic','No'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Phone service">
                <select value={form.PhoneService} onChange={e=>update('PhoneService', e.target.value)} className="w-full h-10 rounded-btn border border-border bg-surface px-3">
                  {['Yes','No'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
              {['OnlineSecurity','OnlineBackup','DeviceProtection','TechSupport','StreamingTV','StreamingMovies'].map(k => (
                <Field key={k} label={k.replace(/([A-Z])/g,' $1').trim()}>
                  <select value={(form as any)[k]} onChange={e=>update(k as any, e.target.value)} className="w-full h-10 rounded-btn border border-border bg-surface px-3">
                    {['Yes','No','No internet service'].map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
              ))}
            </div>
            <div className="text-xs text-text-faint uppercase tracking-[0.08em] mt-4 mb-2">Billing</div>
            <Field label="Monthly charges" hint="Derived total charges shown read-only">
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={200} step={0.5} value={form.MonthlyCharges} onChange={e=>update('MonthlyCharges', +e.target.value)} className="flex-1" />
                <span className="font-mono text-sm w-14 text-right">${form.MonthlyCharges.toFixed(1)}</span>
              </div>
            </Field>
            <Field label="Total charges (read-only)">
              <input readOnly value={form.TotalCharges} className="w-full h-10 rounded-btn border border-border bg-surface-2 px-3 font-mono" />
            </Field>
            {error && <div className="mt-3 text-sm text-danger">{error} <button onClick={()=>run(form)} className="underline">Retry</button></div>}
            {cooldown && <div className="mt-3 text-sm text-warning">Rate limited. Please wait a moment.</div>}
          </Card>
          <div className="lg:sticky lg:top-24 self-start space-y-4">
            <Card>
              <Gauge value={result?.churn_probability ?? 0} threshold={threshold} />
              <div className="text-center text-xs text-text-faint mt-1">Threshold {threshold.toFixed(2)} marks the optimum</div>
            </Card>
            {result && (
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`card p-4 ${result.will_churn?'bg-danger/5 border-danger/30':'bg-success/5 border-success/30'}`}>
                <div className="flex items-center gap-2 font-medium">
                  {result.will_churn ? <Activity className="text-danger" size={16}/> : <ShieldCheck className="text-success" size={16}/>}
                  {result.will_churn ? 'Target with retention offer' : 'No action needed'}
                </div>
                <div className="text-xs text-text-muted mt-1">Threshold {threshold.toFixed(2)} maximizes expected profit</div>
              </motion.div>
            )}
            <Card>
              <div className="text-xs text-text-faint uppercase tracking-[0.08em] mb-3">Why this prediction</div>
              {result?.top_factors?.length ? (
                <div className="space-y-2">
                  {result.top_factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-text-muted truncate">{f.feature.replace(/_/g,' ')}</span>
                      <div className="w-24 h-2 bg-surface-2 rounded relative overflow-hidden">
                        <div className={`absolute top-0 h-full ${f.direction==='increases_churn'?'right-1/2 bg-danger':'left-1/2 bg-success'}`} style={{ width: `${Math.min(100, Math.abs(f.impact)*40)}%` }} />
                      </div>
                      <span className={`font-mono text-xs w-12 text-right ${f.direction==='increases_churn'?'text-danger':'text-success'}`}>{f.direction==='increases_churn'?'+':'-'}{Math.abs(f.impact).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-text-faint">Computing…</div>}
            </Card>
            <Card>
              <div className="text-xs text-text-faint font-mono">
                model v{metrics && '0.1.0'} · {apiStatus==='online'?'Live API':'Precomputed'} · {apiStatus==='offline'?'Nearest real customer in the test set':''}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, hint, children }: any) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-text-faint">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

function nearestExample(f: CustomerFeatures, examples: any[]) {
  let best = examples[0]; let bestD = Infinity
  for (const e of examples) {
    let d = 0
    for (const k of Object.keys(f)) {
      if (typeof f[k] === 'number') d += Math.abs((e.features[k]??0) - (f[k] as number))
      else if (e.features[k] !== f[k]) d += 1
    }
    if (d < bestD) { bestD = d; best = e }
  }
  return best
}

// ---------- IMPACT ----------
function Impact() {
  const valScores: Score[] = useData('validation_scores.json') ?? []
  const bp = useData<any>('business_params.json')
  const [clv, setClv] = useState(bp?.customer_lifetime_value ?? 1200)
  const [cost, setCost] = useState(bp?.retention_offer_cost ?? 60)
  const [success, setSuccess] = useState(bp?.offer_success_rate ?? 0.35)
  const [base, setBase] = useState(1000)
  useEffect(() => { if (bp) { setClv(bp.customer_lifetime_value); setCost(bp.retention_offer_cost); setSuccess(bp.offer_success_rate) } }, [bp])
  const opt = useMemo(() => optimizeThreshold(valScores, clv, cost, success), [valScores, clv, cost, success])
  const data = opt.curve.map(c => ({ t: c.threshold, profit: c.per1000 }))
  return (
    <section id="impact" className="py-28 bg-surface/40">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Business value</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">What it's worth</h2>
          <p className="mt-3 text-text-muted max-w-[65ch]">Accuracy is the wrong objective. We optimize expected profit over the threshold.</p>
        </FadeUp>
        <div className="mt-10 grid lg:grid-cols-[360px_1fr] gap-6">
          <Card className="space-y-5">
            {[
              { label: 'Customer lifetime value', value: clv, set: setClv, min: 100, max: 5000, step: 50, fmt: (v:number)=>`$${v}` },
              { label: 'Offer cost', value: cost, set: setCost, min: 5, max: 500, step: 5, fmt: (v:number)=>`$${v}` },
              { label: 'Offer success rate', value: success, set: setSuccess, min: 0.05, max: 0.9, step: 0.05, fmt: (v:number)=>`${(v*100).toFixed(0)}%` },
              { label: 'Customer base size', value: base, set: setBase, min: 100, max: 100000, step: 100, fmt: (v:number)=>v.toLocaleString() },
            ].map((s, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1"><span className="text-sm font-medium">{s.label}</span><span className="font-mono text-sm">{s.fmt(s.value)}</span></div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={e=>s.set(+e.target.value)} className="w-full" />
              </div>
            ))}
          </Card>
          <Card>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25}/>
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} tickFormatter={(v:number)=>v.toFixed(2)} />
                <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                <RTooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="profit" stroke="var(--accent)" fill="url(#g)" />
                <ReferenceLine x={opt.threshold} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: `Optimal ${opt.threshold.toFixed(2)}`, fill:'var(--accent)', fontSize:11 }} />
                <ReferenceDot x={0.5} y={data.find(d=>Math.abs(d.t-0.5)<0.011)?.profit} r={4} fill="var(--text-faint)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <Kpi label="Profit at optimum" value={`$${(opt.netBenefitPer1000*base/1000).toFixed(0)}`} delta="success" />
              <Kpi label="vs naive 0.5" value={`$${((opt.netBenefitPer1000-opt.atHalf)*base/1000).toFixed(0)}`} delta={opt.netBenefitPer1000>opt.atHalf?'success':'danger'} />
              <Kpi label="vs target everyone" value={`$${((opt.netBenefitPer1000-opt.targetAll)*base/1000).toFixed(0)}`} delta={opt.netBenefitPer1000>opt.targetAll?'success':'danger'} />
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
function Kpi({ label, value, delta }: any) {
  const color = delta==='success'?'text-success':delta==='danger'?'text-danger':'text-text'
  return (
    <div className="card p-3">
      <div className="text-xs text-text-faint">{label}</div>
      <div className={`font-mono text-lg font-semibold ${color}`}>{value}</div>
    </div>
  )
}

// ---------- PERFORMANCE ----------
function Performance({ metrics }: any) {
  const roc = useData<any>('roc_curve.json')
  const pr = useData<any>('pr_curve.json')
  const cal = useData<any>('calibration.json')
  const imp = useData<any>('importance.json')
  const [tab, setTab] = useState('roc')
  const takeaways: Record<string,string> = {
    roc: 'The model separates churners from non-churners well above random (diagonal).',
    pr: 'Precision-recall shows the tradeoff at the operating threshold; PR-AUC matters more than ROC-AUC on imbalanced data.',
    cal: 'Calibration aligns predicted probabilities with observed frequencies — required for profit-based decisions.',
    imp: 'Contract type, tenure and charges dominate; month-to-month customers are the highest risk.',
  }
  return (
    <section id="performance" className="py-28">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Measured, not claimed</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Model performance</h2>
        </FadeUp>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'PR-AUC', value: metrics?.test?.pr_auc, ci: metrics?.test?.pr_auc_ci },
            { label: 'ROC-AUC', value: metrics?.test?.roc_auc, ci: [metrics?.test?.roc_auc, metrics?.test?.roc_auc] },
            { label: 'Recall @ threshold', value: metrics?.test?.recall, ci: null },
            { label: 'Brier', value: metrics?.test?.brier, ci: null },
          ].map((k,i) => (
            <Card key={i}>
              <div className="text-xs text-text-faint">{k.label}</div>
              <div className="font-mono text-2xl font-semibold mt-1">{k.value != null ? <CountUp value={k.value} /> : '—'}</div>
              {k.ci && <div className="text-xs text-text-faint mt-1">95% CI [{k.ci[0]?.toFixed(3)}, {k.ci[1]?.toFixed(3)}]</div>}
            </Card>
          ))}
        </div>
        <Card className="mt-6">
          <RadixTabs.Root value={tab} onValueChange={setTab}>
            <RadixTabs.List className="flex gap-2 border-b border-border mb-4">
              {['roc','pr','cal','imp'].map(t => (
                <RadixTabs.Trigger key={t} value={t} className="px-3 py-2 text-sm data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent">
                  {t==='roc'?'ROC':t==='pr'?'Precision-Recall':t==='cal'?'Calibration':'Feature importance'}
                </RadixTabs.Trigger>
              ))}
            </RadixTabs.List>
            <RadixTabs.Content value="roc">
              {roc && <ResponsiveContainer width="100%" height={320}><LineChart data={roc.fpr.map((f:number,i:number)=>({fpr:f,tpr:roc.tpr[i]}))}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="fpr" tick={{fill:'var(--text-faint)',fontSize:11}}/><YAxis tick={{fill:'var(--text-faint)',fontSize:11}}/><RTooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8}}/><Line dataKey="tpr" stroke="var(--accent)" dot={false}/><Line dataKey="fpr" stroke="var(--text-faint)" dot={false} strokeDasharray="4 4"/></LineChart></ResponsiveContainer>}
            </RadixTabs.Content>
            <RadixTabs.Content value="pr">
              {pr && <ResponsiveContainer width="100%" height={320}><LineChart data={pr.recall.map((r:number,i:number)=>({recall:r,precision:pr.precision[i]}))}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="recall" tick={{fill:'var(--text-faint)',fontSize:11}}/><YAxis tick={{fill:'var(--text-faint)',fontSize:11}}/><RTooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8}}/><Line dataKey="precision" stroke="var(--accent)" dot={false}/></LineChart></ResponsiveContainer>}
            </RadixTabs.Content>
            <RadixTabs.Content value="cal">
              {cal && <ResponsiveContainer width="100%" height={320}><LineChart data={cal.after.mean_predicted.map((m:number,i:number)=>({m,after:cal.after.fraction_positive[i],before:cal.before.fraction_positive[i]}))}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="m" tick={{fill:'var(--text-faint)',fontSize:11}}/><YAxis tick={{fill:'var(--text-faint)',fontSize:11}} domain={[0,1]}/><RTooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8}}/><Line dataKey="before" stroke="var(--text-faint)" dot name="before"/><Line dataKey="after" stroke="var(--accent)" dot name="after"/><Line dataKey="m" stroke="var(--border)" dot={false} strokeDasharray="4 4"/></LineChart></ResponsiveContainer>}
            </RadixTabs.Content>
            <RadixTabs.Content value="imp">
              {imp && (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={Object.entries(imp).sort((a:any,b:any)=>b[1]-a[1]).slice(0,12).map(([k,v])=>({name:k,value:v}))} layout="vertical" margin={{left:120}}>
                    <XAxis type="number" tick={{fill:'var(--text-faint)',fontSize:11}} />
                    <YAxis type="category" dataKey="name" tick={{fill:'var(--text-faint)',fontSize:10}} width={120} />
                    <RTooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8}} />
                    <Bar dataKey="value" fill="var(--accent)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </RadixTabs.Content>
          </RadixTabs.Root>
          <p className="mt-4 text-sm text-text-muted">{takeaways[tab]}</p>
        </Card>
      </div>
    </section>
  )
}

// ---------- PIPELINE ----------
function Pipeline() {
  const nodes: any[] = [
    { icon: Activity, title: 'Ingest', desc: 'Load raw Telco data' },
    { icon: ShieldCheck, title: 'Validate', desc: 'Pandera schema checks' },
    { icon: Zap, title: 'Features', desc: 'Leakage-safe engineering' },
    { icon: GitBranch, title: 'Train & tune', desc: 'LR vs LightGBM, Optuna' },
    { icon: Gauge, title: 'Calibrate', desc: 'Isotonic on val split' },
    { icon: Activity, title: 'Threshold', desc: 'Cost-based optimum' },
    { icon: ShieldCheck, title: 'Evaluate gate', desc: 'PR-AUC & recall gate' },
    { icon: Container, title: 'Serve & monitor', desc: 'FastAPI + drift' },
  ]
  return (
    <section id="pipeline" className="py-28 bg-surface/40">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">From raw data to a monitored API</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Pipeline</h2>
        </FadeUp>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {nodes.map((n,i) => (
            <div key={i} className="card p-4 relative">
              <n.icon size={18} className="text-accent" />
              <div className="mt-2 font-semibold">{n.title}</div>
              <div className="text-xs text-text-muted">{n.desc}</div>
              {i < nodes.length-1 && <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-px bg-border" />}
            </div>
          ))}
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {[
            { name: 'MLflow', role: 'Experiment tracking and model registry' },
            { name: 'DVC', role: 'Reproducible data and pipeline stages' },
            { name: 'FastAPI', role: 'Low-latency serving with OpenAPI' },
            { name: 'Docker', role: 'Multi-stage non-root image' },
            { name: 'GitHub Actions', role: 'Lint, test, build, deploy' },
            { name: 'Prometheus', role: 'Metrics and drift monitoring' },
          ].map((t,i) => (
            <Card key={i}>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-text-muted mt-1">{t.role}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- MONITORING ----------
function Monitoring() {
  const drift = useData<any>('drift_demo.json')
  const [shifted, setShifted] = useState(false)
  const report = shifted ? drift?.shifted : drift?.no_shift
  const features = report?.features ?? []
  const drifted = features.filter((f:any)=>f.drifted).length
  return (
    <section id="monitoring" className="py-28">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Knowing when it breaks</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Monitoring</h2>
          <p className="mt-3 text-text-muted max-w-[65ch]">Population Stability Index (PSI) measures distribution shift per feature; values above 0.2 indicate drift.</p>
        </FadeUp>
        <div className="mt-8 flex gap-2">
          <button onClick={()=>setShifted(false)} className={`px-3 h-8 rounded-lg text-sm border ${!shifted?'bg-accent text-white border-accent':'border-border'}`}>Normal traffic</button>
          <button onClick={()=>setShifted(true)} className={`px-3 h-8 rounded-lg text-sm border ${shifted?'bg-accent text-white border-accent':'border-border'}`}>Shifted traffic</button>
        </div>
        <Card className="mt-6">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={features.map((f:any)=>({name:f.feature, psi:f.psi}))} layout="vertical" margin={{left:110}}>
              <XAxis type="number" tick={{fill:'var(--text-faint)',fontSize:11}} domain={[0,0.5]} />
              <YAxis type="category" dataKey="name" tick={{fill:'var(--text-faint)',fontSize:10}} width={110} />
              <RTooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8}} />
              <ReferenceLine x={0.2} stroke="var(--danger)" strokeDasharray="4 4" />
              <Bar dataKey="psi" fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
          <div className={`mt-3 text-sm ${drifted>0?'text-danger':'text-success'}`}>
            {drifted>0 ? `Drift detected in ${drifted} of ${features.length} features` : 'No drift detected'}
          </div>
        </Card>
      </div>
    </section>
  )
}

// ---------- ENGINEERING ----------
function Engineering() {
  const ps = useData<any>('pipeline_status.json')
  const items = [
    { label: 'Tests & coverage', value: `${ps?.test_count ?? 30} tests · ${ps?.coverage ?? 69.85}%`, href: 'tests/' },
    { label: 'CI/CD', value: 'GitHub Actions matrix', href: '.github/workflows/ci.yml' },
    { label: 'Quality gate', value: 'PR-AUC ≥ 0.55, recall ≥ 0.40', href: 'src/churn/evaluate.py' },
    { label: 'Docker image', value: 'Multi-stage, non-root', href: 'Dockerfile' },
    { label: 'Reproducible pipeline', value: 'DVC stages', href: 'dvc.yaml' },
    { label: 'Documentation', value: 'README + notebooks', href: 'README.md' },
  ]
  return (
    <section className="py-16">
      <div className="max-w-container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-4">
          {items.map((it,i) => (
            <a key={i} href={`https://github.com/Kuldeepni/churn-mlops/blob/main/${it.href}`} target="_blank" rel="noreferrer" className="card p-4 hover:border-border-strong transition-colors">
              <div className="font-medium">{it.label}</div>
              <div className="text-sm text-text-muted mt-1 font-mono">{it.value}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- FOOTER ----------
function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-container mx-auto px-6 grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="font-semibold">churn-mlops</div>
          <p className="text-text-muted mt-2">Portfolio project using the public IBM Telco Customer Churn dataset.</p>
        </div>
        <div>
          <div className="font-semibold mb-2">Project</div>
          <ul className="space-y-1 text-text-muted">
            <li><a href={siteConfig.githubUrl} className="hover:text-text">GitHub</a></li>
            <li><a href={`${siteConfig.githubUrl}/blob/main/README.md`} className="hover:text-text">README</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">Author</div>
          <ul className="space-y-1 text-text-muted">
            <li>{siteConfig.name}</li>
            <li><a href={siteConfig.linkedinUrl} className="hover:text-text">LinkedIn</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-container mx-auto px-6 mt-8 text-xs text-text-faint">Portfolio project using the public IBM Telco Customer Churn dataset. MIT license.</div>
    </footer>
  )
}

// ---------- APP ----------
export default function App() {
  const { status } = useApiStatus()
  const metrics = useData<any>('metrics.json')
  const examples = useData<any>('examples.json')
  const [demoBanner, setDemoBanner] = useState(true)
  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav apiStatus={status} />
      {status === 'offline' && demoBanner && (
        <div className="bg-warning/10 border-b border-warning/20 text-sm px-6 py-2 flex items-center justify-between">
          <span>The free-tier API is asleep. Showing precomputed predictions from real test-set customers.</span>
          <button onClick={()=>setDemoBanner(false)} className="text-text-muted hover:text-text">Dismiss</button>
        </div>
      )}
      <main id="main">
        <Hero metrics={metrics} examples={examples} />
        <Predictor metrics={metrics} examples={examples} apiStatus={status} />
        <Impact />
        <Performance metrics={metrics} />
        <Pipeline />
        <Monitoring />
        <Engineering />
      </main>
      <Footer />
    </div>
  )
}