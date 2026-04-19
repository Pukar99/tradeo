/**
 * Frontend Unit Tests — Chart / Screen helpers
 *
 * Tests pure data-transform functions used by StockChart.jsx and ScreenPage:
 * OHLCV normalization, indicator calculations (MA, EMA, RSI, MACD),
 * date range helpers, chart data formatting.
 *
 * Run: npm test  (or: npx vitest run tests/unit/chart.test.js)
 */

import { describe, test, expect } from 'vitest'

// ── Indicator helpers (inline mirrors of StockChart.jsx computations) ─────────

function calcSMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    const slice = closes.slice(i - period + 1, i + 1)
    return slice.reduce((s, v) => s + v, 0) / period
  })
}

function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  const result = new Array(closes.length).fill(null)
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue
    if (i === period - 1) {
      result[i] = closes.slice(0, period).reduce((s, v) => s + v, 0) / period
    } else {
      result[i] = closes[i] * k + result[i - 1] * (1 - k)
    }
  }
  return result
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return closes.map(() => null)
  const result = new Array(closes.length).fill(null)
  const changes = closes.slice(1).map((v, i) => v - closes[i])

  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else                avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period

  const rs     = avgLoss === 0 ? 100 : avgGain / avgLoss
  result[period] = 100 - 100 / (1 + rs)

  for (let i = period + 1; i < closes.length; i++) {
    const g = changes[i - 1] > 0 ? changes[i - 1] : 0
    const l = changes[i - 1] < 0 ? Math.abs(changes[i - 1]) : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss
    result[i] = 100 - 100 / (1 + rs2)
  }
  return result
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast)
  const emaSlow = calcEMA(closes, slow)
  const macdLine = emaFast.map((v, i) =>
    v !== null && emaSlow[i] !== null ? v - emaSlow[i] : null
  )
  // Signal = EMA of MACD
  const macdValues = macdLine.filter(v => v !== null)
  const signalEma  = calcEMA(macdValues, signal)
  // Align back to full length
  const offset = macdLine.findIndex(v => v !== null)
  const fullSignal = new Array(closes.length).fill(null)
  signalEma.forEach((v, i) => { fullSignal[offset + i] = v })
  return { macdLine, signalLine: fullSignal }
}

// OHLCV normalization — ensures all numeric fields are parsed
function normalizeCandles(raw) {
  return raw.map(r => ({
    date:       r.date,
    open:       parseFloat(r.open)       || 0,
    high:       parseFloat(r.high)       || 0,
    low:        parseFloat(r.low)        || 0,
    close:      parseFloat(r.close)      || 0,
    volume:     parseFloat(r.volume)     || 0,
    turnover:   parseFloat(r.turnover)   || 0,
    diff_pct:   parseFloat(r.diff_pct)   || 0,
  }))
}

// Date range helper
function getDateRange(period) {
  const to   = new Date()
  const from = new Date(to)
  switch (period) {
    case '1M':  from.setMonth(from.getMonth() - 1);    break
    case '3M':  from.setMonth(from.getMonth() - 3);    break
    case '6M':  from.setMonth(from.getMonth() - 6);    break
    case '1Y':  from.setFullYear(from.getFullYear()-1); break
    case '3Y':  from.setFullYear(from.getFullYear()-3); break
    case 'ALL': from.setFullYear(2000);                  break
    default:    from.setMonth(from.getMonth() - 6)
  }
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}

// Check if a candle is bullish
function isBullishCandle(candle) {
  return candle.close > candle.open
}

// Detect volume spike (> 2x 20-period average)
function isVolumeSpike(candles, index, multiplier = 2, period = 20) {
  if (index < period) return false
  const avg = candles.slice(index - period, index)
    .reduce((s, c) => s + c.volume, 0) / period
  return candles[index].volume > avg * multiplier
}

// ── Sample data ───────────────────────────────────────────────────────────────
const CLOSES_20 = [
  500, 505, 510, 508, 512, 515, 513, 518, 522, 520,
  525, 530, 528, 532, 535, 533, 538, 542, 540, 545,
]

