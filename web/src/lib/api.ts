export interface CustomerFeatures {
  gender: string; SeniorCitizen: string; Partner: string; Dependents: string;
  tenure: number; PhoneService: string; MultipleLines: string; InternetService: string;
  OnlineSecurity: string; OnlineBackup: string; DeviceProtection: string; TechSupport: string;
  StreamingTV: string; StreamingMovies: string; Contract: string; PaperlessBilling: string;
  PaymentMethod: string; MonthlyCharges: number; TotalCharges: number;
}
export interface TopFactor { feature: string; impact: number; direction: 'increases_churn' | 'decreases_churn' }
export interface Prediction { churn_probability: number; will_churn: boolean; risk_band: 'low'|'medium'|'high'; top_factors: TopFactor[] }
export interface PredictResponse { predictions: Prediction[]; model_version: string; threshold: number; request_id?: string }
export interface HealthResponse { status: string }

const API_URL = import.meta.env.VITE_API_URL || 'https://kuldeepni-churn-mlops-api.hf.space'

export async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastErr: Error | null = null
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeout)
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After')
        await new Promise((r) => setTimeout(r, retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (i + 1)))
        continue
      }
      return res
    } catch (e) {
      lastErr = e as Error
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw lastErr || new Error('Request failed')
}

export async function healthCheck(): Promise<HealthResponse> {
  const res = await fetchWithRetry(`${API_URL}/health`, { method: 'GET' }, 2)
  if (!res.ok) throw new Error('Health check failed')
  return res.json()
}
export async function predict(instances: CustomerFeatures[], explain = true): Promise<PredictResponse> {
  const res = await fetchWithRetry(`${API_URL}/predict?explain=${explain}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-ID': crypto.randomUUID() },
    body: JSON.stringify({ instances }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
export { API_URL }