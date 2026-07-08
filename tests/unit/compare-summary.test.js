import { describe, expect, test } from 'vitest'
import { compareSummary } from '../../src/components/complex/breakdown/compareMath'

const rows = [
  { start_date: '2023-01-01', end_date: '2023-03-01', type: 'bull', a_ret: 9,  b_ret: 40, diff: -31 },
  { start_date: '2023-03-01', end_date: '2023-06-01', type: 'bear', a_ret: -5, b_ret: -6, diff: 1 },
  { start_date: '2023-06-01', end_date: '2023-09-01', type: 'bull', a_ret: null, b_ret: 20, diff: null },
]

describe('compareSummary — verdict fields', () => {
  test('winner is the higher-average side, with the average lead', () => {
    const s = compareSummary(rows)
    // scored rows: #0 and #1. avgA = (9 + -5)/2 = 2 ; avgB = (40 + -6)/2 = 17
    expect(s.avgA).toBeCloseTo(2, 5)
    expect(s.avgB).toBeCloseTo(17, 5)
    expect(s.winner).toBe('b')
    expect(s.winnerLead).toBeCloseTo(15, 5) // |avgDiff| = |2 - 17|
    expect(s.aWins).toBe(1) // only row #1 has diff > 0
    expect(s.compared).toBe(2)
  })

  test('best (biggest gap) and closest rows come from scored rows only', () => {
    const s = compareSummary(rows)
    expect(s.bestRow.start_date).toBe('2023-01-01')   // |−31| is the biggest gap
    expect(s.closestRow.start_date).toBe('2023-03-01') // |1| is the closest
  })

  test('no scored rows → null verdict, no throw', () => {
    const s = compareSummary([{ start_date: 'x', end_date: 'y', type: 'bull', a_ret: null, b_ret: null, diff: null }])
    expect(s.winner).toBeNull()
    expect(s.winnerLead).toBeNull()
    expect(s.bestRow).toBeNull()
    expect(s.closestRow).toBeNull()
  })
})
