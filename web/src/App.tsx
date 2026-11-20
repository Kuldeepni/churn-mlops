import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, ReferenceLine } from 'recharts'
import { Activity, ArrowRight, Github, Moon, Sun, Menu, X, Zap, ShieldCheck, Container, GitBranch, Cpu, Database, Server, Boxes, BarChart3, CheckCircle2 } from 'lucide-react'
import * as RadixTabs from '@radix-ui/react-tabs'
import * as RadixSwitch from '@radix-ui/react-switch'
import * as RadixDialog from '@radix-ui/react-dialog'
import * as RadixSlider from '@radix-ui/react-slider'

import { useApiStatus, type ApiStatus } from './hooks/useApiStatus'
import { useTheme } from './hooks/useTheme'
import { siteConfig } from './config/site'
import { predict, type CustomerFeatures, type Prediction } from './lib/api'
import { optimizeThreshold } from './lib/threshold'

const BASE = import.meta.env.BASE_URL
function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => { fetch(`${BASE}data/${path}`).then(r=>r.json()).then(setData).catch(()=>{}) }, [path])
  return data
}

function FadeUp({ children, className='' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return <motion.div ref={ref} initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4 }} className={className}>{children}</motion.div>
}

// ---------- NAV ----------
function Nav({ apiStatus }: { apiStatus: ApiStatus }) {
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 8); window.addEventListener('scroll', onScroll); return () => window.removeEventListener('scroll', onScroll) }, [])
  const links = ['Predict','Impact','Performance','Pipeline','Monitoring']
  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md bg-bg/80 border-b transition-colors ${scrolled ? 'border-border' : 'border-transparent'}`}>
      <div className="max-w-container mx-auto px-6 h-14 flex items-center gap-6">
        <a href="#hero" className="flex items-center gap-2 font-semibold tracking-tight">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="1" y="1" width="20" height="20" rx="6" stroke="currentColor" strokeWidth="1.5"/><path d="M4 16 L8 11 L12 13 L18 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
          <button onClick={toggle} aria-label="Toggle theme" className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text">
            {theme==='dark' ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
          <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 text-sm px-3 h-9 rounded-btn border border-border hover:bg-surface-2">
            <Github size={14}/> GitHub
          </a>
          <button className="md:hidden p-2" onClick={()=>setOpen(true)}><Menu size={18}/></button>
        </div>
      </div>
      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <RadixDialog.Content className="fixed inset-x-0 top-0 bg-bg border-b border-border p-6 z-50">
            <div className="flex justify-between mb-4"><span className="font-semibold">Menu</span><button onClick={()=>setOpen(false)}><X size={18}/></button></div>
            <div className="flex flex-col gap-3">{links.map(l => <a key={l} href={`#${l.toLowerCase()}`} onClick={()=>setOpen(false)} className="text-lg">{l}</a>)}</div>
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
    if (paused || !examples?.length) return
    const id = setInterval(() => setIdx(i => (i+1)%Math.min(3, examples.length)), 6000)
    return () => clearInterval(id)
  }, [paused, examples])
  const ex = examples?.[idx] ?? examples?.[0]
  const prAuc = metrics?.test?.pr_auc
  const recall = metrics?.test?.recall
  const net = metrics?.test?.net_benefit_per_1000
  const threshold = metrics?.test?.threshold ?? 0.18
  return (
    <section id="hero" className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
      <div className="relative max-w-container mx-auto px-6">
        <div className="grid md:grid-cols-[55fr_45fr] gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-accent-soft text-accent border border-accent/20">Open-source MLOps case study</span>
            <h1 className="mt-6 text-4xl md:text-[64px] leading-[1.05] md:leading-[64px] font-semibold tracking-[-0.035em]">
              Predict churn. <span className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">Decide by profit.</span>
            </h1>
            <p className="mt-5 text-lg text-text-muted max-w-[52ch]">A production-grade pipeline that turns calibrated probabilities into retention decisions that maximize expected profit, with experiment tracking, CI/CD and drift monitoring.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#predict" className="btn btn-primary">Try the live model <ArrowRight size={16}/></a>
              <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer" className="btn btn-ghost"><Github size={14}/> View source</a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm flex-wrap">
              {[
                { label: 'PR-AUC', value: prAuc, d: 3 },
                { label: 'Recall @ threshold', value: recall, d: 3 },
                { label: 'Extra profit / 1k', value: net ? net/1000 : null, d: 1, prefix: '$' },
                { label: 'Tests passing', value: 42, d: 0 },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-6">
                  {i>0 && <div className="w-px h-8 bg-border" />}
                  <div>
                    <div className="text-text-faint text-xs uppercase tracking-[0.08em]">{s.label}</div>
                    <div className="font-mono text-lg font-semibold">{s.prefix}{s.value != null ? (typeof s.value==='number' ? s.value.toFixed(s.d) : s.value) : '—'}</div>
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
                  {Object.entries(ex.features).slice(0,8).map(([k,v]) => <span key={k} className="text-xs px-2 py-0.5 rounded-md bg-surface-2 border border-border font-mono">{k}:{String(v).slice(0,12)}</span>)}
                </div>
                <Gauge value={ex.churn_probability} threshold={threshold} />
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
            ) : <div className="h-48 bg-surface-2 rounded-lg animate-pulse" />}
          </div>
        </div>
      </div>
    </section>
  )
}

