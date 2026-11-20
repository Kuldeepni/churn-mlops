import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, healthCheck, predictOne } from '../src/lib/api'
import type { CustomerFeatures, Prediction } from '../src/lib/types'

const features: CustomerFeatures = {
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

const prediction: Prediction = {
  churn_probability: 0.81,
  will_churn: true,
  risk_band: 'high',
  top_factors: [{ feature: 'tenure', impact: 0.42, direction: 'increases_churn' }],
}

function response(body: unknown, init: { ok?: boolean; status?: number; retryAfter?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: (name: string) => (name === 'Retry-After' ? (init.retryAfter ?? null) : null) },
    json: async () => body,
  }
}

describe('predictOne', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('unwraps the prediction envelope and reports the model version', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ predictions: [prediction], model_version: '0.1.0', threshold: 0.18 }) as unknown as Response,
    )

    const result = await predictOne(features)

    expect(result.prediction).toEqual(prediction)
    expect(result.modelVersion).toBe('0.1.0')
    expect(result.threshold).toBe(0.18)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ instances: [features] })
  })

  it('surfaces rate limits without retrying and keeps the Retry-After value', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ detail: 'slow down' }, { ok: false, status: 429, retryAfter: '12' }) as unknown as Response,
    )

    await expect(predictOne(features)).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      retryAfterSeconds: 12,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a network failure once before succeeding', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        response({ predictions: [prediction], model_version: '0.1.0', threshold: 0.18 }) as unknown as Response,
      )

    const pending = predictOne(features)
    await vi.advanceTimersByTimeAsync(1000)
    const result = await pending

    expect(result.prediction).toEqual(prediction)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('throws a typed error when the API returns no prediction', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ predictions: [] }) as unknown as Response)

    await expect(predictOne(features)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('healthCheck', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is true for an ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 'ok' }) as unknown as Response))
    await expect(healthCheck()).resolves.toBe(true)
  })

  it('is false for a failing response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, { ok: false, status: 503 }) as unknown as Response))
    await expect(healthCheck()).resolves.toBe(false)
  })
})
