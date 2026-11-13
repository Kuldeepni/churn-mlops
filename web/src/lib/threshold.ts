export interface Score { p: number; y: number }
export function expectedNetBenefit(scores: Score[], threshold: number, clv: number, cost: number, success: number): number {
  const evChurner = success * clv - cost
  const evNonChurner = -cost
  let total = 0
  for (const s of scores) {
    if (s.p >= threshold) total += s.y === 1 ? evChurner : evNonChurner
  }
  return total
}
export function optimizeThreshold(scores: Score[], clv: number, cost: number, success: number) {
  let bestThreshold = 0.01
  let bestBenefit = -Infinity
  const curve: { threshold: number; per1000: number }[] = []
  const scale = 1000 / scores.length
  for (let i = 0; i <= 98; i++) {
    const t = 0.01 + i * 0.01
    const benefit = expectedNetBenefit(scores, t, clv, cost, success)
    const per1000 = benefit * scale
    curve.push({ threshold: t, per1000 })
    if (benefit >= bestBenefit) { bestBenefit = benefit; bestThreshold = t }
  }
  const atHalf = expectedNetBenefit(scores, 0.5, clv, cost, success) * scale
  const targetAll = expectedNetBenefit(scores, 0, clv, cost, success) * scale
  return { threshold: bestThreshold, netBenefitPer1000: bestBenefit * scale, atHalf, targetAll, curve }
}