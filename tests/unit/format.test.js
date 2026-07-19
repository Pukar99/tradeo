import { describe, test, expect, vi } from 'vitest'
import {
  nepseCommission,
  sebonFee,
  dpCharge,
  nepseCharges,
  nepseCGTByTerm,
  nepseCGT,
  today,
  fmtRs,
  fmtRsSigned,
  fmt,
  fmtPct,
  fmtDec,
  fmtCr,
  safeFloat,
  isCanceled,
  apiError,
  safeUrl,
  pnlClass,
} from '../../src/utils/format'

// ── pnlClass (new — the one shared home for the `v >= 0 ? green : red` pattern) ──
describe('pnlClass', () => {
  test('positive and zero → pos class (same coercion as inline `v >= 0`)', () => {
    expect(pnlClass(5, 'g', 'r')).toBe('g')
    expect(pnlClass(0, 'g', 'r')).toBe('g')
    expect(pnlClass('12.5', 'g', 'r')).toBe('g') // Supabase numeric string
  })
  test('negative → neg class', () => {
    expect(pnlClass(-0.01, 'g', 'r')).toBe('r')
    expect(pnlClass('-800', 'g', 'r')).toBe('r')
  })
  test('NaN → neg class (matches inline ternary: NaN >= 0 is false)', () => {
    expect(pnlClass(NaN, 'g', 'r')).toBe('r')
  })
  test('defaults are the emerald/red pair', () => {
    expect(pnlClass(1)).toBe('text-emerald-500')
    expect(pnlClass(-1)).toBe('text-red-400')
  })
})

// ── existing formatters: lock current behavior before Phase 1 adoption ──
describe('NEPSE fee utilities', () => {
  test('commission tiers', () => {
    expect(nepseCommission(0)).toBe(0)
    expect(nepseCommission(2000)).toBe(10) // flat Rs.10 tier
    expect(nepseCommission(10000)).toBeCloseTo(36) // 0.36%
    expect(nepseCommission(100000)).toBeCloseTo(330) // 0.33%
  })
  test('sebonFee + dpCharge + nepseCharges', () => {
    expect(sebonFee(100000)).toBeCloseTo(15)
    expect(dpCharge()).toBe(25)
    expect(nepseCharges(100000)).toBeCloseTo(330 + 15 + 25)
  })
  test('CGT: 7.5% short-term, 5% long-term, 0 on loss', () => {
    expect(nepseCGTByTerm(1000, false)).toBeCloseTo(75)
    expect(nepseCGTByTerm(1000, true)).toBeCloseTo(50)
    expect(nepseCGTByTerm(-500, false)).toBe(0)
    expect(nepseCGT(1000, '2025-01-01', '2025-06-01')).toBeCloseTo(75)
    expect(nepseCGT(1000, '2024-01-01', '2025-06-01')).toBeCloseTo(50)
    expect(nepseCGT(1000, 'not-a-date', '2025-06-01')).toBe(0) // invalid-date guard
  })
})

describe('number formatters', () => {
  test('today() is YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  test('today() rolls over at Nepal midnight, not UTC midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T18:30:00.000Z'))
    expect(today()).toBe('2026-07-19')
    vi.useRealTimers()
  })
  test('fmtRs: absolute, rounded, grouped; forex → $2dp', () => {
    expect(fmtRs(-500)).toBe('Rs.500')
    expect(fmtRs(1234567.6)).toBe('Rs.1,234,568')
    expect(fmtRs(12.5, true)).toBe('$12.50')
  })
  test('fmtRsSigned uses explicit +/− prefix', () => {
    expect(fmtRsSigned(800)).toBe('+Rs.800')
    expect(fmtRsSigned(-800)).toBe('−Rs.800')
  })
  test('fmt/fmtPct/fmtDec/fmtCr return — for non-numbers', () => {
    expect(fmt('abc')).toBe('—')
    expect(fmtPct(undefined)).toBe('—')
    expect(fmtDec(null)).toBe('—')
    expect(fmtCr('x')).toBe('—')
  })
  test('fmtPct signs, fmtDec grouping, fmtCr scale', () => {
    expect(fmtPct(12.3)).toBe('+12.30%')
    expect(fmtPct(-4, 1)).toBe('−4.0%')
    expect(fmtPct(0)).toBe('+0.00%') // NOTE: insight/helpers fmtPct intentionally differs (no sign at 0)
    expect(fmtDec(1234.5, 1)).toBe('1,234.5')
    expect(fmtCr(15000000)).toBe('1.50 Cr')
  })
})

describe('safe parsers', () => {
  test('safeFloat parses Supabase numeric strings, falls back on junk', () => {
    expect(safeFloat('12.50')).toBe(12.5)
    expect(safeFloat(null)).toBe(0)
    expect(safeFloat('x', 7)).toBe(7)
  })
  test('isCanceled detects axios/fetch cancel variants only', () => {
    expect(isCanceled({ name: 'AbortError' })).toBe(true)
    expect(isCanceled({ code: 'ERR_CANCELED' })).toBe(true)
    expect(isCanceled({ message: 'canceled' })).toBe(true)
    expect(isCanceled(new Error('boom'))).toBe(false)
    expect(isCanceled(null)).toBe(false)
  })
  test('apiError: cancellation → empty, internals → fallback, plain message passes', () => {
    expect(apiError({ name: 'AbortError' })).toBe('')
    expect(apiError({ message: 'relation "trades" does not exist' })).toBe(
      'Something went wrong. Please try again.'
    )
    expect(apiError({ response: { data: { error: 'Symbol not found' } } })).toBe('Symbol not found')
  })
  test('safeUrl allows only http(s)', () => {
    expect(safeUrl('https://x.com/a')).toBe('https://x.com/a')
    expect(safeUrl('javascript' + ':alert(1)')).toBe(null)
    expect(safeUrl('not a url')).toBe(null)
  })
})
