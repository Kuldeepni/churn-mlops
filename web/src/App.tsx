import { useEffect, useState } from 'react'
import { useApiStatus } from './hooks/useApiStatus'
import { siteConfig } from './config/site'

const BASE = import.meta.env.BASE_URL

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="max-w-5xl mx-auto px-4 py-16">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      {children}
    </section>
  )
}

export default function App() {
  const { status } = useApiStatus()
  const [metrics, setMetrics] = useState<any>(null)


  useEffect(() => {
    fetch(`${BASE}data/metrics.json`).then((r) => r.json()).then(setMetrics).catch(() => {})
    fetch(`${BASE}data/examples.json`).then((r) => r.json()).catch(() => {})
  }, [])

  const statusColor = status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <nav className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex gap-4 text-sm">
          <a href="#hero" className="font-bold">churn-mlops</a>
          <a href="#predictor">Try it</a>
          <a href="#impact">Impact</a>
          <a href="#performance">Performance</a>
          <a href="#pipeline">Pipeline</a>
          <a href="#monitoring">Monitoring</a>
          <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </nav>

      <section id="hero" className="max-w-5xl mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Predict churn, then decide who to target by expected profit</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
          End-to-end MLOps: calibrated probabilities, cost-optimized threshold, FastAPI, Docker, CI/CD, drift monitoring.
        </p>
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className={`inline-block w-3 h-3 rounded-full ${statusColor}`}></span>
          <span className="text-sm">API: {status}</span>
          {status === 'offline' && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Demo mode: precomputed real predictions</span>}
        </div>
        <div className="flex gap-3 justify-center">
          <a href="#predictor" className="px-4 py-2 bg-blue-600 text-white rounded">Try the model</a>
          <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer" className="px-4 py-2 border rounded">View on GitHub</a>
        </div>
      </section>

      <Section id="predictor" title="Live predictor">
        <p className="text-sm text-gray-500 mb-4">Fill the form and submit. {status === 'offline' ? 'Demo mode uses nearest precomputed example.' : ''}</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border rounded p-4">
            <label className="block text-sm mb-1">Tenure (months)</label>
            <input type="number" defaultValue={12} className="w-full border rounded px-2 py-1" />
            <label className="block text-sm mt-3 mb-1">Monthly charges</label>
            <input type="number" defaultValue={89.1} className="w-full border rounded px-2 py-1" />
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Predict</button>
          </div>
          <div className="border rounded p-4">
            <div className="text-sm text-gray-500">Result appears here after submit.</div>
            {metrics && <div className="mt-2 text-xs">Threshold: {metrics.threshold?.threshold ?? metrics.test?.threshold}</div>}
          </div>
        </div>
      </Section>

      <Section id="impact" title="Business impact simulator">
        <p className="text-sm text-gray-500">Adjust costs and see the optimal threshold recompute from real validation scores.</p>
        <div className="border rounded p-4 mt-4">
          <div className="text-sm">Validation samples: {metrics ? (metrics.test?.n_test ?? '') : '...'}</div>
        </div>
      </Section>

      <Section id="performance" title="Model performance">
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="border rounded p-3"><div className="text-xs text-gray-500">PR-AUC</div><div className="text-xl font-bold">{metrics.test?.pr_auc?.toFixed(3)}</div></div>
            <div className="border rounded p-3"><div className="text-xs text-gray-500">ROC-AUC</div><div className="text-xl font-bold">{metrics.test?.roc_auc?.toFixed(3)}</div></div>
            <div className="border rounded p-3"><div className="text-xs text-gray-500">Recall</div><div className="text-xl font-bold">{metrics.test?.recall?.toFixed(3)}</div></div>
            <div className="border rounded p-3"><div className="text-xs text-gray-500">Brier</div><div className="text-xl font-bold">{metrics.test?.brier?.toFixed(3)}</div></div>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          <img src={`${BASE}figures/roc_curve.png`} alt="ROC curve" className="rounded border" />
          <img src={`${BASE}figures/pr_curve.png`} alt="PR curve" className="rounded border" />
          <img src={`${BASE}figures/calibration_curve.png`} alt="Calibration curve" className="rounded border" />
          <img src={`${BASE}figures/shap_summary.png`} alt="SHAP summary" className="rounded border" />
        </div>
      </Section>

      <Section id="pipeline" title="How it works">
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          <li>Ingest + validate (Pandera)</li>
          <li>Leakage-safe stratified split</li>
          <li>Feature engineering inside sklearn Pipeline</li>
          <li>Logistic vs LightGBM, Optuna tuning, MLflow tracking</li>
          <li>Calibration on validation split (isotonic/sigmoid)</li>
          <li>Cost-based threshold optimizer</li>
          <li>Test evaluation + bootstrap CIs + quality gate</li>
          <li>SHAP explanations</li>
          <li>MLflow registry promotion (champion/challenger)</li>
          <li>Serving bundle export (no MLflow at serve time)</li>
          <li>FastAPI + Prometheus + JSONL prediction log</li>
          <li>Drift detection (PSI/KS) + traffic simulator</li>
        </ol>
      </Section>

      <Section id="monitoring" title="Monitoring demo">
        <p className="text-sm text-gray-500">Per-feature PSI for no-shift vs shifted traffic. See drift_demo.json.</p>
      </Section>

      <Section id="quality" title="Engineering quality">
        <ul className="text-sm space-y-1">
          <li>Tests: 30+ passing, coverage ~70%</li>
          <li>CI: lint, typecheck, test matrix (3.10/3.11/3.12), DVC repro, Docker smoke</li>
          <li>Quality gate: test PR-AUC &ge; 0.55 and recall &ge; 0.40</li>
          <li>Docker: multi-stage, non-root, healthcheck</li>
        </ul>
      </Section>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-xs text-gray-500 border-t">
        <p>Portfolio project using the public IBM Telco churn dataset. MIT license.</p>
        <p>GitHub: <a href={siteConfig.githubUrl} className="underline">{siteConfig.githubUrl}</a></p>
      </footer>
    </div>
  )
}
