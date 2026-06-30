import { describe, test, expect } from 'vitest'
import { buildPriceLines, MARKER_COLORS } from '../../src/components/chat/chartMarkers'

describe('card protocol Scenario 2 — buildPriceLines', () => {
  test('maps entry/sl/tp markers to price-line option objects', () => {
    const markers = [
      { type: 'entry', price: 752.4, label: 'Entry 752.40' },
      { type: 'sl', price: 700, label: 'SL 700.00' },
      { type: 'tp', price: 820, label: 'TP 820.00' },
    ]
    const lines = buildPriceLines(markers)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ price: 752.4, color: MARKER_COLORS.entry, title: 'Entry 752.40' })
    expect(lines[1]).toMatchObject({ price: 700, color: MARKER_COLORS.sl, title: 'SL 700.00' })
    expect(lines[2]).toMatchObject({ price: 820, color: MARKER_COLORS.tp, title: 'TP 820.00' })
    // every line is dashed + shows its axis label
    for (const line of lines) {
      expect(line.lineStyle).toBe(2) // LineStyle.Dashed
      expect(line.axisLabelVisible).toBe(true)
      expect(line.lineWidth).toBe(1)
    }
  })

  test('empty markers → empty array (no lines, Scenario 1 unaffected)', () => {
    expect(buildPriceLines([])).toEqual([])
    expect(buildPriceLines(undefined)).toEqual([])
  })

  test('unknown marker type falls back to a neutral gray color (never crashes)', () => {
    const lines = buildPriceLines([{ type: 'mystery', price: 100, label: 'Mystery 100' }])
    expect(lines).toHaveLength(1)
    expect(lines[0].color).toBe(MARKER_COLORS.default)
  })
})