const CLOSES_FLAT = Array(20).fill(500)
const CLOSES_DOWN = Array.from({ length: 20 }, (_, i) => 500 - i * 5)

// ── SMA ───────────────────────────────────────────────────────────────────────
describe('calcSMA', () => {
  test('first (period-1) values are null', () => {
    const sma = calcSMA(CLOSES_20, 5)
    for (let i = 0; i < 4; i++) expect(sma[i]).toBeNull()
  })

  test('SMA-5 at index 4 = average of first 5 closes', () => {
    const sma = calcSMA(CLOSES_20, 5)
    const expected = (500 + 505 + 510 + 508 + 512) / 5
    expect(sma[4]).toBeCloseTo(expected, 5)
  })

  test('SMA-1 = closes', () => {
    expect(calcSMA(CLOSES_20, 1)).toEqual(CLOSES_20)
  })

  test('SMA-20 of flat data = constant', () => {
    const sma = calcSMA(CLOSES_FLAT, 20)
    expect(sma[19]).toBe(500)
  })

  test('SMA rises in uptrend', () => {
    const sma = calcSMA(CLOSES_20, 5).filter(v => v !== null)
    expect(sma[sma.length - 1]).toBeGreaterThan(sma[0])
  })
})

// ── EMA ───────────────────────────────────────────────────────────────────────
describe('calcEMA', () => {
  test('first (period-1) values are null', () => {
    const ema = calcEMA(CLOSES_20, 5)
    for (let i = 0; i < 4; i++) expect(ema[i]).toBeNull()
  })

  test('EMA at period-1 equals SMA of first period', () => {
    const ema = calcEMA(CLOSES_20, 5)
    const sma = calcSMA(CLOSES_20, 5)
    expect(ema[4]).toBeCloseTo(sma[4], 5)
  })

  test('EMA > SMA in uptrend (EMA reacts faster)', () => {
    const ema = calcEMA(CLOSES_20, 5)
    const sma = calcSMA(CLOSES_20, 5)
    // In an uptrend the EMA should be above the SMA
    expect(ema[19]).toBeGreaterThan(sma[19])
  })

  test('EMA <= SMA in downtrend (EMA reacts faster, lags at boundary)', () => {
    const ema = calcEMA(CLOSES_DOWN, 5)
    const sma = calcSMA(CLOSES_DOWN, 5)
    // In a downtrend EMA reacts faster and sits at or below SMA
    expect(ema[19]).toBeLessThanOrEqual(sma[19] + 0.001)
  })
})

// ── RSI ───────────────────────────────────────────────────────────────────────
describe('calcRSI', () => {
  test('RSI is between 0 and 100', () => {
    const rsi = calcRSI(CLOSES_20, 14)
    rsi.filter(v => v !== null).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })

  test('RSI approaches 100 in strong uptrend', () => {
    const strongUp = Array.from({ length: 20 }, (_, i) => 500 + i * 10)
    const rsi = calcRSI(strongUp, 14)
    const last = rsi[rsi.length - 1]
    expect(last).toBeGreaterThan(70)
  })

  test('RSI approaches 0 in strong downtrend', () => {
    const strongDown = Array.from({ length: 20 }, (_, i) => 500 - i * 10)
    const rsi = calcRSI(strongDown, 14)
    const last = rsi[rsi.length - 1]
    expect(last).toBeLessThan(30)
  })

  test('RSI ≈ 50 in flat market', () => {
    // Alternating up/down
    const zigzag = Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? 510 : 490)
    const rsi = calcRSI(zigzag, 14)
    const last = rsi[rsi.length - 1]
    if (last !== null) expect(Math.abs(last - 50)).toBeLessThan(10)
  })

  test('not enough data → all null', () => {
    const rsi = calcRSI([500, 505], 14)
    expect(rsi.every(v => v === null)).toBe(true)
  })
})

