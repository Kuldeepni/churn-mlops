import { describe, expect, it } from 'vitest'
import { expectedProfit, nearestExample, optimizeThreshold } from '../src/lib/threshold'
import type { Score } from '../src/lib/types'

const economics = { clv: 1200, offerCost: 60, successRate: 0.35 }
const valueIfChurner = economics.clv * economics.successRate - economics.offerCost

const scores: Score[] = [
  { p: 0.92, y: 1 },
  { p: 0.81, y: 1 },
  { p: 0.64, y: 0 },
  { p: 0.44, y: 1 },
  { p: 0.31, y: 0 },
  { p: 0.12, y: 0 },
]

describe('expectedProfit', () => {
  it('credits a targeted churner with CLV × success rate, minus the offer', () => {
    expect(expectedProfit([{ p: 0.9, y: 1 }], 0.5, economics)).toBe(valueIfChurner)
  })

  it('charges only the offer for a targeted non-churner', () => {
    expect(expectedProfit([{ p: 0.9, y: 0 }], 0.5, economics)).toBe(-economics.offerCost)
  })

  it('ignores customers below the threshold', () => {
    expect(expectedProfit([{ p: 0.4, y: 1 }], 0.5, economics)).toBe(0)
  })
})

describe('optimizeThreshold', () => {
  it('sweeps the configured range and reports the best point', () => {
    const result = optimizeThreshold(scores, { ...economics, baseSize: 100_000 }, 0.18)
    expect(result.curve).toHaveLength(99)
    expect(result.curve[0].threshold).toBeCloseTo(0.01)
    expect(result.curve[98].threshold).toBeCloseTo(0.99)
    expect(result.optimum).toBeGreaterThanOrEqual(0.01)
    expect(result.optimum).toBeLessThanOrEqual(0.99)
    expect(result.optimumPer1000).toBeGreaterThanOrEqual(result.atHalfPer1000)
    expect(result.optimumPer1000).toBeGreaterThanOrEqual(result.targetAllPer1000)
  })

  it('scales per-1,000 profit to the requested base size', () => {
    const result = optimizeThreshold(scores, { ...economics, baseSize: 50_000 }, 0.18)
    expect(result.profitAtOptimum).toBeCloseTo(result.optimumPer1000 * 50, 5)
  })

  it('is deterministic for the same inputs', () => {
    const first = optimizeThreshold(scores, { ...economics, baseSize: 10_000 }, 0.18)
    const second = optimizeThreshold(scores, { ...economics, baseSize: 10_000 }, 0.18)
    expect(second.optimum).toBe(first.optimum)
    expect(second.curve).toEqual(first.curve)
  })
})

describe('nearestExample', () => {
  const examples = [
    { features: { tenure: 2, MonthlyCharges: 90, TotalCharges: 180, Contract: 'Month-to-month' } },
    { features: { tenure: 60, MonthlyCharges: 25, TotalCharges: 1500, Contract: 'Two year' } },
  ]

  it('returns the closest row by the documented L1 distance', () => {
    const match = nearestExample(
      { tenure: 3, MonthlyCharges: 88, TotalCharges: 200, Contract: 'Month-to-month' },
      examples,
    )
    expect(match).toBe(examples[0])
  })

  it('returns undefined for an empty sample', () => {
    expect(nearestExample({ tenure: 3 }, [])).toBeUndefined()
  })
})
