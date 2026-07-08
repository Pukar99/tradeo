import { describe, expect, test } from 'vitest'
import { neighborWindow } from '../../src/components/complex/breakdown/helpers'

// Three chronological cycles — middle one is the common "focused" case.
const C1 = { start_date: '2023-01-01', end_date: '2023-02-01', type: 'bull' }
const C2 = { start_date: '2023-02-01', end_date: '2023-04-01', type: 'bear' }
const C3 = { start_date: '2023-04-01', end_date: '2023-06-01', type: 'bull' }

describe('neighborWindow', () => {
  test('middle cycle: window spans previous cycle start -> next cycle end', () => {
    const w = neighborWindow([C1, C2, C3], C2)
    expect(w.from).toBe(C1.start_date)
    expect(w.to).toBe(C3.end_date)
  })

  test('first cycle (no previous): from falls back to focused.start_date', () => {
    const w = neighborWindow([C1, C2, C3], C1)
    expect(w.from).toBe(C1.start_date)
    expect(w.to).toBe(C2.end_date)
  })

  test('last cycle (no next): to falls back to focused.end_date', () => {
    const w = neighborWindow([C1, C2, C3], C3)
    expect(w.from).toBe(C2.start_date)
    expect(w.to).toBe(C3.end_date)
  })

  test('single cycle (no neighbors either side): falls back to its own bounds', () => {
    const w = neighborWindow([C2], C2)
    expect(w.from).toBe(C2.start_date)
    expect(w.to).toBe(C2.end_date)
  })

  test('unsorted input cycles array still resolves neighbors correctly', () => {
    const w = neighborWindow([C3, C1, C2], C2)
    expect(w.from).toBe(C1.start_date)
    expect(w.to).toBe(C3.end_date)
  })

  test('focused not in cycles: falls back to focused own bounds (no crash)', () => {
    const orphan = { start_date: '2022-06-01', end_date: '2022-08-01', type: 'bull' }
    const w = neighborWindow([C1, C3], orphan)
    expect(w.from).toBe(orphan.start_date)
    expect(w.to).toBe(orphan.end_date)
  })
})
