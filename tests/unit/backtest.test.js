/**
 * Frontend Unit Tests — Backtest helpers
 *
 * Tests pure logic used in BacktestPage:
 * broker fees, circuit limits, P&L, Sharpe ratio, settlement date logic,
 * position sizing, capital tracking.
 *
 * Run: npm test  (or: npx vitest run tests/unit/backtest.test.js)
 */

import { describe, test, expect } from 'vitest'

// ── Inline mirrors of nepse utility functions ─────────────────────────────────

function calcBrokerFee(amount) {
  if (amount <= 50000)    return parseFloat((amount * 0.0036).toFixed(2))
  if (amount <= 500000)   return parseFloat((amount * 0.0033).toFixed(2))
  if (amount <= 2000000)  return parseFloat((amount * 0.0031).toFixed(2))
  if (amount <= 10000000) return parseFloat((amount * 0.0027).toFixed(2))
  return parseFloat((amount * 0.0024).toFixed(2))
}

function checkCircuitLimit(entryPrice, currentPrice, position) {
  const changePct = ((currentPrice - entryPrice) / entryPrice) * 100
  if (position === 'LONG'  && changePct >= 10) return { breached: true, type: 'UPPER_CIRCUIT', changePct }
  if (position === 'SHORT' && changePct <= -10) return { breached: true, type: 'LOWER_CIRCUIT', changePct }
  return { breached: false, changePct }
}

function calcSessionPnl(orders) {
  return orders
    .filter(o => o.status === 'CLOSED')
    .reduce((s, o) => s + (o.realized_pnl || 0), 0)
}

function calcSessionWinRate(orders) {
  const closed = orders.filter(o => o.status === 'CLOSED')
  if (!closed.length) return 0
  const wins = closed.filter(o => (o.realized_pnl || 0) > 0).length
  return Math.round((wins / closed.length) * 100)
}

function calcSharpeRatio(returns, riskFreeRate = 0) {
  if (returns.length < 2) return 0
  const excess  = returns.map(r => r - riskFreeRate)
  const mu      = excess.reduce((s, r) => s + r, 0) / excess.length
  const variance = excess.reduce((s, r) => s + (r - mu) ** 2, 0) / (excess.length - 1)
  const sd       = Math.sqrt(variance)
  return sd === 0 ? 0 : mu / sd
}

