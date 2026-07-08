import { describe, expect, test } from 'vitest'
import { corrBlocks, barPct } from '../../src/components/complex/breakdown/CycleAnalyticsCards'

describe('corrBlocks', () => {
  test('maps correlation bands to 0..5 filled blocks', () => {
    expect(corrBlocks(0.85)).toBe(5) // high
    expect(corrBlocks(0.7)).toBe(5)  // high boundary
    expect(corrBlocks(0.5)).toBe(4)  // medium
    expect(corrBlocks(0.4)).toBe(4)  // medium boundary
    expect(corrBlocks(0.1)).toBe(2)  // low
    expect(corrBlocks(-0.5)).toBe(1) // opposite
    expect(corrBlocks(null)).toBe(0) // insufficient overlap
  })
})

describe('barPct', () => {
  test('scales value against max, floors at 0, clamps at 100', () => {
    expect(barPct(50, 100)).toBe(50)
    expect(barPct(-30, 100)).toBe(30) // magnitude
    expect(barPct(10, 0)).toBe(0)     // max 0 → no divide-by-zero
    expect(barPct(200, 100)).toBe(100)
  })
})
