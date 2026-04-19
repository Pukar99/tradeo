import { useState, useContext } from 'react'
import { ScreenProvider, useScreen } from '../context/ScreenContext'
import { ComplexTabProvider }        from '../hooks/useComplexTab.jsx'
import StockChart                    from '../components/screen/StockChart'
import MarketStatusBadge             from '../components/screen/MarketStatusBadge'
import LeftPanel                     from '../components/screen/LeftPanel'
import RightPanel                    from '../components/screen/RightPanel'
import BacktestPage                  from '../components/backtest/BacktestPage'
import InsightPage                   from '../components/complex/InsightPage'
import BreakdownPage                 from '../components/complex/BreakdownPage'
import SectorStrengthPage            from '../components/complex/SectorStrengthPage'

const COMPLEX_TABS = [
  { id: 'Backtesting', label: 'Backtesting' },
  { id: 'Insight',     label: 'Insight'     },
  { id: 'Breakdown',   label: 'Breakdown'   },
  { id: 'Sectors',     label: 'Sectors'     },
]

function ComplexContent({ activeTab, onSelectSector }) {
  if (activeTab === 'Backtesting') return <BacktestPage />
  if (activeTab === 'Insight')     return <InsightPage />
  if (activeTab === 'Breakdown')   return <BreakdownPage />
  if (activeTab === 'Sectors')     return <SectorStrengthPage onSelectSector={onSelectSector} />
  return (
    <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
      {activeTab} — coming soon
    </div>
  )
}

function ScreenInner() {
  const { selectSymbol } = useScreen()
  const [mode,       setMode]       = useState(() => sessionStorage.getItem('screen_mode')       || 'simple')
  const [complexTab, setComplexTab] = useState(() => sessionStorage.getItem('screen_complexTab') || 'Backtesting')

  const handleMode = (m) => {
    setMode(m)
    sessionStorage.setItem('screen_mode', m)
  }
  const handleComplexTab = (t) => {
    setComplexTab(t)
    sessionStorage.setItem('screen_complexTab', t)
  }

  // Called when user clicks a sector tile — switch to simple chart mode
  const handleSelectSector = ({ index_id, name }) => {
    selectSymbol(name, index_id)
    handleMode('simple')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top strip ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-0.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">

          {/* Simple / Complex toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {['simple', 'complex'].map(m => (
              <button key={m} onClick={() => handleMode(m)}
                className={`px-2.5 py-0.5 rounded-md text-[9px] font-semibold capitalize transition-colors ${
                  mode === m
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                {m}
              </button>
            ))}
          </div>

          {/* Complex sub-tabs */}
          {mode === 'complex' && (
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {COMPLEX_TABS.map(t => (
                <button key={t.id} onClick={() => handleComplexTab(t.id)}
                  className={`px-2.5 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${
                    complexTab === t.id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <MarketStatusBadge />
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {mode === 'complex' ? (
        <ComplexTabProvider>
          <ComplexContent activeTab={complexTab} onSelectSector={handleSelectSector} />
        </ComplexTabProvider>
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

export default function ScreenPage() {
  return (
    <ScreenProvider>
      <ScreenInner />
    </ScreenProvider>
  )
}