function calcMaxDrawdown(equityCurve) {
  if (!equityCurve.length) return 0
  let peak = equityCurve[0]
  let maxDD = 0
  for (const val of equityCurve) {
    if (val > peak) peak = val
    const dd = (peak - val) / peak
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

function calcPositionSize(availableCapital, price, quantity) {
  const cost = price * quantity
  const fee  = calcBrokerFee(cost)
  return cost + fee
}

function calcRemainingCapital(availableCapital, orderCost) {
  return availableCapital - orderCost
}

function calcPnlAtExit(position, entryPrice, exitPrice, quantity, entryFee, exitFee) {
  const gross = position === 'LONG'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity
  return gross - entryFee - exitFee
}

// ── Broker fee ────────────────────────────────────────────────────────────────
describe('calcBrokerFee', () => {
  test('≤50k: 0.36%',  () => expect(calcBrokerFee(50000)).toBe(180))
  test('≤500k: 0.33%', () => expect(calcBrokerFee(100000)).toBe(330))
  test('≤2M: 0.31%',   () => expect(calcBrokerFee(1000000)).toBe(3100))
  test('≤10M: 0.27%',  () => expect(calcBrokerFee(5000000)).toBe(13500))
  test('>10M: 0.24%',  () => expect(calcBrokerFee(20000000)).toBe(48000))
  test('fee > 0',       () => expect(calcBrokerFee(1000)).toBeGreaterThan(0))
  test('scales with amount', () =>
    expect(calcBrokerFee(200000)).toBeGreaterThan(calcBrokerFee(50000)))
})

// ── Circuit limit ─────────────────────────────────────────────────────────────
describe('checkCircuitLimit', () => {
  test('LONG upper circuit at +10%', () => {
    const result = checkCircuitLimit(500, 550, 'LONG')
    expect(result.breached).toBe(true)
    expect(result.type).toBe('UPPER_CIRCUIT')
  })
  test('LONG no breach at +9.9%', () => {
    const result = checkCircuitLimit(500, 549.5, 'LONG')
    expect(result.breached).toBe(false)
  })
  test('SHORT lower circuit at -10%', () => {
    const result = checkCircuitLimit(500, 450, 'SHORT')
    expect(result.breached).toBe(true)
    expect(result.type).toBe('LOWER_CIRCUIT')
  })
  test('SHORT no breach at -9.9%', () => {
    const result = checkCircuitLimit(500, 450.5, 'SHORT')
    expect(result.breached).toBe(false)
  })
  test('flat market: no breach', () => {
    const result = checkCircuitLimit(500, 500, 'LONG')
    expect(result.breached).toBe(false)
    expect(result.changePct).toBe(0)
  })
})

// ── Session P&L ───────────────────────────────────────────────────────────────
describe('calcSessionPnl', () => {
  const orders = [
    { status: 'CLOSED', realized_pnl: 5000 },
    { status: 'CLOSED', realized_pnl: -2000 },
    { status: 'OPEN',   realized_pnl: 0 },
  ]
  test('sums closed order P&L only', () => expect(calcSessionPnl(orders)).toBe(3000))
  test('excludes OPEN orders',        () => {
    const onlyOpen = [{ status: 'OPEN', realized_pnl: 9999 }]
    expect(calcSessionPnl(onlyOpen)).toBe(0)
  })
  test('empty orders → 0',            () => expect(calcSessionPnl([])).toBe(0))
  test('all winning → positive',       () => {
    expect(calcSessionPnl([
      { status: 'CLOSED', realized_pnl: 1000 },
      { status: 'CLOSED', realized_pnl: 2000 },
    ])).toBe(3000)
  })
})

// ── Session win rate ──────────────────────────────────────────────────────────
describe('calcSessionWinRate', () => {
  test('2 wins 1 loss = 67%', () => {
    expect(calcSessionWinRate([
      { status: 'CLOSED', realized_pnl: 1000 },
      { status: 'CLOSED', realized_pnl: -500 },
      { status: 'CLOSED', realized_pnl: 200 },
    ])).toBe(67)
  })
  test('all wins = 100%',   () => {
    expect(calcSessionWinRate([
      { status: 'CLOSED', realized_pnl: 100 },
      { status: 'CLOSED', realized_pnl: 200 },
    ])).toBe(100)
  })
  test('all losses = 0%',   () => {
    expect(calcSessionWinRate([{ status: 'CLOSED', realized_pnl: -100 }])).toBe(0)
  })
  test('no closed → 0',     () => {
    expect(calcSessionWinRate([{ status: 'OPEN', realized_pnl: 0 }])).toBe(0)
  })
  test('breakeven = 0%',    () => {
    expect(calcSessionWinRate([{ status: 'CLOSED', realized_pnl: 0 }])).toBe(0)
  })
})

// ── Sharpe ratio ─────────────────────────────────────────────────────────────
describe('calcSharpeRatio', () => {
  test('positive Sharpe for consistently good returns', () => {
    const returns = [0.02, 0.03, 0.025, 0.02, 0.03]
    expect(calcSharpeRatio(returns)).toBeGreaterThan(0)
  })
  test('zero Sharpe when all returns equal', () => {
    // mean = 0.02, stddev = 0 → Sharpe = 0 (to avoid div-by-zero)
    expect(calcSharpeRatio([0.02, 0.02, 0.02])).toBe(0)
  })
  test('negative Sharpe for consistently bad returns', () => {
    const returns = [-0.02, -0.03, -0.02, -0.01, -0.02]
    expect(calcSharpeRatio(returns)).toBeLessThan(0)
  })
  test('less than 2 elements → 0', () => {
    expect(calcSharpeRatio([0.05])).toBe(0)
    expect(calcSharpeRatio([])).toBe(0)
  })
})

// ── Max drawdown ──────────────────────────────────────────────────────────────
describe('calcMaxDrawdown', () => {
  test('50% drawdown from 200 → 100', () => {
    const curve = [100, 150, 200, 150, 100]
    expect(calcMaxDrawdown(curve)).toBeCloseTo(0.5, 2)
  })
  test('no drawdown in uptrend', () => {
    expect(calcMaxDrawdown([100, 110, 120, 130])).toBe(0)
  })
  test('100% drawdown (ruin)', () => {
    expect(calcMaxDrawdown([100, 50, 0])).toBe(1)
  })
  test('empty curve → 0', () => {
    expect(calcMaxDrawdown([])).toBe(0)
  })
  test('single value → 0', () => {
    expect(calcMaxDrawdown([100])).toBe(0)
  })
})

// ── Position cost + capital tracking ─────────────────────────────────────────
describe('calcPositionSize', () => {
  test('cost = price * qty + broker fee', () => {
    const cost = calcPositionSize(100000, 500, 100)
    // 100 * 500 = 50000, fee = 50000 * 0.0036 = 180
    expect(cost).toBeCloseTo(50180, 0)
  })
  test('large position: uses lower fee tier', () => {
    // 1000 units @ 500 = 500000, fee tier = 0.33%
    const cost = calcPositionSize(1000000, 500, 1000)
    expect(cost).toBeCloseTo(501650, 0)
  })
})

describe('calcRemainingCapital', () => {
  test('deducts order cost from available capital', () =>
    expect(calcRemainingCapital(100000, 50000)).toBe(50000))
  test('goes negative if order exceeds capital', () =>
    expect(calcRemainingCapital(50000, 60000)).toBe(-10000))
  test('zero cost → unchanged', () =>
    expect(calcRemainingCapital(100000, 0)).toBe(100000))
})

// ── P&L at exit (net of fees) ─────────────────────────────────────────────────
describe('calcPnlAtExit', () => {
  test('LONG profitable after fees', () => {
    // entry 500, exit 600, 100 units, entry fee 180, exit fee 216
    const pnl = calcPnlAtExit('LONG', 500, 600, 100, 180, 216)
    // gross = (600-500)*100 = 10000, net = 10000 - 180 - 216 = 9604
    expect(pnl).toBeCloseTo(9604, 0)
  })
  test('SHORT profitable after fees', () => {
    // entry 600, exit 540, 80 units, fees ~216+194
    const pnl = calcPnlAtExit('SHORT', 600, 540, 80, 216, 194)
    // gross = (600-540)*80 = 4800, net = 4800 - 410 = 4390
    expect(pnl).toBeCloseTo(4390, 0)
  })
  test('breakeven: gross = 0, net negative due to fees', () => {
    const pnl = calcPnlAtExit('LONG', 500, 500, 100, 180, 180)
    expect(pnl).toBe(-360)
  })
  test('loss is larger after fees', () => {
    const pnl = calcPnlAtExit('LONG', 500, 450, 100, 180, 162)
    // gross = -5000, net = -5000 - 342 = -5342
    expect(pnl).toBeLessThan(-5000)
  })
})
