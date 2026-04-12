import { useState, useEffect } from 'react'
import { getTradeLog, getWatchlist, getTodayTasks } from '../../api'
import { useAnalysis } from '../../context/AnalysisContext'

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{title}</span>
      {count != null && count > 0 && (
        <span className="text-[7px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

export default function LeftPanel() {
  const { selectedSymbol, selectSymbol } = useAnalysis()
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [tasks,     setTasks]     = useState([])
  const [tab,       setTab]       = useState('portfolio')

  useEffect(() => {
    getTradeLog()
      .then(r => setPositions((r.data || []).filter(t => t.status === 'OPEN' || t.status === 'PARTIAL')))
      .catch(() => {})
    getWatchlist()
      .then(r => setWatchlist(r.data || []))
      .catch(() => {})
    getTodayTasks()
      .then(r => {
        const fixed  = (r.data.fixedTasks || []).map(t => ({ ...t, label: t.label || t.id }))
        const custom = r.data.customTasks || []
        setTasks([...fixed, ...custom])
      })
      .catch(() => {})
  }, [])

  const completedTasks = tasks.filter(t => t.completed).length

  // Derive alerts from positions that have SL/TP
  const alerts = positions
    .filter(p => p.sl || p.tp)
    .map(p => ({ symbol: p.symbol, sl: p.sl, tp: p.tp }))

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Tab switcher ─────────────────────────────────────────────── */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 m-2 shrink-0">
        {[['portfolio', 'P'], ['watchlist', 'W']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1 rounded-lg text-[9px] font-bold transition-colors relative ${
              tab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
            {key === 'portfolio' && positions.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Portfolio tab ─────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1">
          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-[9px] text-gray-400">No open positions</p>
            </div>
          ) : positions.map(p => (
            <div
              key={p.id}
              onClick={() => selectSymbol(p.symbol, null, p)}
              className={`cursor-pointer rounded-xl px-2 py-2 transition-all border ${
                selectedSymbol === p.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{p.symbol}</span>
                <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                  p.position === 'LONG'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                    : 'bg-red-100 dark:bg-red-950 text-red-500'
                }`}>{p.position}</span>
              </div>
              <div className="text-[8px] text-gray-500 space-y-0.5">
                <div>Qty: <span className="text-gray-700 dark:text-gray-300 font-medium">{p.remaining_quantity ?? p.quantity}</span></div>
                <div>Entry: <span className="text-blue-400 font-medium">{p.entry_price?.toLocaleString()}</span></div>
                {p.sl && <div>SL: <span className="text-red-400 font-medium">{p.sl}</span></div>}
                {p.tp && <div>TP: <span className="text-emerald-500 font-medium">{p.tp}</span></div>}
              </div>
              {/* SL/TP progress bar */}
              {p.sl && p.tp && p.entry_price && (
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-400 via-gray-300 dark:via-gray-600 to-emerald-400 rounded-full" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Watchlist tab ──────────────────────────────────────────────── */}
      {tab === 'watchlist' && (
        <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1">
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-[9px] text-gray-400">No stocks</p>
            </div>
          ) : watchlist.map(w => (
            <div
              key={w.id}
              onClick={() => selectSymbol(w.symbol)}
              className={`cursor-pointer rounded-xl px-2 py-2 transition-all border ${
                selectedSymbol === w.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{w.symbol}</span>
                {w.notes && (
                  <span className={`text-[7px] font-semibold px-1 py-0.5 rounded ${
                    w.notes.toUpperCase().includes('BUY')
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                      : w.notes.toUpperCase().includes('SELL')
                        ? 'bg-red-100 dark:bg-red-950 text-red-500'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>{w.notes.slice(0, 6)}</span>
                )}
              </div>
              {(w.watch_low || w.watch_high) && (
                <div className="flex gap-2 mt-0.5 text-[7px] text-gray-400">
                  {w.watch_low  && <span>L: <span className="text-red-400">{w.watch_low}</span></span>}
                  {w.watch_high && <span>H: <span className="text-emerald-500">{w.watch_high}</span></span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Today's Action Plan ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 pt-2 pb-1 mt-1">
        <div className="flex items-center justify-between mb-1">
          <SectionHeader title="Today's Plan" />
          <span className="text-[8px] text-gray-400">{completedTasks}/{tasks.length}</span>
        </div>
        {tasks.length > 0 && (
          <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 mb-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${(completedTasks / tasks.length) * 100}%` }}
            />
          </div>
        )}

        {/* BUY / SELL action buttons */}
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          <button className="py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-bold transition-colors shadow-sm">
            BUY
          </button>
          <button className="py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[9px] font-bold transition-colors shadow-sm">
            SELL
          </button>
        </div>

        <div className="space-y-1 max-h-20 overflow-y-auto">
          {tasks.length === 0
            ? <p className="text-[9px] text-gray-400">No tasks today</p>
            : tasks.slice(0, 5).map((t, i) => (
              <div key={t.id || i} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                  t.completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {t.completed && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <p className={`text-[9px] leading-tight truncate ${
                  t.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'
                }`}>{t.label || t.title}</p>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 py-2">
          <SectionHeader title="Alerts" />
          <div className="space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-[8px]">
                <span
                  onClick={() => selectSymbol(a.symbol)}
                  className="font-bold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-500 transition-colors"
                >
                  {a.symbol}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                  {a.sl && (
                    <span className="flex items-center gap-0.5 text-red-400">
                      <span>🔔</span> {a.sl}
                    </span>
                  )}
                  {a.tp && (
                    <span className="flex items-center gap-0.5 text-emerald-500">
                      <span>🎯</span> {a.tp}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
