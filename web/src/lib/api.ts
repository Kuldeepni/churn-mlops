import type { CustomerFeatures, PredictResult, Prediction } from './types'

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://kuldeepni-churn-mlops-api.hf.space'

export class ApiError extends Error {
  readonly status: number
  readonly retryAfterSeconds?: number

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function requestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface RequestOptions {
  retries?: number
  timeoutMs?: number
  signal?: AbortSignal
}

interface Envelope<T> {
  data: T
  latencyMs: number
  requestId: string
}

async function request<T>(path: string, init: RequestInit, options: RequestOptions = {}): Promise<Envelope<T>> {
  const { retries = 2, timeoutMs = 20000, signal } = options
  const id = requestId()
  const started = performance.now()
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const forwardAbort = () => controller.abort()
    signal?.addEventListener('abort', forwardAbort, { once: true })

    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...(init.headers ?? {}), 'X-Request-ID': id },
      })

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After') ?? 30)
        throw new ApiError(
          'The model server is rate limiting requests. Try again shortly.',
          429,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30,
        )
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string; error?: string }
        throw new ApiError(body.detail || body.error || `Request failed (HTTP ${response.status})`, response.status)
      }

      const data = (await response.json()) as T
      return { data, latencyMs: Math.round(performance.now() - started), requestId: id }
    } catch (error) {
      lastError = error
      if (error instanceof ApiError) throw error
      if (attempt === retries) break
      await sleep(400 * 2 ** attempt)
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('The model server did not respond.')
}

export async function healthCheck(): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: controller.signal,
      headers: { 'X-Request-ID': requestId() },
    })
    return response.ok
  } finally {
    clearTimeout(timeout)
  }
}

interface PredictPayload {
  predictions: Prediction[]
  model_version?: string
  threshold?: number
}

export async function predictOne(features: CustomerFeatures, signal?: AbortSignal): Promise<PredictResult> {
  const { data, latencyMs, requestId: id } = await request<PredictPayload>(
    '/predict?explain=true',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [features] }),
    },
    { signal },
  )

  const prediction = data.predictions?.[0]
  if (!prediction) throw new ApiError('The API returned no prediction.', 502)

  return {
    prediction,
    latencyMs,
    modelVersion: data.model_version ?? 'unknown',
    threshold: data.threshold ?? 0.18,
    requestId: id,
  }
}

export { API_URL }
