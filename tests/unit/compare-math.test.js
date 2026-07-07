import { describe, expect, test } from 'vitest'
import { buildLadder, compareSummary, sideLabel } from '../../src/components/complex/breakdown/compareMath'

const rows = [
  { start_date: '2023-01-01', end_date: '2023-03-01', type: 'bull', a_ret: 50, b_ret: 10, diff: 40 },
  { start_date: '2023-03-01', end_date: '2023-06-01', type: 'bear', a_ret: -20, b_ret: -10, diff: -10 },
  { start_date: '2023-06-01', end_date: '2023-09-01', type: 'bull', a_ret: null, b_ret: 20, diff: null },
]

describe('compareSummary', () => {
  test('wins/avgs skip null rows', () => {
    const s = compareSummary(rows)
    expect(s.aWins).toBe(1)
    expect(s.compared).toBe(2)
    expect(s.avgA).toBeCloseTo(15, 5) // (50 + -20) / 2
    expect(s.avgB).toBeCloseTo(0, 5) // (10 + -10) / 2
    expect(s.avgDiff).toBeCloseTo(15, 5)
  })
})

describe('buildLadder', () => {
  test('compounds Rs.100 from the anchor forward; null ret rides flat', () => {
    const { ladder, final } = buildLadder(rows, 100, null)
    expect(ladder).toHaveLength(3)
    expect(ladder[0].aBal).toBeCloseTo(150) // 100 × 1.5
    expect(ladder[1].aBal).toBeCloseTo(120) // × 0.8
    expect(ladder[2].aBal).toBeCloseTo(120) // null → flat
    expect(ladder[2].bBal).toBeCloseTo(100 * 1.1 * 0.9 * 1.2)
    expect(final.aPct).toBeCloseTo(20)
  })

  test('anchor skips earlier cycles', () => {
    const { ladder } = buildLadder(rows, 100, '2023-03-01|2023-06-01')
    expect(ladder).toHaveLength(2)
    expect(ladder[0].aBal).toBeCloseTo(80)
  })

  test('zero amount → no NaN', () => {
    const { final } = buildLadder(rows, 0, null)
    expect(final).toBeNull()
  })
})

describe('sideLabel', () => {
  test('symbol and index sides', () => {
    expect(sideLabel({ symbol: 'NABIL' })).toBe('NABIL')
    expect(sideLabel({ index_id: 12 })).toBe('NEPSE')
    expect(sideLabel(null)).toBe('—')
  })
})
