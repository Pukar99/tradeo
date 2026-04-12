import { useState, useEffect } from 'react'
import { AnalysisProvider, useAnalysis } from '../context/AnalysisContext'
import SymbolSearch      from '../components/analysis/SymbolSearch'
import ChartControls     from '../components/analysis/ChartControls'
import StockChart        from '../components/analysis/StockChart'
import MarketStatusBadge from '../components/analysis/MarketStatusBadge'
import LeftPanel         from '../components/analysis/LeftPanel'
import RightPanel        from '../components/analysis/RightPanel'
import { getIndexChart, getStockChart } from '../api'

// ── Inline price display ──────────────────────────────────────────────────────
function LivePrice() {
  const { selectedSymbol, selectedIndexId, isIndex } = useAnalysis()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    setStats(null)
    const fetch = async () => {
      try {
        if (isIndex(selectedSymbol)) {
          const r = await getIndexChart({ index_id: selectedIndexId, timeframe: '1D' })
          const last = r.data.data?.at(-1)
          if (last) setStats({ close: last.close, change: last.per_change })
        } else {
          const r = await getStockChart({ symbol: selectedSymbol, timeframe: '1D' })
          const last = r.data.data?.at(-1)
          if (last) setStats({ close: last.close, change: last.diff_pct })
        }
      } catch { /* silent */ }
    }
    fetch()
  }, [selectedSymbol, selectedIndexId])

  const isPos  = parseFloat(stats?.change) >= 0
  const change = parseFloat(stats?.change) || 0

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedSymbol}</span>
      {stats ? (
        <>
          <span className="text-[13px] font-bold tabular-nums text-gray-800 dark:text-gray-100">
            {parseFloat(stats.close).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-[10px] font-semibold ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
            {isPos ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
          </span>
        </>
      ) : (
        <span className="text-[10px] text-gray-300 dark:text-gray-600 animate-pulse">—</span>
      )}
    </div>
  )
}

// ── Middle panel: chart area with its own header row ─────────────────────────
function MiddlePanel() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* Search + price + chart controls — inside the chart zone */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-950">
        <SymbolSearch />
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />
        <LivePrice />
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />
        <ChartControls />
      </div>

      {/* Chart fills remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <StockChart />
      </div>
    </div>
  )
}

// ── Page inner ────────────────────────────────────────────────────────────────
function AnalysisInner() {
  const [mode, setMode] = useState('simple')

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Slim top bar: only mode toggle + market status ──────────────── */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {['simple', 'complex'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2.5 py-0.5 rounded-md text-[9px] font-semibold capitalize transition-colors ${
                mode === m ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              }`}>
              {m}
            </button>
          ))}
        </div>
        <MarketStatusBadge />
      </div>

      {mode === 'complex' ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
          Complex mode coming soon
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — 10% */}
          <div className="w-[10%] min-w-[120px] border-r border-gray-100 dark:border-gray-800 overflow-y-auto hidden lg:block">
            <LeftPanel />
          </div>

          {/* MIDDLE — fills remaining space */}
          <MiddlePanel />

          {/* RIGHT — 15% */}
          <div className="w-[15%] min-w-[160px] border-l border-gray-100 dark:border-gray-800 overflow-y-auto hidden md:block">
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
