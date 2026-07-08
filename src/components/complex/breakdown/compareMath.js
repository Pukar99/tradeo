// =============================================================================
// compareMath.js — pure math for Breakdown's Compare view (S3 §8.4.3).
// Transplanted from the retired Performance tab's Compound Ladder.
// rows = cycle-compare API rows: { start_date, end_date, type, a_ret, b_ret, diff }.
// =============================================================================
import { indexLabel } from '../../../utils/constants'

export const rowKey = (r) => `${r.start_date}|${r.end_date}` // matches cycleKey shape

export function sideLabel(side) {
  if (!side) return '—'
  return side.symbol || indexLabel(side.index_id, '—')
}

export function compareSummary(rows) {
  const scored = rows.filter((r) => r.diff != null)
  const avg = (k) => scored.reduce((s, r) => s + r[k], 0) / scored.length
  const avgDiff = scored.length ? avg('diff') : null
  // Winner = higher average return over the scored (both-sides-present) cycles.
  // Tie when averages are within 0.05pp; null when nothing scored.
  let winner = null
  let winnerLead = null
  if (scored.length && avgDiff != null) {
    if (Math.abs(avgDiff) < 0.05) winner = 'tie'
    else winner = avgDiff > 0 ? 'a' : 'b'
    winnerLead = winner === 'tie' ? 0 : Math.abs(avgDiff)
  }
  // Where it mattered: biggest gap and closest cycle (scored rows only).
  const byGapDesc = [...scored].sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
  return {
    aWins: scored.filter((r) => r.diff > 0).length,
    compared: scored.length,
    avgA: scored.length ? avg('a_ret') : null,
    avgB: scored.length ? avg('b_ret') : null,
    avgDiff,
    winner,
    winnerLead,
    bestRow: byGapDesc[0] || null,
    closestRow: byGapDesc.length ? byGapDesc[byGapDesc.length - 1] : null,
  }
}

// Rs.`amount` enters at the anchor cycle (startKey; null = first row) and BOTH
// balances ride every cycle forward. null returns ride flat (honest: no data ≠ 0 gain,
// but the balance can't move without a price — footer flags coverage via compared).
export function buildLadder(rows, amount, startKey) {
  const startIdx = startKey == null ? 0 : Math.max(0, rows.findIndex((r) => rowKey(r) === startKey))
  let aBal = amount
  let bBal = amount
  const ladder = []
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i]
    aBal *= 1 + (r.a_ret ?? 0) / 100
    bBal *= 1 + (r.b_ret ?? 0) / 100
    ladder.push({ key: rowKey(r), type: r.type, a_ret: r.a_ret, b_ret: r.b_ret, aBal, bBal })
  }
  const last = ladder[ladder.length - 1]
  const final =
    last && amount > 0
      ? { aPct: ((last.aBal - amount) / amount) * 100, bPct: ((last.bBal - amount) / amount) * 100 }
      : null
  return { ladder, final }
}
