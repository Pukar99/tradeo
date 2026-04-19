/**
 * Frontend Unit Tests — P&L helpers and formatting utils
 *
 * Tests pure utility functions used in the Trader and Dashboard pages.
 * No DOM, no React — plain JS logic only.
 *
 * Run: npm test  (or: npx vitest run tests/unit/pnl.test.js)
 */

import { describe, test, expect } from 'vitest'

// ── Inline helpers (mirrors what the components compute) ──────────────────────
// If these are extracted to a utils file, import from there instead.

function calcPnl(position, entryPrice, exitPrice, quantity) {
  if (position === 'LONG')  return (exitPrice - entryPrice) * quantity
  if (position === 'SHORT') return (entryPrice - exitPrice) * quantity
  return 0
}

function roundPnl(value) {
  return Math.round(value * 100) / 100
}

function calcWinRate(trades) {
  const closed = trades.filter(t => t.status === 'CLOSED')
  if (!closed.length) return 0
  const wins = closed.filter(t => (t.realized_pnl ?? 0) > 0).length
  return Math.round((wins / closed.length) * 100)
}

function calcAvgRR(trades) {
  const valid = trades.filter(t =>
    t.status === 'CLOSED' &&
    t.entry_price && t.sl && t.exit_price !== undefined
  )
  if (!valid.length) return 0
  const rrs = valid.map(t => {
    const risk   = Math.abs(t.entry_price - t.sl)
    if (risk === 0) return 0
    const reward = Math.abs(t.exit_price - t.entry_price)
    return reward / risk
  })
  return Math.round((rrs.reduce((s, r) => s + r, 0) / rrs.length) * 100) / 100
}

function weightedAvgPrice(existingQty, existingAvg, newQty, newAvg) {
  return ((existingAvg * existingQty) + (newAvg * newQty)) / (existingQty + newQty)
}

function calcRemainingQty(quantity, partialExits) {
  if (!Array.isArray(partialExits)) return quantity
  const exited = partialExits.reduce((s, p) => s + (p.exit_quantity || 0), 0)
  return quantity - exited
}

