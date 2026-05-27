// === MarketJournalTab.jsx — market journal gallery/database/calendar views with NEPSE candlestick thumbnails ===
import { useState, useMemo, useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getIndexChart } from '../../api'
import MarketJournalModal from './MarketJournalModal'
import { safeUrl } from '../../utils/format'

// ── Module-level chart cache (shared across all cards, 5-min TTL) ─────────────
const _chartCache = new Map()
const CACHE_TTL   = 5 * 60_000

async function loadLC() { return import('lightweight-charts') }

// ── Mood meta ─────────────────────────────────────────────────────────────────
const MOOD_META = {
  Bullish:  { icon: '↑', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40' },
  Bearish:  { icon: '↓', pill: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/40' },
  Neutral:  { icon: '→', pill: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
  Confused: { icon: '?', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40' },
  Excited:  { icon: '⚡', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800/40' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtVol = (v) => {
  const n = parseFloat(v) || 0
  if (n >= 1e9) return `Rs.${(n / 1e9).toFixed(2)}B`
  if (n >= 1e7) return `Rs.${(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `Rs.${(n / 1e5).toFixed(1)}L`
  return `Rs.${Math.round(n).toLocaleString()}`
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-2xl">📰</div>
      <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">No market journal entries yet</p>
      <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
        Entries are auto-created when you open the Logs page. Come back after a trading day.
      </p>
    </div>
  )
}

// ── NEPSE candlestick thumbnail — last 15 bars ending at entry.date ──────────
function NepseThumbnail({ entryDate, onHoverChange, onOHLC }) {
  const { isDark }   = useTheme()
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    let cancelled = false

    async function build(allRows) {
      if (cancelled || !containerRef.current || !allRows.length) return
      const { createChart } = await loadLC()
      if (cancelled || !containerRef.current) return

      if (chartRef.current) {
        try { chartRef.current.remove() } catch (_) {}
        chartRef.current = null
      }

      // Take 29 bars ending at entryDate — entry bar is the rightmost real bar.
      // Then set rightOffset=15 so the timescale shows 15 empty bars to the right,
      // making the entry bar appear centered in the 30-bar visible window.
      const dates  = allRows.map(r => r.date?.slice(0, 10) || r.time)
      const idx    = entryDate ? dates.lastIndexOf(entryDate) : dates.length - 1
      const center = idx >= 0 ? idx : dates.length - 1
      const from   = Math.max(0, center - 29)
      const slice  = allRows.slice(from, center + 1)
      if (!slice.length) return

      // Fire OHLC for the entry bar so the card can display it
      const entryRow = allRows[center]
      if (entryRow && onOHLC && !cancelled) {
        onOHLC({
          open:  parseFloat(entryRow.open),
          high:  parseFloat(entryRow.high),
          low:   parseFloat(entryRow.low),
          close: parseFloat(entryRow.close),
        })
      }

      const bg   = isDark ? '#030712' : '#ffffff'
      const up   = '#10b981'
      const down = '#ef4444'

      const chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth  || 300,
        height: containerRef.current.clientHeight || 160,
        layout: { background: { color: bg }, textColor: 'transparent', attributionLogo: false },
        grid:   { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        rightPriceScale: { visible: false },
        leftPriceScale:  { visible: false },
        timeScale:       { visible: false, borderColor: 'transparent', rightOffset: 15 },
        crosshair:       { mode: 0 },
        handleScroll:    false,
        handleScale:     false,
      })
      chartRef.current = chart

      const series = chart.addCandlestickSeries({
        upColor: up, downColor: down,
        borderUpColor: up, borderDownColor: down,
        wickUpColor: up, wickDownColor: down,
        priceLineVisible: false,
        lastValueVisible: false,
      })

      const candleData = slice.map(r => ({
        time:  r.date?.slice(0, 10) || r.time,
        open:  parseFloat(r.open),
        high:  parseFloat(r.high),
        low:   parseFloat(r.low),
        close: parseFloat(r.close),
      })).filter(d => d.time && !isNaN(d.open))

      series.setData(candleData)
      chart.timeScale().fitContent()

      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !chart) return
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      })
      ro.observe(containerRef.current)
      chart._ro = ro
    }

    async function fetchAndBuild() {
      const key    = 'nepse:1Y'
      const cached = _chartCache.get(key)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        if (!cancelled) setLoading(false)
        await build(cached.data)
        return
      }
      try {
        const res  = await getIndexChart({ index_id: 12, timeframe: '1Y' })
        const data = res?.data?.data || []
        _chartCache.set(key, { data, ts: Date.now() })
        if (!cancelled) setLoading(false)
        await build(data)
      } catch {
        if (!cancelled) { setLoading(false); setError(true) }
      }
    }

    fetchAndBuild()

    return () => {
      cancelled = true
      if (chartRef.current) {
        try {
          if (chartRef.current._ro) chartRef.current._ro.disconnect()
          chartRef.current.remove()
        } catch (_) {}
        chartRef.current = null
      }
    }
  }, [isDark, entryDate]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="w-5 h-5 border border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <span className="text-[10px] text-gray-400">No chart data</span>
        </div>
      )}
    </div>
  )
}

// ── Gallery card ──────────────────────────────────────────────────────────────
function GalleryCard({ entry, onOpen }) {
  const [hovered, setHovered] = useState(false)
  const [ohlc,    setOhlc]    = useState(null)

  const change   = entry.nepse_change_pct != null ? parseFloat(entry.nepse_change_pct) : null
  const close    = entry.nepse_close      != null ? parseFloat(entry.nepse_close)      : null
  const mood     = entry.mood ? MOOD_META[entry.mood] : null
  const isUp     = change == null || change >= 0

  const adv  = entry.advancing ?? 0
  const dec  = entry.declining ?? 0
  const unch = entry.unchanged ?? 0
  const total = adv + dec + unch || 1
  const advPct = Math.round((adv / total) * 100)
  const decPct = Math.round((dec / total) * 100)

  const filledFields = [entry.pre_market, entry.during_market, entry.post_market, entry.market_surprise]
  const filledCount  = filledFields.filter(v => v?.trim()).length
  const journalLabels = ['Pre', 'During', 'Post', 'Surprise']

  const dateObj = new Date(entry.date + 'T00:00:00')

  // Best gainer + loser for quick glance
  const topGainer = entry.top_gainers?.[0]
  const topLoser  = entry.top_losers?.[0]

  // Sector heatmap — sort by abs change, show top 8
  const sectors = (entry.sector_data || [])
    .slice()
    .sort((a, b) => Math.abs(parseFloat(b.per_change)) - Math.abs(parseFloat(a.per_change)))
    .slice(0, 8)

  return (
    <div
      onClick={() => onOpen(entry)}
      className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-gray-900/80
                 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-xl hover:shadow-black/5
                 dark:hover:shadow-black/40 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer group"
    >
      {/* ── header row: date left | index+change right ── */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800/60 ${isUp ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : 'bg-red-50/60 dark:bg-red-900/10'}`}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-black text-gray-900 dark:text-white leading-none">
            {dateObj.getDate()} {dateObj.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          {close != null && (
            <span className="text-[11px] font-black text-gray-900 dark:text-white tabular-nums">
              {close.toLocaleString()}
            </span>
          )}
          {change != null && (
            <span className={`text-[10px] font-bold tabular-nums ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* ── chart — full width, OHLC overlay top-right in the empty half ── */}
      <div className="relative w-full bg-white dark:bg-gray-950 overflow-hidden" style={{ height: 150 }}>
        <style>{`.mj-thumb a[href*="tradingview"]{display:none!important;}`}</style>
        <div className="absolute inset-0 mj-thumb">
          <NepseThumbnail
            entryDate={entry.date}
            onHoverChange={setHovered}
            onOHLC={setOhlc}
          />
        </div>

        {/* OHLC + mood overlay — top-right, over the empty space after the entry bar */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-[3px] pointer-events-none">
          {ohlc && [
            { label: 'O', value: ohlc.open,  color: 'text-gray-400 dark:text-gray-500'         },
            { label: 'H', value: ohlc.high,  color: 'text-emerald-500'                         },
            { label: 'L', value: ohlc.low,   color: 'text-red-400'                             },
            { label: 'C', value: ohlc.close, color: isUp ? 'text-emerald-500' : 'text-red-400' },
          ].map(({ label, value, color }) => (
            <p key={label} className="text-[10px] font-mono tabular-nums leading-none">
              <span className="text-gray-400 dark:text-gray-600 font-bold">{label} </span>
              <span className={`font-semibold ${color}`}>
                {value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </p>
          ))}
          {mood && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-1 ${mood.pill}`}>
              {mood.icon} {entry.mood}
            </span>
          )}
          {entry.has_active_trades && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mt-0.5" />
          )}
        </div>
      </div>

      {/* ── card body ── */}
      <div className="flex flex-col gap-2.5 p-3.5 flex-1">

        {/* breadth progress bar */}
        {(adv + dec + unch) > 0 && (
          <div>
            <div className="flex justify-between text-[10px] font-semibold mb-1">
              <span className="text-emerald-500">{adv}↑ {advPct}%</span>
              <span className="text-gray-400">{unch}→</span>
              <span className="text-red-400">{decPct}% {dec}↓</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-gray-100 dark:bg-gray-800">
              <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${advPct}%` }} />
              <div className="bg-gray-300 dark:bg-gray-600 transition-all" style={{ width: `${Math.round((unch / total) * 100)}%` }} />
              <div className="bg-red-400 rounded-r-full transition-all" style={{ width: `${decPct}%` }} />
            </div>
          </div>
        )}

        {/* volume + top mover row */}
        <div className="flex items-center gap-2">
          {entry.total_volume != null && (
            <div className="flex-1 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Vol</p>
              <p className="text-[11px] font-bold font-mono text-gray-800 dark:text-gray-200">{fmtVol(entry.total_volume)}</p>
            </div>
          )}
          {topGainer && (
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2 py-1.5">
              <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Best</p>
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                {topGainer.symbol} <span className="font-mono">+{parseFloat(topGainer.diff_pct).toFixed(1)}%</span>
              </p>
            </div>
          )}
          {topLoser && (
            <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-lg px-2 py-1.5">
              <p className="text-[10px] text-red-400 uppercase tracking-wide">Worst</p>
              <p className="text-[11px] font-bold text-red-500 dark:text-red-400 truncate">
                {topLoser.symbol} <span className="font-mono">{parseFloat(topLoser.diff_pct).toFixed(1)}%</span>
              </p>
            </div>
          )}
        </div>

        {/* sector heatmap — sorted by abs change, top 8 */}
        {sectors.length > 0 && (
          <div className="grid grid-cols-4 gap-0.5">
            {sectors.map(s => {
              const pc = parseFloat(s.per_change)
              // intensity: cap at ±3% for color scaling
              const intensity = Math.min(Math.abs(pc) / 3, 1)
              const bg = pc > 0
                ? `rgba(16,185,129,${0.08 + intensity * 0.22})`
                : pc < 0
                ? `rgba(239,68,68,${0.08 + intensity * 0.22})`
                : undefined
              return (
                <div
                  key={s.index_id}
                  className="rounded px-1 py-1 text-center"
                  style={{ background: bg }}
                >
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate leading-none mb-0.5">{s.name}</p>
                  <p className={`text-[10px] font-bold leading-none ${
                    pc > 0 ? 'text-emerald-600 dark:text-emerald-400'
                    : pc < 0 ? 'text-red-500 dark:text-red-400'
                    : 'text-gray-400'
                  }`}>
                    {pc >= 0 ? '+' : ''}{pc.toFixed(1)}%
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* journal fill — labeled dots */}
        <div className="flex items-center justify-between mt-auto pt-0.5">
          <div className="flex gap-1.5">
            {journalLabels.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${filledFields[i]?.trim() ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                <span className="text-[9px] text-gray-400 font-medium">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 dark:text-gray-700 group-hover:text-gray-400 transition-colors select-none">
            Click to edit
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Calendar coming soon ───────────────────────────────────────────────────────
function CalendarComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 text-3xl">🗓</div>
      <p className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">Market Calendar</p>
      <p className="text-[11px] text-gray-400 mt-1.5 max-w-xs leading-relaxed">
        A heatmap calendar view of daily NEPSE performance and your journal entries — coming soon.
      </p>
    </div>
  )
}

// ── Sentiment + type meta ─────────────────────────────────────────────────────
const SENTIMENT_COLOR = {
  positive: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40',
  negative: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40',
  neutral:  'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
}
const TYPE_COLOR = {
  ipo:       'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  corporate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  macro:     'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  news:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

// ── Single entry card (database / list view) — click to expand ───────────────
function EntryCard({ entry, news, onOpen }) {
  const [expanded, setExpanded] = useState(false)

  const change   = entry.nepse_change_pct != null ? parseFloat(entry.nepse_change_pct) : null
  const close    = entry.nepse_close      != null ? parseFloat(entry.nepse_close)      : null
  const mood     = entry.mood ? MOOD_META[entry.mood] : null
  const isUp     = change == null || change >= 0
  const dateObj  = new Date(entry.date + 'T00:00:00')

  const filledCount = [entry.pre_market, entry.during_market, entry.post_market, entry.market_surprise]
    .filter(v => v?.trim()).length

  const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1'
  const NOTE  = 'text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap'

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden transition-all hover:border-gray-200 dark:hover:border-gray-700">

      {/* ── collapsed row — always visible, click to toggle ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-start gap-4 px-4 py-3.5 cursor-pointer group"
      >
        {/* date column */}
        <div className="flex-shrink-0 w-14 text-center">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
            {dateObj.toLocaleDateString('en-US', { month: 'short' })}
          </p>
          <p className="text-[22px] font-black text-gray-800 dark:text-white leading-none mt-0.5">
            {dateObj.getDate()}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
          </p>
        </div>

        {/* middle summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            {close != null ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-bold text-gray-900 dark:text-white tabular-nums">{close.toLocaleString()}</span>
                <span className={`text-[11px] font-semibold tabular-nums ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
                  {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : ''}
                </span>
              </div>
            ) : (
              <span className="text-[12px] text-gray-400 italic">No market data</span>
            )}
            {mood && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mood.pill}`}>
                {mood.icon} {entry.mood}
              </span>
            )}
            {entry.has_active_trades && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                Active Trades
              </span>
            )}
          </div>
          {(entry.advancing != null || entry.declining != null) && (
            <div className="flex items-center gap-3 flex-wrap">
              {entry.advancing != null && <span className="text-[10px] text-emerald-500 font-semibold">{entry.advancing}↑</span>}
              {entry.declining != null && <span className="text-[10px] text-red-400 font-semibold">{entry.declining}↓</span>}
              {entry.unchanged != null && <span className="text-[10px] text-gray-400">{entry.unchanged}→</span>}
              {entry.total_volume != null && <span className="text-[10px] text-gray-400">Vol {fmtVol(entry.total_volume)}</span>}
            </div>
          )}
        </div>

        {/* right: fill dots + chevron */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <div className="flex gap-0.5">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < filledCount ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            ))}
          </div>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* ── expanded detail panel ── */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 pt-3 space-y-4">

          {/* market data row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'NEPSE Close', value: close?.toLocaleString() ?? '—', color: isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400' },
              { label: 'Change',      value: change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—', color: isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400' },
              { label: 'Volume',      value: entry.total_volume != null ? fmtVol(entry.total_volume) : '—', color: 'text-gray-800 dark:text-gray-200' },
              { label: 'Breadth',     value: entry.advancing != null ? `${entry.advancing}↑  ${entry.declining}↓  ${entry.unchanged}→` : '—', color: 'text-gray-800 dark:text-gray-200' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className={`text-[12px] font-bold tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* gainers + losers */}
          {(entry.top_gainers?.length > 0 || entry.top_losers?.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {entry.top_gainers?.length > 0 && (
                <div>
                  <p className={LABEL}>Top Gainers</p>
                  <div className="space-y-1">
                    {entry.top_gainers.map(g => (
                      <div key={g.symbol} className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{g.symbol}</span>
                        <span className="text-[11px] font-semibold text-emerald-500">+{parseFloat(g.diff_pct).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {entry.top_losers?.length > 0 && (
                <div>
                  <p className={LABEL}>Top Losers</p>
                  <div className="space-y-1">
                    {entry.top_losers.map(l => (
                      <div key={l.symbol} className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{l.symbol}</span>
                        <span className="text-[11px] font-semibold text-red-400">{parseFloat(l.diff_pct).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* all sectors */}
          {entry.sector_data?.length > 0 && (
            <div>
              <p className={LABEL}>Sector Performance</p>
              <div className="flex flex-wrap gap-1.5">
                {entry.sector_data.map(s => {
                  const pc = parseFloat(s.per_change)
                  return (
                    <span key={s.index_id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                      pc > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400'
                      : pc < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-500 dark:text-red-400'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                    }`}>
                      {s.name} {pc >= 0 ? '+' : ''}{pc.toFixed(2)}%
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* journal notes */}
          {[
            { label: 'Pre-market Expectation', value: entry.pre_market      },
            { label: 'During-market Notes',    value: entry.during_market   },
            { label: 'Post-market Reflection', value: entry.post_market     },
            { label: 'Market Surprise',        value: entry.market_surprise },
          ].filter(f => f.value?.trim()).map(({ label, value }) => (
            <div key={label}>
              <p className={LABEL}>{label}</p>
              <p className={NOTE}>{value}</p>
            </div>
          ))}

          {/* news */}
          <div>
            <p className={LABEL}>Market News</p>
            {news.length > 0 ? (
              <div className="space-y-2">
                {news.map((item, i) => (
                  <a
                    key={i}
                    href={safeUrl(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-colors hover:opacity-80 ${SENTIMENT_COLOR[item.sentiment] || SENTIMENT_COLOR.neutral}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${TYPE_COLOR[item.type] || TYPE_COLOR.news}`}>
                          {item.type}
                        </span>
                        {item.symbol && (
                          <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400">{item.symbol}</span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold leading-snug">{item.title}</p>
                      {item.summary && item.summary !== item.title && (
                        <p className="text-[10px] opacity-70 mt-0.5 line-clamp-2">{item.summary}</p>
                      )}
                    </div>
                    <svg className="w-3 h-3 shrink-0 mt-0.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">No news archived for this date.</p>
            )}
          </div>

          {/* edit button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={e => { e.stopPropagation(); onOpen(entry) }}
              className="px-4 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-white transition-colors"
            >
              Edit Journal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main MarketJournalTab ─────────────────────────────────────────────────────
export default function MarketJournalTab({ view = 'database', marketJournals, onMarketJournalSaved }) {
  const [openEntry, setOpenEntry] = useState(null)

  const entries = useMemo(() => {
    if (!marketJournals?.length) return []
    // Deduplicate by date (keep first occurrence — API returns newest first)
    // and strip any weekend entries that slipped in before the backend guard was added
    const seen = new Set()
    return marketJournals.filter(e => {
      if (seen.has(e.date)) return false
      seen.add(e.date)
      const dow = new Date(e.date + 'T00:00:00').getDay() // 0=Sun, 6=Sat
      return dow !== 0 && dow !== 6
    })
  }, [marketJournals])

  const handleOpen  = (entry) => setOpenEntry(entry)
  const handleClose = () => setOpenEntry(null)
  const handleSaved = (updated) => { onMarketJournalSaved(updated); setOpenEntry(null) }

  if (view === 'calendar') return <CalendarComingSoon />

  return (
    <div className="space-y-4">

      {!marketJournals?.length ? (
        <Empty />
      ) : view === 'gallery' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {entries.map(entry => (
            <GalleryCard key={entry.id} entry={entry} onOpen={handleOpen} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              news={entry.news || []}
              onOpen={handleOpen}
            />
          ))}
        </div>
      )}

      {openEntry && (
        <MarketJournalModal
          entry={openEntry}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
