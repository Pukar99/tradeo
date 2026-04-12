import { useState } from 'react'
import { AnalysisProvider, useAnalysis } from '../context/AnalysisContext'
import SymbolSearch     from '../components/analysis/SymbolSearch'
import ChartControls    from '../components/analysis/ChartControls'
import StockChart       from '../components/analysis/StockChart'
import MarketStatusBadge from '../components/analysis/MarketStatusBadge'
import LeftPanel        from '../components/analysis/LeftPanel'
import RightPanel       from '../components/analysis/RightPanel'

function AnalysisInner() {
  const { selectedSymbol } = useAnalysis()
  const [mode, setMode] = useState('simple')   // 'simple' | 'complex'
  const [latestDate]    = useState(null)        // populated by StockChart via prop if needed

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

        <MarketStatusBadge latestDate={latestDate} />
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

            {/* Symbol header */}
            <div className="px-4 pt-2 pb-1 shrink-0">
              <span className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedSymbol}</span>
            </div>

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