// ── MACD ──────────────────────────────────────────────────────────────────────
describe('calcMACD', () => {
  const CLOSES_40 = Array.from({ length: 40 }, (_, i) => 500 + i * 3)

  test('MACD line has same length as input', () => {
    const { macdLine } = calcMACD(CLOSES_40)
    expect(macdLine).toHaveLength(40)
  })

  test('signal line has same length as input', () => {
    const { signalLine } = calcMACD(CLOSES_40)
    expect(signalLine).toHaveLength(40)
  })

  test('MACD line is null for early values', () => {
    const { macdLine } = calcMACD(CLOSES_40)
    // First 25 (slow period-1) should be null
    for (let i = 0; i < 25; i++) expect(macdLine[i]).toBeNull()
  })

  test('MACD > 0 in uptrend (fast EMA above slow EMA)', () => {
    const { macdLine } = calcMACD(CLOSES_40)
    const last = macdLine[macdLine.length - 1]
    if (last !== null) expect(last).toBeGreaterThan(0)
  })
})

// ── OHLCV normalization ───────────────────────────────────────────────────────
describe('normalizeCandles', () => {
  test('parses string numbers to floats', () => {
    const raw = [{ date: '2025-01-01', open: '500.5', high: '510.2', low: '495.0', close: '505.1', volume: '5000', turnover: '2525500', diff_pct: '1.02' }]
    const norm = normalizeCandles(raw)
    expect(typeof norm[0].open).toBe('number')
    expect(norm[0].open).toBe(500.5)
    expect(norm[0].diff_pct).toBe(1.02)
  })

  test('null/undefined values → 0', () => {
    const raw = [{ date: '2025-01-01', open: null, high: undefined, low: '', close: NaN, volume: null, turnover: null, diff_pct: null }]
    const norm = normalizeCandles(raw)
    expect(norm[0].open).toBe(0)
    expect(norm[0].high).toBe(0)
    expect(norm[0].close).toBe(0)
  })

  test('date string preserved', () => {
    const raw = [{ date: '2025-03-15', open: 500, high: 510, low: 490, close: 505, volume: 5000, turnover: 2525000, diff_pct: 1 }]
    expect(normalizeCandles(raw)[0].date).toBe('2025-03-15')
  })
})

// ── Date range helper ─────────────────────────────────────────────────────────
describe('getDateRange', () => {
  test('returns from and to date strings', () => {
    const { from, to } = getDateRange('1M')
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('from < to', () => {
    const { from, to } = getDateRange('3M')
    expect(from < to).toBe(true)
  })

  test('1Y: from is ~365 days ago', () => {
    const { from } = getDateRange('1Y')
    const yearAgo = new Date()
    yearAgo.setFullYear(yearAgo.getFullYear() - 1)
    const diff = Math.abs(new Date(from) - yearAgo)
    expect(diff).toBeLessThan(2 * 24 * 60 * 60 * 1000) // within 2 days
  })

  test('ALL: from is year 2000', () => {
    const { from } = getDateRange('ALL')
    expect(from.startsWith('2000')).toBe(true)
  })

  test('unknown period defaults to 6M', () => {
    const { from: f1 } = getDateRange('UNKNOWN')
    const { from: f2 } = getDateRange('6M')
    // Should be the same month
    expect(f1.slice(0, 7)).toBe(f2.slice(0, 7))
  })
})

// ── Candle helpers ────────────────────────────────────────────────────────────
describe('isBullishCandle', () => {
  test('true when close > open',  () => expect(isBullishCandle({ open: 100, close: 110 })).toBe(true))
  test('false when close < open', () => expect(isBullishCandle({ open: 110, close: 100 })).toBe(false))
  test('false when equal (doji)', () => expect(isBullishCandle({ open: 100, close: 100 })).toBe(false))
})

describe('isVolumeSpike', () => {
  const candles = Array.from({ length: 25 }, (_, i) => ({
    volume: i === 24 ? 50000 : 2000, // spike on last candle
  }))

  test('true on volume spike candle', () =>
    expect(isVolumeSpike(candles, 24, 2, 20)).toBe(true))
  test('false on normal volume',     () =>
    expect(isVolumeSpike(candles, 10, 2, 20)).toBe(false))
  test('false when not enough history', () =>
    expect(isVolumeSpike(candles, 5, 2, 20)).toBe(false))
})
