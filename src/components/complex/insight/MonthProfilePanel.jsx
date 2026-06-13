// === insight/MonthProfilePanel.jsx — "what does July usually do?" panel ===
import { MONTHS_FULL } from '../../../utils/constants'
import { LABEL, fmtPct } from './helpers'

// Opens from a month-header click. Shows the seasonal stats for one calendar
// month plus every year's value as a clickable diverging bar (click → cell detail).
export default function MonthProfilePanel({ month, years, wAvg, wWinRate, wStdDev, onClose, onNavigate, onPickCell }) {
  const mi   = month - 1
  const rows = years.map(y => ({ year: y.year, val: y.months[mi] })).filter(r => r.val != null)
  const n    = rows.length
  const winN = rows.filter(r => r.val > 0).length
  const maxAbs = n ? Math.max(...rows.map(r => Math.abs(r.val)), 1) : 1
  const ranked = wAvg.map((v, i) => ({ v, i })).filter(x => x.v != null).sort((a, b) => b.v - a.v)
  const rank   = ranked.findIndex(x => x.i === mi) + 1
  const avg = wAvg[mi]
  const win = wWinRate[mi]
  const sd  = wStdDev?.[mi]
  const winColor = win == null ? '#9ca3af' : win >= 60 ? '#22c55e' : win >= 45 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-900 overflow-hidden">

      {/* Header — mirrors InlineRightPanel's layout */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
            Month profile
          </div>
          <div className="text-lg font-black leading-tight text-gray-800 dark:text-gray-100">
            {MONTHS_FULL[mi]}
          </div>
        </div>
        <button onClick={() => onNavigate(-1)} title="Previous month (←)" aria-label="Previous month"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-[14px] lg:text-[12px]">
          ‹
        </button>
        <button onClick={() => onNavigate(1)} title="Next month (→)" aria-label="Next month"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-[14px] lg:text-[12px]">
          ›
        </button>
        <button onClick={onClose} title="Close (Esc)" aria-label="Close month profile"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-[20px] lg:text-lg leading-none">
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-950/70 p-3 space-y-2.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">

        {!n && (
          <div className="p-4 text-center text-[11px] text-gray-400">
            No data for {MONTHS_FULL[mi]} in the selected year range
          </div>
        )}

        {n > 0 && (
          <>
            {/* Seasonal stat tiles */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                <div className={LABEL}>Wtd Avg</div>
                <div className="text-[15px] font-black tabular-nums leading-tight mt-0.5"
                  style={{ color: (avg ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                  {fmtPct(avg)}
                </div>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                <div className={LABEL}>Win Rate</div>
                <div className="text-[15px] font-black tabular-nums leading-tight mt-0.5" style={{ color: winColor }}>
                  {win != null ? `${win}%` : '—'}
                </div>
                <div className="text-[10px] text-gray-400">{winN}/{n} positive</div>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                <div className={LABEL}>Volatility σ</div>
                <div className="text-[15px] font-black tabular-nums leading-tight mt-0.5 text-gray-700 dark:text-gray-200">
                  {sd != null ? sd.toFixed(1) : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                <div className={LABEL}>Seasonal Rank</div>
                <div className="text-[15px] font-black tabular-nums leading-tight mt-0.5 text-gray-700 dark:text-gray-200">
                  {rank > 0 ? `#${rank}` : '—'}<span className="text-[10px] font-bold text-gray-400"> of {ranked.length}</span>
                </div>
              </div>
            </div>

            {/* Every year of this month — clickable bars */}
            <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 p-2.5 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className={LABEL}>{MONTHS_FULL[mi]} by year · {n}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">click year → detail</span>
              </div>
              <div className="space-y-px">
                {rows.map(r => {
                  const isPos = r.val >= 0
                  const w     = Math.abs(r.val) / maxAbs * 100
                  const color = isPos ? '#22c55e' : '#ef4444'
                  return (
                    <button key={r.year}
                      onClick={() => onPickCell(r.year, month, r.val)}
                      className="w-full flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                      <span className="text-[10px] font-bold w-8 shrink-0 text-right text-gray-500 dark:text-gray-400">{r.year}</span>
                      <div className="flex-1 flex items-center h-3.5 relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                        {isPos
                          ? <div className="absolute left-1/2 h-2 rounded-r-sm" style={{ width: `${w / 2}%`, background: color }} />
                          : <div className="absolute right-1/2 h-2 rounded-l-sm" style={{ width: `${w / 2}%`, background: color }} />}
                      </div>
                      <span className="text-[10px] font-bold w-11 text-right shrink-0 tabular-nums" style={{ color }}>
                        {fmtPct(r.val)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer — keyboard hints, desktop only */}
      <div className="shrink-0 hidden lg:block px-3 py-1 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="text-[10px] text-gray-500 dark:text-gray-500">← → change month · Esc close · click year for detail</span>
      </div>
    </div>
  )
}
