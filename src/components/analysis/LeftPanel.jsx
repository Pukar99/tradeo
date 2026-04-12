import { useState, useEffect } from 'react'
import { getTradeLog, getWatchlist, getTodayTasks } from '../../api'
import { useAnalysis } from '../../context/AnalysisContext'

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{title}</span>
      {count != null && count > 0 && (
        <span className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

function PnLBadge({ entry, close }) {
  if (!entry || !close) return null
  const pct = ((close - entry) / entry * 100).toFixed(1)
  const pos = pct >= 0
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
      pos ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : 'bg-red-50 dark:bg-red-950 text-red-500'
    }`}>
      {pos ? '+' : ''}{pct}%
    </span>
  )
}

export default function LeftPanel() {
  const { selectedSymbol, selectSymbol } = useAnalysis()
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [tasks,     setTasks]     = useState([])
  const [tab,       setTab]       = useState('portfolio')  // 'portfolio' | 'watchlist'

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

  return (
    <div className="flex flex-col h-full gap-0 overflow-hidden">

      {/* ── Tab switcher ─────────────────────────────────────────────── */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 mb-3 shrink-0">
        {[['portfolio', 'Portfolio'], ['watchlist', 'Watchlist']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1 rounded-lg text-[9px] font-semibold transition-colors ${
              tab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
            {key === 'portfolio' && positions.length > 0 && (
              <span className="ml-1 text-blue-500">{positions.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Portfolio tab ─────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <svg className="w-6 h-6 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-[10px] text-gray-400">No open positions</p>
            </div>
          ) : positions.map(p => (
            <div
              key={p.id}
              onClick={() => selectSymbol(p.symbol)}
              className={`cursor-pointer rounded-xl px-2.5 py-2 transition-all border ${
                selectedSymbol === p.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-bold text-gray-800 dark:text-gray-100">{p.symbol}</span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                  p.position === 'LONG'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                    : 'bg-red-100 dark:bg-red-950 text-red-500'
                }`}>{p.position}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-gray-500 space-y-0.5">
                  <div>Qty: <span className="text-gray-700 dark:text-gray-300 font-medium">{p.remaining_quantity ?? p.quantity}</span></div>
                  <div>Entry: <span className="text-gray-700 dark:text-gray-300 font-medium">Rs {p.entry_price?.toLocaleString()}</span></div>
                </div>
                <div className="text-right text-[9px] text-gray-500 space-y-0.5">
                  {p.sl && <div>SL: <span className="text-red-400 font-medium">{p.sl}</span></div>}
                  {p.tp && <div>TP: <span className="text-emerald-500 font-medium">{p.tp}</span></div>}
                </div>
              </div>
              {/* SL/TP progress bar */}
              {p.sl && p.tp && p.entry_price && (
                <div className="mt-1.5">
                  <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-400 via-gray-300 to-emerald-400 rounded-full" style={{ width: '100%' }} />
                  </div>
                  <div className="flex justify-between text-[7px] text-gray-400 mt-0.5">
                    <span>{p.sl}</span>
                    <span className="text-blue-400 font-semibold">{p.entry_price}</span>
                    <span>{p.tp}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Watchlist tab ──────────────────────────────────────────────── */}
      {tab === 'watchlist' && (
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <svg className="w-6 h-6 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p className="text-[10px] text-gray-400">No stocks in watchlist</p>
            </div>
          ) : watchlist.map(w => (
            <div
              key={w.id}
              onClick={() => selectSymbol(w.symbol)}
              className={`cursor-pointer rounded-xl px-2.5 py-2 transition-all border ${
                selectedSymbol === w.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-gray-800 dark:text-gray-100">{w.symbol}</span>
                {w.notes && (
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-md ${
                    w.notes.toUpperCase().includes('BUY')
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                      : w.notes.toUpperCase().includes('SELL')
                        ? 'bg-red-100 dark:bg-red-950 text-red-500'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>{w.notes.slice(0, 12)}</span>
                )}
              </div>
              {(w.watch_low || w.watch_high) && (
                <div className="flex gap-3 mt-0.5 text-[8px] text-gray-400">
                  {w.watch_low  && <span>Low: <span className="text-red-400">{w.watch_low}</span></span>}
                  {w.watch_high && <span>High: <span className="text-emerald-500">{w.watch_high}</span></span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Today's Action Plan ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 pt-3 mt-2">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Today's Plan" />
          <span className="text-[9px] text-gray-400">{completedTasks}/{tasks.length}</span>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 mb-2 overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${(completedTasks / tasks.length) * 100}%` }}
            />
          </div>
        )}

        <div className="space-y-1.5 max-h-28 overflow-y-auto">
          {tasks.length === 0
            ? <p className="text-[10px] text-gray-400">No tasks today</p>
            : tasks.slice(0, 6).map((t, i) => (
              <div key={t.id || i} className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  t.completed
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {t.completed && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <p className={`text-[10px] leading-tight ${
                  t.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'
                }`}>{t.label || t.title}</p>
              </div>
            ))
          }
        </div>
      </div>

    </div>
  )
}
