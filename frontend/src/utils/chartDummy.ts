/* SQZ Terminal — chart dummy data helpers.
   seeded PRNG + OHLC/sparkline 생성기. 실 API 연동 전 placeholder로 사용. */

export interface Candle {
  o: number
  h: number
  l: number
  c: number
}

// Mulberry32 seeded PRNG — same seed yields same sequence.
export function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function genCandles(n: number, seed = 1, base = 100, vol = 0.02): Candle[] {
  const r = mulberry32(seed)
  const out: Candle[] = []
  let c = base
  for (let i = 0; i < n; i++) {
    const o = c
    const drift = (r() - 0.45) * vol * c
    c = o + drift
    const h = Math.max(o, c) + r() * vol * c * 0.6
    const l = Math.min(o, c) - r() * vol * c * 0.6
    out.push({ o, h, l, c })
  }
  return out
}

export function genSpark(n: number, seed = 1, trend = 0.002): number[] {
  const r = mulberry32(seed)
  const out: number[] = []
  let v = 50
  for (let i = 0; i < n; i++) {
    v += (r() - 0.5) * 3 + trend * 5
    out.push(v)
  }
  return out
}
