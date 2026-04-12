import { useState, useEffect } from 'react'
import { getTradeLog, getWatchlist, getTodayTasks } from '../../api'
import { useAnalysis } from '../../context/AnalysisContext'

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      {children}
    </div>
  )
}

export default function LeftPanel() {
  const { selectSymbol } = useAnalysis()
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [tasks, setTasks]         = useState([])

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

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">

      {/* Open Positions */}
      <Section title="Positions">
        {positions.length === 0
          ? <p className="text-[10px] text-gray-400">No open positions</p>
          : (
            <div className="space-y-1">
              {positions.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectSymbol(p.symbol)}
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-1.5 py-1 transition-colors"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{p.symbol}</p>
                    <p className="text-[9px] text-gray-400">{p.remaining_quantity ?? p.quantity} shares</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">@{p.entry_price}</p>
                    <p className={`text-[9px] font-semibold ${p.position === 'LONG' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {p.position}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </Section>

      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Watchlist */}
      <Section title="Watchlist">
        {watchlist.length === 0
          ? <p className="text-[10px] text-gray-400">No stocks watched</p>
          : (
            <div className="space-y-1">
              {watchlist.slice(0, 8).map(w => (
                <div
                  key={w.id}
                  onClick={() => selectSymbol(w.symbol)}
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-1.5 py-1 transition-colors"
                >
                  <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{w.symbol}</p>
                  {w.notes && (
                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-md ${
                      w.notes.toUpperCase().includes('BUY')
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                        : w.notes.toUpperCase().includes('SELL')
                          ? 'bg-red-100 dark:bg-red-950 text-red-500'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                    }`}>
                      {w.notes.slice(0, 10)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </Section>

      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Today's Tasks */}
      <Section title="Today's Tasks">
        {tasks.length === 0
          ? <p className="text-[10px] text-gray-400">No tasks</p>
          : (
            <div className="space-y-1.5">
              {tasks.slice(0, 6).map((t, i) => (
                <div key={t.id || i} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
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
                  <p className={`text-[10px] ${t.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {t.label || t.title}
                  </p>
                </div>
              ))}
            </div>
          )
        }
      </Section>

    </div>
  )
}
