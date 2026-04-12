import { useState, useEffect } from 'react'
import axios from 'axios'
import { AnalysisProvider, useAnalysis } from '../context/AnalysisContext'
import SymbolSearch      from '../components/analysis/SymbolSearch'
import ChartControls     from '../components/analysis/ChartControls'
import StockChart        from '../components/analysis/StockChart'
import MarketStatusBadge from '../components/analysis/MarketStatusBadge'
import LeftPanel         from '../components/analysis/LeftPanel'
import RightPanel        from '../components/analysis/RightPanel'

// ── Live price bar for selected symbol ───────────────────────────────────────
function SymbolStatsBar({ symbol }) {
  const { isIndex, selectedIndexId } = useAnalysis()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!symbol) return
    setStats(null)

    const fetchData = async () => {
      try {
        if (isIndex(symbol)) {
          const r = await axios.get(`http://localhost:5000/api/market/index-chart?index_id=${selectedIndexId}&timeframe=1D`)
          const last = r.data.data?.[r.data.data.length - 1]
          if (last) setStats({ close: last.close, change: last.per_change, date: last.time, type: 'index', name: r.data.name })
        } else {
          const r = await axios.get(`http://localhost:5000/api/market/stock-chart?symbol=${symbol}&timeframe=1D`)
          const last = r.data.data?.[r.data.data.length - 1]
          if (last) setStats({ close: last.close, change: last.diff_pct, date: last.time, type: 'stock' })
        }
      } catch { /* silent */ }
    }

    fetchData()
  }, [symbol, selectedIndexId])

  if (!stats) {
    return (
      <div className="flex items-center gap-3 px-4 pt-2 pb-1 shrink-0">
        <span className="text-[14px] font-bold text-gray-900 dark:text-white">{symbol}</span>
        <span className="text-[10px] text-gray-300 dark:text-gray-600 animate-pulse">Loading...</span>
      </div>
    )
  }

  const isPos  = parseFloat(stats.change) >= 0
  const change = parseFloat(stats.change)

  return (
    <div className="flex items-center gap-4 px-4 pt-2 pb-1 shrink-0">
      {/* Symbol + type badge */}
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-bold text-gray-900 dark:text-white">{symbol}</span>
        <span className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-400">
          {stats.type === 'index' ? 'Index' : 'Stock'}
        </span>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

      {/* Price */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[18px] font-bold tracking-tight text-gray-900 dark:text-white">
          {stats.close?.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-[10px] text-gray-400">Rs</span>
      </div>

      {/* Change */}
      <div className={`flex items-center gap-1 text-[11px] font-semibold ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
        <span>{isPos ? '▲' : '▼'}</span>
        <span>{Math.abs(change).toFixed(2)}%</span>
      </div>

      {/* Date */}
      <span className="text-[9px] text-gray-400 hidden sm:inline">as of {stats.date}</span>
    </div>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────
function AnalysisInner() {
  const { selectedSymbol } = useAnalysis()
  const [mode, setMode] = useState('simple')   // 'simple' | 'complex'

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-semibold text-gray-900 dark:text-white">Analysis</h1>

          {/* Mode toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {['simple', 'complex'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md text-[10px] font-semibold capitalize transition-colors ${
                  mode === m
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <MarketStatusBadge />
      </div>

      {mode === 'complex' ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
          Complex mode coming soon
        </div>
      ) : (
        /* ── 3-panel layout ──────────────────────────────────────────────── */
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — 15% */}
          <div className="w-[15%] min-w-[140px] border-r border-gray-100 dark:border-gray-800 p-3 overflow-y-auto hidden lg:block">
            <LeftPanel />
          </div>

          {/* MIDDLE — 65% */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Controls bar */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <SymbolSearch />
              <ChartControls />
            </div>

            {/* Symbol stats bar */}
            <SymbolStatsBar symbol={selectedSymbol} />

            {/* Chart area — fills remaining space */}
            <div className="flex-1 px-2 pb-2 min-h-0">
              <StockChart />
            </div>
          </div>

          {/* RIGHT — 20% */}
          <div className="w-[20%] min-w-[160px] border-l border-gray-100 dark:border-gray-800 p-3 overflow-y-auto hidden md:block">
            <RightPanel />
          </div>

        </div>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <AnalysisProvider>
      <AnalysisInner />
    </AnalysisProvider>
  )
}
