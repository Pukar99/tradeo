/**
 * Frontend Unit Tests — Portfolio helpers
 *
 * Tests pure utility functions used in PortfolioPage:
 * portfolio metrics, unrealized P&L, position sizing, allocation.
 *
 * Run: npm test  (or: npx vitest run tests/unit/portfolio.test.js)
 */

import { describe, test, expect } from 'vitest'

// ── Portfolio helpers (inline mirrors of what PortfolioPage computes) ─────────

function calcUnrealizedPnl(currentPrice, avgPrice, quantity) {
  return (currentPrice - avgPrice) * quantity
}

function calcUnrealizedPct(currentPrice, avgPrice) {
  if (!avgPrice) return 0
  return ((currentPrice - avgPrice) / avgPrice) * 100
}

function calcMarketValue(currentPrice, quantity) {
  return currentPrice * quantity
}

function calcCostBasis(avgPrice, quantity) {
  return avgPrice * quantity
}

function calcPortfolioAllocation(holdings) {
  const totalValue = holdings.reduce((s, h) => s + h.market_value, 0)
  if (!totalValue) return holdings.map(h => ({ ...h, allocation_pct: 0 }))
  return holdings.map(h => ({
    ...h,
    allocation_pct: (h.market_value / totalValue) * 100,
  }))
}

function calcTotalPnl(holdings) {
  return holdings.reduce((s, h) => s + h.unrealized_pnl, 0)
}

function calcTotalCost(holdings) {
  return holdings.reduce((s, h) => s + h.cost_basis, 0)
}

function calcTotalMarketValue(holdings) {
  return holdings.reduce((s, h) => s + h.market_value, 0)
}

function calcPortfolioReturn(totalPnl, totalCost) {
  if (!totalCost) return 0
  return (totalPnl / totalCost) * 100
}

// Weighted average after adding more units
function calcNewAvgPrice(existingQty, existingAvg, newQty, newAvg) {
  if (existingQty + newQty === 0) return 0
  return ((existingAvg * existingQty) + (newAvg * newQty)) / (existingQty + newQty)
}

// ── Unrealized P&L ────────────────────────────────────────────────────────────
describe('calcUnrealizedPnl', () => {
  test('profit: price above avg', ()   => expect(calcUnrealizedPnl(600, 500, 100)).toBe(10000))
  test('loss: price below avg',   ()   => expect(calcUnrealizedPnl(400, 500, 100)).toBe(-10000))
  test('breakeven',               ()   => expect(calcUnrealizedPnl(500, 500, 100)).toBe(0))
  test('single unit',             ()   => expect(calcUnrealizedPnl(550, 500, 1)).toBe(50))
  test('fractional gain',         ()   => expect(calcUnrealizedPnl(500.5, 500, 100)).toBeCloseTo(50, 2))
})

describe('calcUnrealizedPct', () => {
  test('20% gain',        () => expect(calcUnrealizedPct(600, 500)).toBeCloseTo(20, 2))
  test('20% loss',        () => expect(calcUnrealizedPct(400, 500)).toBeCloseTo(-20, 2))
  test('breakeven = 0%',  () => expect(calcUnrealizedPct(500, 500)).toBe(0))
  test('zero avgPrice → 0', () => expect(calcUnrealizedPct(500, 0)).toBe(0))
})

describe('calcMarketValue', () => {
  test('100 units at 500 = 50000', () => expect(calcMarketValue(500, 100)).toBe(50000))
  test('zero units = 0',          () => expect(calcMarketValue(500, 0)).toBe(0))
  test('zero price = 0',          () => expect(calcMarketValue(0, 100)).toBe(0))
})

describe('calcCostBasis', () => {
  test('100 units at 500 = 50000', () => expect(calcCostBasis(500, 100)).toBe(50000))
  test('zero quantity = 0',        () => expect(calcCostBasis(500, 0)).toBe(0))
})

// ── Portfolio allocation ───────────────────────────────────────────────────────
describe('calcPortfolioAllocation', () => {
  const holdings = [
    { symbol: 'NABIL', market_value: 50000, unrealized_pnl: 5000 },
    { symbol: 'NICA',  market_value: 30000, unrealized_pnl: -2000 },
    { symbol: 'GBIME', market_value: 20000, unrealized_pnl: 1000 },
  ]

  test('allocations sum to 100%', () => {
    const result = calcPortfolioAllocation(holdings)
    const total  = result.reduce((s, h) => s + h.allocation_pct, 0)
    expect(total).toBeCloseTo(100, 5)
  })

  test('largest holding has highest allocation', () => {
    const result = calcPortfolioAllocation(holdings)
    const nabils = result.find(h => h.symbol === 'NABIL')
    expect(nabils.allocation_pct).toBeCloseTo(50, 1)
  })

  test('empty portfolio → all zeros', () => {
    const result = calcPortfolioAllocation([
      { symbol: 'NABIL', market_value: 0, unrealized_pnl: 0 },
    ])
    expect(result[0].allocation_pct).toBe(0)
  })

  test('single holding = 100%', () => {
    const result = calcPortfolioAllocation([{ symbol: 'NABIL', market_value: 50000, unrealized_pnl: 0 }])
    expect(result[0].allocation_pct).toBeCloseTo(100, 5)
  })
})

// ── Portfolio totals ──────────────────────────────────────────────────────────
describe('calcTotalPnl', () => {
  test('sums unrealized P&L across holdings', () => {
    const holdings = [
      { unrealized_pnl: 5000 },
      { unrealized_pnl: -2000 },
      { unrealized_pnl: 1000 },
    ]
    expect(calcTotalPnl(holdings)).toBe(4000)
  })
  test('all losses', ()   => expect(calcTotalPnl([{ unrealized_pnl: -100 }, { unrealized_pnl: -200 }])).toBe(-300))
  test('empty array = 0', () => expect(calcTotalPnl([])).toBe(0))
})

describe('calcPortfolioReturn', () => {
  test('positive return', ()  => expect(calcPortfolioReturn(10000, 100000)).toBeCloseTo(10, 2))
  test('negative return', ()  => expect(calcPortfolioReturn(-5000, 100000)).toBeCloseTo(-5, 2))
  test('zero cost → 0',  ()  => expect(calcPortfolioReturn(1000, 0)).toBe(0))
  test('breakeven = 0%', ()  => expect(calcPortfolioReturn(0, 100000)).toBe(0))
})

// ── Weighted avg price (adding to position) ────────────────────────────────────
describe('calcNewAvgPrice (add to position)', () => {
  test('equal qty at higher price', () => {
    // 100@500 + 100@600 = 550
    expect(calcNewAvgPrice(100, 500, 100, 600)).toBe(550)
  })
  test('small add at much higher price', () => {
    // 900@100 + 100@200 = 110
    expect(calcNewAvgPrice(900, 100, 100, 200)).toBe(110)
  })
  test('same price → unchanged', () => {
    expect(calcNewAvgPrice(100, 500, 50, 500)).toBe(500)
  })
  test('buying 1 unit at much higher price', () => {
    // 100@500 + 1@1000 → (50000+1000)/101 ≈ 504.95
    expect(calcNewAvgPrice(100, 500, 1, 1000)).toBeCloseTo(504.95, 1)
  })
  test('zero existing qty → new price', () => {
    expect(calcNewAvgPrice(0, 0, 100, 500)).toBe(500)
  })
  test('both zero → 0', () => {
    expect(calcNewAvgPrice(0, 0, 0, 0)).toBe(0)
  })
})
