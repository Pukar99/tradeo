import { useState } from 'react'
import { AnalysisProvider } from '../context/AnalysisContext'
import StockChart        from '../components/analysis/StockChart'
import MarketStatusBadge from '../components/analysis/MarketStatusBadge'
import LeftPanel         from '../components/analysis/LeftPanel'
import RightPanel        from '../components/analysis/RightPanel'

function AnalysisInner() {
  const [mode, setMode] = useState('simple')

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Minimal top strip: mode toggle + market status only ─────────── */}
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
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* LEFT — 10% */}
          <div className="w-[10%] min-w-[120px] max-w-[180px] border-r border-gray-100 dark:border-gray-800 overflow-y-auto hidden lg:flex flex-col shrink-0">
            <LeftPanel />
          </div>

          {/* MIDDLE — 75%: chart is self-contained with overlaid HUD */}
          <div className="w-[75%] flex-1 min-h-0 overflow-hidden">
            <StockChart />
          </div>

          {/* RIGHT — 15% */}
          <div className="w-[15%] min-w-[160px] max-w-[240px] border-l border-gray-100 dark:border-gray-800 overflow-y-auto hidden md:flex flex-col shrink-0">
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
