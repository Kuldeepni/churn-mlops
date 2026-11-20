export interface Score { p: number; y: number }
export interface OptResult { threshold: number; netBenefitPer1000: number; atHalf: number; targetAll: number }
export function optimizeThreshold(scores: Score[], clv = 1200, cost = 60, success = 0.35) {
  const n = scores.length
  let best = { threshold: 0.5, netBenefitPer1000: -Infinity }
  const curve: { t: number; net: number }[] = []
  for (let i = 1; i <= 99; i++) {
    const t = i / 100
    let net = 0
    for (const s of scores) {
      if (s.p >= t) {
        net += s.y === 1 ? clv * success : -cost
      }
    }
    const per1000 = net * (1000 / n)
    curve.push({ t, net: per1000 })
    if (per1000 > best.netBenefitPer1000) best = { threshold: t, netBenefitPer1000: per1000 }
  }
  const atHalf = curve.find(s => Math.abs(s.t - 0.5) < 0.005)?.net ?? 0
  const targetAll = scores.reduce((a, s) => a + (s.y === 1 ? clv * success : -cost), 0) * (1000 / n)
  return { ...best, atHalf, targetAll, curve }
}