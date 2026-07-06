// === SummaryCards.jsx — risk summary + weekly summary cards ===
// Moved verbatim from AIChat.jsx (P2.1 split). Consumes PlanStat from PlanCards.
import { fmtRs, pnlClass } from '../../../utils/format'
import { PlanStat } from './PlanCards'

// ── Risk summary card — SHOW_RISK_SUMMARY: capital at risk across positions ───
export function RiskSummaryCard({ result }) {
  if (!result?.positions) return null
  const { positions, totalInvested, totalRisk, totalUnrealized, noSlCount } = result
  return (
    <div className="border-l-2 border-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">⚠️</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          Risk Summary ({positions.length} open)
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        <PlanStat label="Invested" value={fmtRs(totalInvested)} />
        <PlanStat
          label="At Risk"
          value={fmtRs(totalRisk)}
          accent="text-red-500"
        />
        <PlanStat
          label="Unrealized"
          value={`${totalUnrealized >= 0 ? '+' : ''}Rs.${Math.round(totalUnrealized).toLocaleString()}`}
          accent={pnlClass(totalUnrealized, 'text-green-500', 'text-red-400')}
        />
      </div>
      {positions.length > 0 && (
        <div className="space-y-1 mb-1.5">
          {positions.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 border border-gray-100 dark:border-gray-800 text-[10px]"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-800 dark:text-white" translate="no">
                  {p.symbol}
                </span>
                <span className="text-gray-400" translate="no">
                  {p.qty}@{p.entry}
                </span>
              </div>
              {p.riskAmount != null ? (
                <span className="font-semibold text-red-400" translate="no">
                  −{fmtRs(p.riskAmount)} max
                </span>
              ) : (
                <span className="font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500">
                  no SL
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {noSlCount > 0 && (
        <p className="text-[10px] text-red-500 font-medium">
          {noSlCount} position{noSlCount > 1 ? 's' : ''} without a stop loss — capital fully
          exposed.
        </p>
      )}
    </div>
  )
}

// ── Weekly summary card — WEEKLY_SUMMARY: this week's performance ─────────────
export function WeeklySummaryCard({ result }) {
  if (!result) return null
  const {
    totalPnl,
    wins,
    losses,
    winRate,
    tradesOpened,
    tradesClosed,
    bestTrade,
    worstTrade,
    avgDiscipline,
  } = result
  return (
    <div className="border-l-2 border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2 mb-1.5 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">📅</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          This Week's Performance
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        <PlanStat
          label="Net P&L"
          value={`${totalPnl >= 0 ? '+' : ''}Rs.${Math.round(totalPnl).toLocaleString()}`}
          accent={pnlClass(totalPnl, 'text-green-500', 'text-red-400')}
        />
        <PlanStat
          label="Win Rate"
          value={`${winRate}%`}
          accent={winRate >= 50 ? 'text-green-500' : 'text-red-400'}
        />
        <PlanStat label="W / L" value={`${wins} / ${losses}`} />
      </div>
      <div className="space-y-0.5 text-[10px] mb-1.5" translate="no">
        <div className="flex justify-between">
          <span className="text-gray-400">Opened / Closed</span>
          <span className="text-gray-600 dark:text-gray-300">
            {tradesOpened} / {tradesClosed}
          </span>
        </div>
        {bestTrade && (
          <div className="flex justify-between">
            <span className="text-gray-400">Best</span>
            <span className="text-green-500 font-semibold">
              {bestTrade.symbol} +Rs.{bestTrade.pnl.toLocaleString()}
            </span>
          </div>
        )}
        {worstTrade && worstTrade.pnl < 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">Worst</span>
            <span className="text-red-400 font-semibold">
              {worstTrade.symbol} −Rs.{Math.abs(worstTrade.pnl).toLocaleString()}
            </span>
          </div>
        )}
      </div>
      {avgDiscipline !== null && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Discipline avg:</span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${avgDiscipline >= 70 ? 'bg-green-400' : avgDiscipline >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${avgDiscipline}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
            {avgDiscipline}%
          </span>
        </div>
      )}
    </div>
  )
}
