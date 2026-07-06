// === BriefCards.jsx — morning brief card ===
// Moved verbatim from AIChat.jsx (P2.1 split). BriefStat is module-private.
import { pnlClass } from '../../../utils/format'

// ── Morning brief card ────────────────────────────────────────────────────────
export function MorningBriefCard({ brief }) {
  if (!brief) return null
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="border-l-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-3 py-2 mb-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">☀️</span>
        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          {greeting}! Your Trading Brief
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        <BriefStat
          icon="📈"
          label="Open Trades"
          value={brief.openTradesCount}
          color="text-green-600 dark:text-green-400"
        />
        <BriefStat
          icon="👁️"
          label="Watch Alerts"
          value={brief.watchAlertsCount}
          color="text-purple-600 dark:text-purple-400"
        />
        <BriefStat
          icon="🏆"
          label="Goals Pending"
          value={brief.pendingGoalsCount}
          color="text-teal-600 dark:text-teal-400"
        />
      </div>

      {/* Discipline */}
      {brief.avgDiscipline !== null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            7-day discipline avg:
          </span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${brief.avgDiscipline >= 70 ? 'bg-green-400' : brief.avgDiscipline >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${brief.avgDiscipline}%` }}
            />
          </div>
          <span
            className={`text-[10px] font-semibold ${brief.avgDiscipline >= 70 ? 'text-green-500' : brief.avgDiscipline >= 40 ? 'text-yellow-500' : 'text-red-500'}`}
          >
            {brief.avgDiscipline}%
          </span>
        </div>
      )}

      {/* Risk alerts */}
      {brief.riskAlerts?.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-red-500 mb-0.5">⚠️ Risk Alerts</p>
          {brief.riskAlerts.map((a, i) => (
            <p key={i} className="text-[10px] text-red-400">
              {a.symbol} — {a.reason}
            </p>
          ))}
        </div>
      )}

      {/* Near target */}
      {brief.nearTarget?.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-green-600 mb-0.5">
            🎯 Near Target — Consider booking profit
          </p>
          {brief.nearTarget.map((a, i) => (
            <p key={i} className="text-[10px] text-green-500" translate="no">
              {a.symbol} → TP: Rs.{a.tp}
            </p>
          ))}
        </div>
      )}

      {/* Watchlist alerts */}
      {brief.watchAlerts?.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-1.5 mb-1.5">
          <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mb-1">
            👁️ Watchlist Alerts
          </p>
          {brief.watchAlerts.map((w, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="font-medium text-gray-700 dark:text-gray-300" translate="no">
                {w.symbol}
              </span>
              <span className="text-gray-400" translate="no">
                {w.ltp ? `Rs.${w.ltp}` : '—'}
              </span>
              {w.alertStatus && <span className="text-purple-500">{w.alertStatus}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Pending goals */}
      {brief.pendingGoals?.length > 0 && (
        <div className="mb-1.5">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
            🏆 Pending Goals
          </p>
          {brief.pendingGoals.map((g, i) => (
            <p key={i} className="text-[10px] text-gray-500 dark:text-gray-400">
              • {g}
            </p>
          ))}
        </div>
      )}

      {/* Open positions table */}
      {brief.openTrades?.length > 0 && (
        <div className="mt-1">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Open Positions
          </p>
          <div className="space-y-0.5">
            {brief.openTrades.map((t, i) => {
              const unrealized = t.ltp
                ? (t.position === 'LONG' ? t.ltp - t.entry : t.entry - t.ltp) * t.qty
                : null
              return (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{t.symbol}</span>
                  <span className="text-gray-400">
                    {t.qty}@{t.entry}
                  </span>
                  {unrealized !== null && (
                    <span className={pnlClass(unrealized, 'text-green-500', 'text-red-400')}>
                      {unrealized >= 0 ? '+' : ''}Rs.{Math.round(unrealized).toLocaleString()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
function BriefStat({ icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1.5 text-center">
      <p className="text-sm leading-none">{icon}</p>
      <p className={`text-sm font-bold ${color} mt-0.5`}>{value}</p>
      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{label}</p>
    </div>
  )
}