function Gauge({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.max(0, Math.min(1, value))
  const r = 80, cx = 100, cy = 100
  const angle = Math.PI - pct * Math.PI
  const x = cx + r * Math.cos(angle), y = cy - r * Math.sin(angle)
  const color = pct >= 0.5 ? 'var(--danger)' : pct >= 0.25 ? 'var(--warning)' : 'var(--success)'
  const tAngle = Math.PI - threshold * Math.PI
  const tx = cx + (r+6) * Math.cos(tAngle), ty = cy - (r+6) * Math.sin(tAngle)
  return (
    <div className="flex justify-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
        <path d={`M20,100 A80,80 0 0,1 ${x},${y}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        <circle cx={tx} cy={ty} r="3" fill="var(--accent)" />
        <text x="100" y="95" textAnchor="middle" className="font-mono" style={{ fontSize: 28, fontWeight: 600, fill: 'var(--text)' }}>{(pct*100).toFixed(0)}%</text>
        <text x="100" y="112" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-faint)' }}>churn probability</text>
      </svg>
    </div>
  )
}

// ---------- PREDICTOR ----------
function Predictor({ metrics, examples, apiStatus }: any) {
  const threshold = metrics?.test?.threshold ?? 0.18
  const DEFAULT_FORM: CustomerFeatures = { gender:'Female', SeniorCitizen:'No', Partner:'Yes', Dependents:'No', tenure:12, PhoneService:'Yes', MultipleLines:'No', InternetService:'DSL', OnlineSecurity:'No', OnlineBackup:'Yes', DeviceProtection:'No', TechSupport:'No', StreamingTV:'No', StreamingMovies:'No', Contract:'Month-to-month', PaperlessBilling:'Yes', PaymentMethod:'Electronic check', MonthlyCharges:50, TotalCharges:600 }
  const [form, setForm] = useState<CustomerFeatures>(() => examples?.[0]?.features ?? DEFAULT_FORM)
  const [preset, setPreset] = useState('high')
  const [result, setResult] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)

  useEffect(() => { if (examples?.length) setForm(examples[0].features) }, [examples])

  const loadPreset = (p: string) => {
    setPreset(p)
    if (p === 'random') { const e = examples?.[Math.floor(Math.random()*examples.length)]; if (e) setForm(e.features) }
    else if (p === 'high') { const e = examples?.find((x:any)=>x.risk_band==='high') ?? examples?.[0]; if (e) setForm(e.features) }
    else { const e = examples?.find((x:any)=>x.risk_band==='low') ?? examples?.[0]; if (e) setForm(e.features) }
  }

  const run = async (f: CustomerFeatures) => {
    setLoading(true); setError(null)
    try {
      if (apiStatus === 'online') {
        const r = await predict([f])
        setResult(r)
      } else {
        const nearest = nearestExample(f, examples)
        setResult({ churn_probability: nearest.churn_probability, will_churn: nearest.will_churn, risk_band: nearest.risk_band, top_factors: nearest.top_factors })
      }
    } catch (e: any) {
      if (e?.message?.includes('429')) { setCooldown(true); setTimeout(()=>setCooldown(false), 5000) }
      setError(e?.message || 'Prediction failed')
    } finally { setLoading(false) }
  }

  const update = (k: keyof CustomerFeatures, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <section id="predict" className="py-28">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Live model</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Try it on a customer</h2>
          <p className="mt-3 text-text-muted max-w-[65ch]">Adjust the attributes; prediction runs when you click Predict. No submit needed beyond that.</p>
        </FadeUp>
        <div className="mt-10 grid lg:grid-cols-[480px_1fr] gap-6">
          <div className="card p-6 space-y-4">
            <div className="flex gap-2">
              {['High risk','Loyal','Random real customer'].map((l,i) => {
                const key = i===0?'high':i===1?'low':'random'
                return <button key={key} onClick={()=>loadPreset(key)} className={`px-3 h-8 rounded-lg text-xs border ${preset===key?'bg-accent text-white border-accent':'border-border hover:bg-surface-2'}`}>{l}</button>
              })}
            </div>
            {loading && <div className="h-1 bg-border rounded overflow-hidden"><div className="h-full bg-accent animate-pulse w-1/2" /></div>}
            <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Account</div>
            <div className="space-y-3">
              <Field label="Tenure (months)">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={form.tenure} onChange={e=>update('tenure', +e.target.value)} className="flex-1 accent-accent" />
                  <span className="font-mono text-sm w-10 text-right">{form.tenure}</span>
                </div>
              </Field>
              <Field label="Contract">
                <select value={form.Contract} onChange={e=>update('Contract', e.target.value)} className="input w-full">
                  {['Month-to-month','One year','Two year'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Paperless billing">
                <RadixSwitch.Root checked={form.PaperlessBilling==='Yes'} onCheckedChange={v=>update('PaperlessBilling', v?'Yes':'No')} className="w-10 h-6 bg-border rounded-full relative data-[state=checked]:bg-accent">
                  <RadixSwitch.Thumb className="block w-4 h-4 bg-white rounded-full translate-x-1 data-[state=checked]:translate-x-5 transition-transform" />
                </RadixSwitch.Root>
              </Field>
              <Field label="Payment method">
                <select value={form.PaymentMethod} onChange={e=>update('PaymentMethod', e.target.value)} className="input w-full">
                  {['Electronic check','Mailed check','Bank transfer (automatic)','Credit card (automatic)'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Services</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Internet service">
                <select value={form.InternetService} onChange={e=>update('InternetService', e.target.value)} className="input w-full">
                  {['DSL','Fiber optic','No'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Phone service">
                <select value={form.PhoneService} onChange={e=>update('PhoneService', e.target.value)} className="input w-full">
                  {['Yes','No'].map(o=><option key={o}>{o}</option>)}
                </select>
              </Field>
              {['OnlineSecurity','OnlineBackup','DeviceProtection','TechSupport','StreamingTV','StreamingMovies'].map(k => (
                <Field key={k} label={k.replace(/([A-Z])/g,' $1').trim()}>
                  <select value={(form as any)[k]} onChange={e=>update(k as any, e.target.value)} className="input w-full">
                    {['Yes','No','No internet service'].map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
              ))}
            </div>
            <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Billing</div>
            <Field label="Monthly charges">
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={200} step={0.5} value={form.MonthlyCharges} onChange={e=>update('MonthlyCharges', +e.target.value)} className="flex-1 accent-accent" />
                <span className="font-mono text-sm w-14 text-right">${form.MonthlyCharges.toFixed(1)}</span>
              </div>
            </Field>
            <Field label="Total charges (read-only)">
              <input readOnly value={form.TotalCharges} className="input w-full font-mono bg-surface-2" />
            </Field>
            <button onClick={()=>run(form)} disabled={loading} className="w-full h-10 rounded-btn bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {loading ? 'Predicting…' : 'Predict churn'}
            </button>
            {error && <div className="mt-3 text-sm text-danger">{error} <button onClick={()=>run(form)} className="underline">Retry</button></div>}
            {cooldown && <div className="mt-3 text-sm text-warning">Rate limited. Please wait a moment.</div>}
          </div>
          <div className="lg:sticky lg:top-24 self-start space-y-4">
            <div className="card p-6">
              <Gauge value={result?.churn_probability ?? 0} threshold={threshold} />
              <div className="text-center text-xs text-text-faint mt-1">Threshold {threshold.toFixed(2)} maximizes expected profit</div>
            </div>
            {result && (
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`card p-4 ${result.will_churn?'bg-danger/5 border-danger/30':'bg-success/5 border-success/30'}`}>
                <div className="flex items-center gap-2 font-medium">
                  {result.will_churn ? <Activity className="text-danger" size={16}/> : <ShieldCheck className="text-success" size={16}/>}
                  {result.will_churn ? 'Target with retention offer' : 'No action needed'}
                </div>
                <div className="text-xs text-text-muted mt-1">Threshold {threshold.toFixed(2)} maximizes expected profit</div>
                <div className="mt-4 space-y-2">
                  {result.top_factors.map((f:any, i:number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted truncate flex-1">{f.feature.replace(/_/g,' ')}</span>
                      <span className={`font-mono ${f.direction==='increases_churn'?'text-danger':'text-success'}`}>{f.direction==='increases_churn'?'+':'-'}{Math.abs(f.impact).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            <div className="card p-4 text-xs text-text-faint space-y-1">
              <div>Model version: {result ? 'churn-classifier' : '—'}</div>
              <div>Source: {apiStatus === 'online' ? 'Live API' : 'Precomputed (nearest customer)'}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, children, hint }: any) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  )
}

function nearestExample(f: CustomerFeatures, examples: any[]) {
  if (!examples?.length) return examples?.[0] ?? { churn_probability: 0, will_churn: false, risk_band: 'low', top_factors: [] }
  let best = examples[0], bestD = Infinity
  for (const e of examples) {
    const ef = e.features
    let d = 0
    d += Math.abs((ef.tenure ?? 0) - f.tenure) / 70
    d += Math.abs((ef.MonthlyCharges ?? 0) - f.MonthlyCharges) / 200
    d += (ef.Contract !== f.Contract ? 1 : 0)
    d += (ef.InternetService !== f.InternetService ? 1 : 0)
    if (d < bestD) { bestD = d; best = e }
  }
  return best
}

// ---------- IMPACT ----------
function Impact() {
  const scores = useData<any>('validation_scores.json')
  const [clv, setClv] = useState(1200)
  const [cost, setCost] = useState(60)
  const [success, setSuccess] = useState(0.35)
  const [base, setBase] = useState(1000)
  const opt = useMemo(() => scores ? optimizeThreshold(scores, clv, cost, success) : null, [scores, clv, cost, success, base])
  return (
    <section id="impact" className="py-28 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Business impact</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">What it's worth</h2>
          <p className="mt-3 text-text-muted max-w-[65ch]">Accuracy is the wrong objective. The threshold that maximizes expected profit is not 0.5.</p>
        </FadeUp>
        <div className="mt-10 grid lg:grid-cols-[360px_1fr] gap-6">
          <div className="card p-6 space-y-5">
            <SliderRow label="Customer lifetime value" value={clv} set={setClv} min={200} max={5000} step={50} fmt={(v:number)=>`$${v}`} />
            <SliderRow label="Retention offer cost" value={cost} set={setCost} min={10} max={300} step={5} fmt={(v:number)=>`$${v}`} />
            <SliderRow label="Offer success rate" value={success} set={setSuccess} min={0.05} max={0.9} step={0.05} fmt={(v:number)=>`${(v*100).toFixed(0)}%`} />
            <SliderRow label="Customer base (thousands)" value={base} set={setBase} min={100} max={10000} step={100} fmt={(v:number)=>v.toLocaleString()} />
          </div>
          <div className="card p-6">
            {opt ? (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={opt.curve}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} tickFormatter={(v:number)=>v.toFixed(2)} />
                    <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11 }} tickFormatter={(v:number)=>`$${(v/1000).toFixed(0)}k`} />
                    <RTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v:any)=>[`$${Number(v).toLocaleString()}`,'Net benefit/1k']} labelFormatter={(v:any)=>`Threshold ${Number(v).toFixed(2)}`} />
                    <Line type="monotone" dataKey="net" stroke="var(--accent)" strokeWidth={2} dot={false} />
                    <ReferenceLine x={opt.threshold} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: `Optimal ${opt.threshold.toFixed(2)}`, fill:'var(--accent)', fontSize:11 }} />
                    <ReferenceLine x={0.5} stroke="var(--text-faint)" strokeDasharray="2 4" label={{ value: 'naive 0.5', fill:'var(--text-faint)', fontSize:10 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <Kpi label="Profit at optimum" value={`$${(opt.netBenefitPer1000*base/1000).toFixed(0)}`} />
                  <Kpi label="vs naive 0.5" value={`$${((opt.netBenefitPer1000-opt.atHalf)*base/1000).toFixed(0)}`} delta={opt.netBenefitPer1000>opt.atHalf?'up':'down'} />
                  <Kpi label="vs target everyone" value={`$${((opt.netBenefitPer1000-opt.targetAll)*base/1000).toFixed(0)}`} delta={opt.netBenefitPer1000>opt.targetAll?'up':'down'} />
                </div>
              </>
            ) : <div className="h-80 bg-surface-2 rounded-lg animate-pulse" />}
          </div>
        </div>
      </div>
    </section>
  )
}

function SliderRow({ label, value, set, min, max, step, fmt }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm text-text-muted">{label}</label>
        <span className="font-mono text-sm font-medium">{fmt(value)}</span>
      </div>
      <RadixSlider.Root value={[value]} onValueChange={([v])=>set(v)} min={min} max={max} step={step} className="relative flex items-center select-none touch-none w-full h-5">
        <RadixSlider.Track className="bg-border relative grow rounded-full h-1.5">
          <RadixSlider.Range className="absolute bg-accent rounded-full h-full" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="block w-4 h-4 bg-white rounded-full shadow border-2 border-accent focus:outline-none" />
      </RadixSlider.Root>
    </div>
  )
}

function Kpi({ label, value, delta }: any) {
  return (
    <div className="card p-4">
      <div className="text-xs text-text-faint uppercase tracking-[0.08em]">{label}</div>
      <div className="font-mono text-xl font-semibold mt-1">{value}</div>
      {delta && <div className={`text-xs mt-1 ${delta==='up'?'text-success':'text-danger'}`}>{delta==='up'?'▲':'▼'} vs baseline</div>}
    </div>
  )
}

// ---------- PERFORMANCE ----------
function Performance() {
  const metrics = useData<any>('metrics.json')
  const roc = useData<any>('roc_curve.json')
  const pr = useData<any>('pr_curve.json')
  const cal = useData<any>('calibration.json')
  const imp = useData<any>('importance.json')
  const [tab, setTab] = useState('roc')
  const tabs = [
    { id: 'roc', label: 'ROC' },
    { id: 'pr', label: 'Precision-Recall' },
    { id: 'cal', label: 'Calibration' },
    { id: 'imp', label: 'Feature importance' },
  ]
  const takeaways: Record<string,string> = {
    roc: 'The model separates churners from non-churners well above the diagonal (random) baseline.',
    pr: 'Precision-recall is the honest metric for an imbalanced problem like churn.',
    cal: 'Isotonic calibration pulls predicted probabilities onto the diagonal, so thresholds mean what they say.',
    imp: 'Contract type and tenure dominate; short-tenure, month-to-month customers are the riskiest.',
  }
  return (
    <section id="performance" className="py-28 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Measured, not claimed</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Performance</h2>
          <p className="mt-3 text-text-muted max-w-[65ch]">Held-out test set, 1,409 customers, evaluated once.</p>
        </FadeUp>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="PR-AUC" value={metrics?.test?.pr_auc ?? metrics?.pr_auc} ci={metrics?.test?.pr_auc_ci ?? metrics?.pr_auc_ci} />
          <KpiCard label="ROC-AUC" value={metrics?.test?.roc_auc ?? metrics?.roc_auc} />
          <KpiCard label="Recall @ threshold" value={metrics?.test?.recall ?? metrics?.recall} />
          <KpiCard label="Brier score" value={metrics?.test?.brier ?? metrics?.brier} />
        </div>
        <div className="mt-8 card p-6">
          <RadixTabs.Root value={tab} onValueChange={setTab}>
            <RadixTabs.List className="flex gap-2 border-b border-border mb-4">
              {tabs.map(t => (
                <RadixTabs.Trigger key={t.id} value={t.id} className="px-3 py-2 text-sm text-text-muted data-[state=active]:text-text data-[state=active]:border-b-2 data-[state=active]:border-accent -mb-px">
                  {t.label}
                </RadixTabs.Trigger>
              ))}
            </RadixTabs.List>
            <div className="h-72">
              {tab === 'roc' && roc && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={roc.fpr.map((f:number,i:number)=>({fpr:f, tpr:roc.tpr[i]}))}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="fpr" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                    <Line type="monotone" dataKey="tpr" stroke="var(--accent)" strokeWidth={2} dot={false} />
                    <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="var(--text-faint)" strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {tab === 'pr' && pr && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pr.recall.map((r:number,i:number)=>({recall:r, precision:pr.precision[i]}))}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="recall" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                    <Line type="monotone" dataKey="precision" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {tab === 'cal' && cal && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cal.before.mean_predicted.map((m:number,i:number)=>({ x: m, before: cal.before.fraction_positive[i], after: cal.after.fraction_positive[i] }))}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="x" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                    <Line type="monotone" dataKey="before" stroke="var(--text-faint)" strokeWidth={1.5} dot={false} name="Uncalibrated" />
                    <Line type="monotone" dataKey="after" stroke="var(--accent)" strokeWidth={2} dot={false} name="Calibrated" />
                    <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="var(--text-faint)" strokeDasharray="2 4" />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {tab === 'imp' && imp && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(imp).map(([k,v])=>({name:k, value:v})).sort((a:any,b:any)=>b.value-a.value).slice(0,12)} layout="vertical">
                    <CartesianGrid stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} width={140} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="mt-3 text-sm text-text-muted">{takeaways[tab]}</p>
          </RadixTabs.Root>
        </div>
      </div>
    </section>
  )
}

function KpiCard({ label, value, ci }: any) {
  return (
    <div className="card p-5">
      <div className="text-xs text-text-faint uppercase tracking-[0.08em]">{label}</div>
      <div className="font-mono text-3xl font-semibold mt-2">{typeof value === 'number' ? value.toFixed(3) : '—'}</div>
      {ci && <div className="text-xs text-text-faint mt-1">95% CI [{ci[0]?.toFixed(3)}, {ci[1]?.toFixed(3)}]</div>}
    </div>
  )
}

// ---------- PIPELINE ----------
function Pipeline() {
  const nodes = [
    { icon: Database, title: 'Ingest', desc: 'Download & validate raw data' },
    { icon: ShieldCheck, title: 'Validate', desc: 'Pandera schema checks' },
    { icon: Zap, title: 'Features', desc: 'Engineer churn signals' },
    { icon: Cpu, title: 'Train & tune', desc: 'Optuna + MLflow' },
    { icon: Activity, title: 'Calibrate', desc: 'Isotonic / sigmoid' },
    { icon: BarChart3, title: 'Threshold', desc: 'Profit-optimal cutoff' },
    { icon: CheckCircle2, title: 'Evaluate gate', desc: 'PR-AUC & recall' },
    { icon: Server, title: 'Serve & monitor', desc: 'FastAPI + drift' },
  ]
  const tools = [
    { name: 'MLflow', desc: 'Experiment tracking & model registry' },
    { name: 'DVC', desc: 'Reproducible pipeline & data versioning' },
    { name: 'FastAPI', desc: 'Typed REST API with health checks' },
    { name: 'Docker', desc: 'Containerized, reproducible serving' },
    { name: 'GitHub Actions', desc: 'Lint, test, pipeline, deploy' },
    { name: 'Prometheus', desc: 'Latency & drift metrics' },
  ]
  return (
    <section id="pipeline" className="py-28 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">From raw data to a monitored API</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Pipeline</h2>
        </FadeUp>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {nodes.map((n, i) => (
            <div key={n.title} className="card p-4 relative">
              <div className="flex items-center gap-2 mb-2">
                <n.icon size={16} className="text-accent" />
                <span className="text-xs text-text-faint font-mono">{String(i+1).padStart(2,'0')}</span>
              </div>
              <div className="font-medium text-sm">{n.title}</div>
              <div className="text-xs text-text-muted mt-1">{n.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3">
          {tools.map(t => (
            <div key={t.name} className="card p-4">
              <div className="font-medium text-sm">{t.name}</div>
              <div className="text-xs text-text-muted mt-1">{t.desc}</div>
            </div>
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
  const data = shifted ? drift?.shifted : drift?.baseline
  const features = data?.features ?? []
  const drifted = features.filter((f:any) => (f.psi ?? 0) > 0.2).length
  return (
    <section id="monitoring" className="py-28 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Knowing when it breaks</div>
          <h2 className="mt-2 text-3xl md:text-[36px] leading-[42px] font-semibold tracking-[-0.025em]">Monitoring</h2>
          <p className="mt-3 text-text-muted max-w-[65ch]">Population Stability Index per feature. A value above 0.2 signals drift.</p>
        </FadeUp>
        <div className="mt-8 flex items-center gap-3">
          <button onClick={()=>setShifted(false)} className={`px-3 h-8 rounded-lg text-xs border ${!shifted?'bg-accent text-white border-accent':'border-border hover:bg-surface-2'}`}>Normal traffic</button>
          <button onClick={()=>setShifted(true)} className={`px-3 h-8 rounded-lg text-xs border ${shifted?'bg-accent text-white border-accent':'border-border hover:bg-surface-2'}`}>Shifted traffic</button>
          <div className={`ml-auto text-sm ${drifted>0?'text-danger':'text-success'}`}>{drifted>0 ? `Drift detected in ${drifted} of ${features.length} features` : 'No drift detected'}</div>
        </div>
        <div className="mt-6 card p-6">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={features} layout="vertical">
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} domain={[0, 0.5]} />
              <YAxis type="category" dataKey="feature" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} width={130} />
              <Bar dataKey="psi" fill="var(--accent)" radius={[0,4,4,0]} />
              <ReferenceLine x={0.2} stroke="var(--danger)" strokeDasharray="4 4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

// ---------- ENGINEERING ----------
function Engineering() {
  const facts = [
    { icon: CheckCircle2, title: '42 tests', desc: 'Unit + integration, 69.89% coverage' },
    { icon: GitBranch, title: 'CI/CD', desc: 'Lint, test matrix, pipeline, Docker, Pages' },
    { icon: ShieldCheck, title: 'Quality gate', desc: 'PR-AUC ≥ 0.60 and recall ≥ 0.40' },
    { icon: Container, title: 'Docker image', desc: 'Reproducible, smoke-tested' },
    { icon: Zap, title: 'Reproducible', desc: 'DVC pipeline, one command' },
    { icon: Boxes, title: 'Documentation', desc: 'Architecture, decisions, API docs' },
  ]
  return (
    <section id="engineering" className="py-20 border-t border-border">
      <div className="max-w-container mx-auto px-6">
        <FadeUp>
          <div className="text-xs text-text-faint uppercase tracking-[0.08em]">Engineering</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Built like a product</h2>
        </FadeUp>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3">
          {facts.map(f => (
            <div key={f.title} className="card p-4">
              <f.icon size={16} className="text-accent mb-2" />
              <div className="font-medium text-sm">{f.title}</div>
              <div className="text-xs text-text-muted mt-1">{f.desc}</div>
            </div>
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
          <div className="font-semibold mb-2">churn-mlops</div>
          <p className="text-text-muted text-xs">Portfolio project using the public IBM Telco Customer Churn dataset. MIT license.</p>
        </div>
        <div>
          <div className="font-semibold mb-2">Project</div>
          <ul className="space-y-1 text-text-muted">
            <li><a href={siteConfig.githubUrl} className="hover:text-text">GitHub</a></li>
            <li><a href="#" className="hover:text-text">Documentation</a></li>
            <li><a href="#" className="hover:text-text">API docs</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">Author</div>
          <ul className="space-y-1 text-text-muted">
            <li>{siteConfig.name}</li>
            <li><a href="#" className="hover:text-text">LinkedIn</a></li>
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
        <Performance />
        <Pipeline />
        <Monitoring />
        <Engineering />
      </main>
      <Footer />
    </div>
  )
}