import { describe, expect, test } from 'vitest'
import { classify, growth, LENSES, avgOf } from '../../src/components/complex/breakdown/insightsMath'

const st = (per_wave) => {
  const r = per_wave.filter((x) => x != null)
  return { per_wave, n_covered: r.length, up_count: r.filter((x) => x > 0).length, avg_ret: avgOf(r), floor: Math.min(...r) }
}

describe('classify', () => {
  test('lead: rose in ≥75% of runs and beat the index average', () => {
    expect(classify(st([40, 50, 30, 45]), 30)).toBe('lead')
  })
  test('steady: rose often but at/below the index average', () => {
    expect(classify(st([10, 12, 8, 15]), 30)).toBe('steady')
  })
  test('spike: one run carries the average', () => {
    expect(classify(st([220, 10, 5, 12]), 30)).toBe('spike')
  })
  test('lag: rose in fewer than 75% of runs', () => {
    expect(classify(st([-10, 5, -20, 3]), 30)).toBe('lag')
  })
  test('missing runs are ignored, single run never a spike', () => {
    expect(classify(st([null, 300, null]), 30)).toBe('lead')
  })
})

describe('growth', () => {
  test('compounds ₹100 and skips null runs', () => {
    const p = growth([10, null, -50])
    expect(p[0]).toBe(100)
    expect(p[1]).toBeCloseTo(110)
    expect(p[2]).toBeCloseTo(110)
    expect(p[3]).toBeCloseTo(55)
  })
})

describe('LENSES', () => {
  const rows = [
    { symbol: 'A', avg_ret: 50, up_count: 2, n_covered: 4, floor: -10 },
    { symbol: 'B', avg_ret: 20, up_count: 4, n_covered: 4, floor: 5 },
    { symbol: 'C', avg_ret: -5, up_count: 1, n_covered: 4, floor: -30 },
  ]
  const order = (id) => [...rows].sort(LENSES.find((l) => l.id === id).sort).map((r) => r.symbol).join('')
  test('each lens is just a sort order of the same list', () => {
    expect(order('gainers')).toBe('ABC')
    expect(order('reliable')).toBe('BAC')
    expect(order('floor')).toBe('BAC')
    expect(order('losers')).toBe('CBA')
  })
})
