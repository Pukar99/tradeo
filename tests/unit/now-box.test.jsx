import { describe, expect, test } from 'vitest'
import { computeNow } from '../../src/components/complex/breakdown/NowBox'

const cycles = [
  { type: 'bull', start_date: '2023-01-01', end_date: '2023-03-01', end_close: 2000, pct: 40, duration_days: 40 },
  { type: 'bear', start_date: '2023-03-01', end_date: '2023-06-01', end_close: 1500, pct: -25, duration_days: 60 },
  { type: 'bull', start_date: '2023-06-01', end_date: '2023-09-01', end_close: 2100, pct: 40, duration_days: 60 },
]
const candles = [
  { date: '2023-09-01', close: 2100 },
  { date: '2023-09-02', close: 2150 },
  { date: '2023-09-03', close: 2205 },
]

describe('computeNow', () => {
  test('age, return and direction since the last pivot', () => {
    const now = computeNow(cycles, candles)
    expect(now.sinceDate).toBe('2023-09-01')
    expect(now.tradingDays).toBe(2) // candles strictly after the pivot
    expect(now.retPct).toBeCloseTo(5.0, 1) // 2100 → 2205
    expect(now.direction).toBe('up')
    expect(now.med.bullPct).toBe(40)
    expect(now.med.bullDays).toBe(50) // median of 40, 60
    expect(now.med.bearPct).toBe(-25)
  })

  test('null when no cycles or no candles', () => {
    expect(computeNow([], candles)).toBeNull()
    expect(computeNow(cycles, [])).toBeNull()
  })
})
