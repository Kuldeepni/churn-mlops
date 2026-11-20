import type { Score } from './types'

export interface OptimizerInputs {
  clv: number
  offerCost: number
  successRate: number
  baseSize: number
  min?: number
  max?: number
  steps?: number
}

export interface ThresholdPoint {
  threshold: number
  per1000: number
  total: number
}

export interface OptimizationResult {
  curve: ThresholdPoint[]
  optimum: number
  optimumPer1000: number
  atHalfPer1000: number
  targetAllPer1000: number
  atDeployedPer1000: number
  profitAtOptimum: number
  profitAtHalf: number
  profitTargetAll: number
  baseSize: number
}

/**
 * Expected profit of targeting every customer whose calibrated probability
 * is at or above `threshold`.
 *
 * A targeted churner is saved with probability `successRate`, so contributes
 * `clv * successRate - offerCost`. A targeted non-churner only costs the offer.
 * This matches `src/churn/models/threshold.py::expected_net_benefit`.
 */
export function expectedProfit(
  scores: Score[],
  threshold: number,
  inputs: Pick<OptimizerInputs, 'clv' | 'offerCost' | 'successRate'>,
): number {
  const valueIfChurner = inputs.clv * inputs.successRate - inputs.offerCost
  let total = 0
  for (const score of scores) {
    if (score.p >= threshold) total += score.y === 1 ? valueIfChurner : -inputs.offerCost
  }
  return total
}

export function optimizeThreshold(
  scores: Score[],
  inputs: OptimizerInputs,
  deployedThreshold = 0.18,
): OptimizationResult {
  const min = inputs.min ?? 0.01
  const max = inputs.max ?? 0.99
  const steps = inputs.steps ?? 99
  const n = Math.max(scores.length, 1)
  const scale = 1000 / n

  const curve: ThresholdPoint[] = []
  let optimum = min
  let optimumTotal = -Infinity

  for (let i = 0; i < steps; i++) {
    const threshold = steps === 1 ? min : min + (i * (max - min)) / (steps - 1)
    const total = expectedProfit(scores, threshold, inputs)
    curve.push({ threshold, per1000: total * scale, total })
    if (total > optimumTotal) {
      optimumTotal = total
      optimum = threshold
    }
  }

  const nearest = (target: number) =>
    curve.reduce((best, point) =>
      Math.abs(point.threshold - target) < Math.abs(best.threshold - target) ? point : best,
    )

  const atHalf = nearest(0.5)
  const atDeployed = nearest(deployedThreshold)
  const targetAllTotal = expectedProfit(scores, 0, inputs)
  const baseScale = inputs.baseSize / 1000

  return {
    curve,
    optimum,
    optimumPer1000: optimumTotal * scale,
    atHalfPer1000: atHalf.per1000,
    targetAllPer1000: targetAllTotal * scale,
    atDeployedPer1000: atDeployed.per1000,
    profitAtOptimum: optimumTotal * scale * baseScale,
    profitAtHalf: atHalf.per1000 * baseScale,
    profitTargetAll: targetAllTotal * scale * baseScale,
    baseSize: inputs.baseSize,
  }
}

/** Nearest real customer in the exported test sample, by a documented L1 metric. */
export function nearestExample<T extends { features: object }>(features: object, examples: T[]): T | undefined {
  if (examples.length === 0) return undefined
  const input = features as Record<string, unknown>
  let best = examples[0]
  let bestDistance = Infinity

  for (const example of examples) {
    const other = example.features as Record<string, unknown>
    let distance = 0
    distance += Math.abs(Number(other.tenure ?? 0) - Number(input.tenure ?? 0)) / 72
    distance += Math.abs(Number(other.MonthlyCharges ?? 0) - Number(input.MonthlyCharges ?? 0)) / 120
    distance += Math.abs(Number(other.TotalCharges ?? 0) - Number(input.TotalCharges ?? 0)) / 8000
    for (const key of ['Contract', 'InternetService', 'PaymentMethod', 'PaperlessBilling']) {
      distance += other[key] === input[key] ? 0 : 1
    }
    if (distance < bestDistance) {
      bestDistance = distance
      best = example
    }
  }
  return best
}
