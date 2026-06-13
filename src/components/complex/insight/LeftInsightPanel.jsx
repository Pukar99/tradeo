// === insight/LeftInsightPanel.jsx — index picker + Seasonal Edge + Top/Bottom years ===
import { memo } from 'react'
import { INDEX_OPTIONS, MONTHS as MONTHS_EN } from '../../../utils/constants'
import { LABEL, fmtPct } from './helpers'

// Memoized: parent re-renders on every heatmap-cell click but the left-panel
// props (data, wAvg, wWinRate, selectedIndexId, setSelectedIndexId) are all
// stable references unless the underlying data changes.
const LeftInsightPanel = memo(function LeftInsightPanel({
  data,
  wAvg,
  wWinRate,
  selectedIndexId,
  setSelectedIndexId,
}) {
  const validAvg = wAvg.filter((v) => v != null)
  const bestMi = validAvg.length ? wAvg.indexOf(Math.max(...validAvg)) : -1
  const worstMi = validAvg.length ? wAvg.indexOf(Math.min(...validAvg)) : -1

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">
      {/* Index selector — pill list */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className={`${LABEL} mb-1.5`}>Index</div>
        <div className="flex flex-wrap gap-1">
          {INDEX_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedIndexId(opt.id)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors min-w-[40px] text-center ${
                selectedIndexId === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {opt.short}
            </button>
          ))}
        </div>
      </div>

      {/* Seasonal Edge — Best/Worst month — most important glance insight */}
      {bestMi >= 0 && (
        <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className={`${LABEL} mb-2`}>Seasonal Edge</div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900 p-2">
              <div className="text-[10px] text-green-500 font-bold uppercase mb-0.5">Best</div>
              <div className="text-[12px] font-black text-green-600">{MONTHS_EN[bestMi]}</div>
              <div className="text-[10px] font-bold text-green-500">{fmtPct(wAvg[bestMi])}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{wWinRate[bestMi]}% win</div>
            </div>
            <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 p-2">
              <div className="text-[10px] text-red-400 font-bold uppercase mb-0.5">Worst</div>
              <div className="text-[12px] font-black text-red-500">{MONTHS_EN[worstMi]}</div>
              <div className="text-[10px] font-bold text-red-400">{fmtPct(wAvg[worstMi])}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{wWinRate[worstMi]}% win</div>
            </div>
          </div>
        </div>
      )}

      {/* (Win Rate / Month section removed — it duplicated the heatmap's Win% row) */}

      {/* Top / Bottom Years — compact grid */}
      {data?.best_years?.length > 0 && (
        <div className="shrink-0 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={`${LABEL} mb-1.5`}>Top Years</div>
              {(data.best_years || []).slice(0, 10).map((y, i) => (
                <div
                  key={y.year}
                  className={`flex items-center justify-between mb-0.5 px-1 py-0.5 rounded ${
                    i % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/60' : ''
                  }`}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="text-[10px] text-gray-500 dark:text-gray-500">
                      {i + 1}. {y.year}
                    </span>
                    {y.label && (
                      <span className="text-[8px] font-black px-0.5 rounded bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                        {y.label}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-green-500">{fmtPct(y.annual)}</span>
                </div>
              ))}
            </div>
            <div>
              <div className={`${LABEL} mb-1.5`}>Bottom</div>
              {(data.worst_years || []).slice(0, 10).map((y, i) => (
                <div
                  key={y.year}
                  className={`flex items-center justify-between mb-0.5 px-1 py-0.5 rounded ${
                    i % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/60' : ''
                  }`}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="text-[10px] text-gray-500 dark:text-gray-500">
                      {i + 1}. {y.year}
                    </span>
                    {y.label && (
                      <span className="text-[8px] font-black px-0.5 rounded bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400">
                        {y.label}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-red-400">{fmtPct(y.annual)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default LeftInsightPanel
