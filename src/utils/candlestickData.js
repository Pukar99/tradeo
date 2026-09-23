// === candlestickData.js — deterministic swinging candlestick generator ===
// Used by every decorative candlestick motif in the app (auth brand panels,
// home page backdrop, home page mini chart) so they all look like a real
// price walking up and down instead of independent random bars.

// Tiny deterministic PRNG (mulberry32) — fixed jitter, not Math.random(), so
// the pattern never changes between renders/reloads/screen sizes.
function mulberry32(seed) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates `count` candles that trace a connected swinging price path —
 * a slow wave (the big up/down trend) plus a faster wave (smaller swings)
 * plus a little deterministic jitter, so consecutive candles flow into each
 * other like a real chart rather than jumping around independently.
 *
 * Returns `{ x, t, h, green }[]` in the same shape every existing candle
 * renderer already expects (t = body top, h = body height, in SVG y-space
 * where smaller t is higher/further up the chart).
 */
export function generateSwingCandles(
  count,
  { seed = 1, spacing = 40, startX = 20, baseline = 140, amplitude = 55, minBody = 10, maxBody = 30 } = {}
) {
  const rand = mulberry32(seed)
  const candles = []
  let level = baseline

  for (let i = 0; i < count; i++) {
    const slow = Math.sin((i / count) * Math.PI * 2.4) * amplitude
    const fast = Math.sin((i / count) * Math.PI * 9 + seed) * (amplitude * 0.18)
    const jitter = (rand() - 0.5) * amplitude * 0.22
    const nextLevel = baseline + slow + fast + jitter
    const green = nextLevel >= level

    const h = minBody + rand() * (maxBody - minBody)
    const t = baseline * 2 - nextLevel - h / 2 // flip so higher price sits higher on screen

    candles.push({ x: startX + i * spacing, t, h, green })
    level = nextLevel
  }

  return candles
}
