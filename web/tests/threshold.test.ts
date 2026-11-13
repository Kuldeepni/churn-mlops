import { describe, it, expect } from 'vitest'
import { optimizeThreshold } from '../src/lib/threshold'
describe('optimizeThreshold', () => {
  it('returns a threshold in range', () => {
    const scores = [{p:0.9,y:1},{p:0.1,y:0},{p:0.8,y:1},{p:0.2,y:0}]
    const r = optimizeThreshold(scores, 1000, 50, 0.3)
    expect(r.threshold).toBeGreaterThanOrEqual(0.01)
    expect(r.threshold).toBeLessThanOrEqual(0.99)
    expect(r.curve.length).toBe(99)
  })
})