function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-NP', {
    style:    'decimal',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value) {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

// ── P&L Calculations ───────────────────────────────────────────────────────────

describe('calcPnl', () => {
  test('LONG profit', ()  => expect(calcPnl('LONG',  500, 550, 100)).toBe(5000))
  test('LONG loss',   ()  => expect(calcPnl('LONG',  500, 450, 100)).toBe(-5000))
  test('SHORT profit', () => expect(calcPnl('SHORT', 600, 540, 80)).toBe(4800))
  test('SHORT loss',   () => expect(calcPnl('SHORT', 600, 640, 80)).toBe(-3200))
  test('breakeven',    () => expect(calcPnl('LONG',  500, 500, 100)).toBe(0))
  test('single unit',  () => expect(calcPnl('LONG',  100, 110, 1)).toBe(10))
  test('unknown position returns 0', () => expect(calcPnl('FLAT', 500, 600, 100)).toBe(0))
})

describe('roundPnl', () => {
  test('rounds to 2dp', () => {
    // (100.666 - 100.333) * 3 = 0.999
    const raw = (100.666 - 100.333) * 3
    expect(roundPnl(raw)).toBe(1)
  })
  test('exact value unchanged', () => expect(roundPnl(1500)).toBe(1500))
  test('negative rounded', () => expect(roundPnl(-0.005)).toBe(-0.01))
})

// ── Win Rate ───────────────────────────────────────────────────────────────────

describe('calcWinRate', () => {
  const trades = [
    { status: 'CLOSED', realized_pnl: 1000 },
    { status: 'CLOSED', realized_pnl: -500 },
    { status: 'CLOSED', realized_pnl: 200  },
    { status: 'OPEN',   realized_pnl: 0    },
  ]

  test('2 wins out of 3 closed = 67%', () => expect(calcWinRate(trades)).toBe(67))
  test('all wins = 100%',   () => expect(calcWinRate([
    { status: 'CLOSED', realized_pnl: 100 },
    { status: 'CLOSED', realized_pnl: 200 },
  ])).toBe(100))
  test('all losses = 0%',   () => expect(calcWinRate([
    { status: 'CLOSED', realized_pnl: -100 },
  ])).toBe(0))
  test('no closed trades = 0%', () => expect(calcWinRate([
    { status: 'OPEN', realized_pnl: 0 },
  ])).toBe(0))
  test('empty array = 0%',  () => expect(calcWinRate([])).toBe(0))
  test('breakeven (pnl=0) counts as loss', () => expect(calcWinRate([
    { status: 'CLOSED', realized_pnl: 0 },
  ])).toBe(0))
})

// ── Average RR ─────────────────────────────────────────────────────────────────

describe('calcAvgRR', () => {
  test('1:2 risk reward', () => {
    const trades = [{ status: 'CLOSED', entry_price: 500, sl: 480, exit_price: 540 }]
    // risk=20, reward=40, RR=2
    expect(calcAvgRR(trades)).toBe(2)
  })
  test('average of multiple trades', () => {
    const trades = [
      { status: 'CLOSED', entry_price: 500, sl: 480, exit_price: 540 }, // RR=2
      { status: 'CLOSED', entry_price: 500, sl: 480, exit_price: 560 }, // RR=3
    ]
    expect(calcAvgRR(trades)).toBe(2.5)
  })
  test('zero risk (SL at entry) returns 0 for that trade', () => {
    const trades = [{ status: 'CLOSED', entry_price: 500, sl: 500, exit_price: 550 }]
    expect(calcAvgRR(trades)).toBe(0)
  })
  test('no valid trades returns 0', () => expect(calcAvgRR([])).toBe(0))
  test('OPEN trades excluded', () => {
    const trades = [{ status: 'OPEN', entry_price: 500, sl: 480, exit_price: 540 }]
    expect(calcAvgRR(trades)).toBe(0)
  })
})

// ── Portfolio Weighted Average ─────────────────────────────────────────────────

describe('weightedAvgPrice', () => {
  test('equal quantities', () =>
    expect(weightedAvgPrice(100, 500, 100, 600)).toBe(550))
  test('larger existing position dominates', () =>
    expect(weightedAvgPrice(900, 100, 100, 200)).toBe(110))
  test('same price = unchanged', () =>
    expect(weightedAvgPrice(50, 400, 10, 400)).toBe(400))
  test('one unit added at higher price', () => {
    const avg = weightedAvgPrice(100, 500, 1, 600)
    expect(avg).toBeCloseTo(500.99, 1)
  })
})

// ── Remaining Quantity ─────────────────────────────────────────────────────────

describe('calcRemainingQty', () => {
  test('no partial exits = full quantity', () =>
    expect(calcRemainingQty(200, [])).toBe(200))
  test('one partial exit', () =>
    expect(calcRemainingQty(200, [{ exit_quantity: 50 }])).toBe(150))
  test('two partial exits', () =>
    expect(calcRemainingQty(200, [{ exit_quantity: 50 }, { exit_quantity: 100 }])).toBe(50))
  test('null partial_exits falls back to quantity', () =>
    expect(calcRemainingQty(200, null)).toBe(200))
  test('fully exited = 0', () =>
    expect(calcRemainingQty(100, [{ exit_quantity: 100 }])).toBe(0))
})

// ── Formatting Utilities ───────────────────────────────────────────────────────

describe('formatCurrency', () => {
  test('formats positive number', () => expect(formatCurrency(12000)).toBe('12,000'))
  test('formats negative number', () => expect(formatCurrency(-1000)).toBe('-1,000'))
  test('formats zero',            () => expect(formatCurrency(0)).toBe('0'))
  test('null returns em-dash',    () => expect(formatCurrency(null)).toBe('—'))
  test('undefined returns em-dash', () => expect(formatCurrency(undefined)).toBe('—'))
  test('decimal places',          () => expect(formatCurrency(1234.56)).toBe('1,234.56'))
})

describe('formatPercent', () => {
  test('positive adds + prefix',  () => expect(formatPercent(5)).toBe('+5.00%'))
  test('negative has - prefix',   () => expect(formatPercent(-3.5)).toBe('-3.50%'))
  test('zero is 0.00%',           () => expect(formatPercent(0)).toBe('+0.00%'))
  test('null returns em-dash',    () => expect(formatPercent(null)).toBe('—'))
})
