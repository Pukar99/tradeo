import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../context/ThemeContext'
import { getMonthlyReturns, getMonthDetail, getSectorMonth, getSectorMonthStocks, getStockChart } from '../../api/index'
import { apiError, isCanceled } from '../../utils/format'
import { INDEX_OPTIONS, RECENT_N, MONTHS as MONTHS_EN, MONTHS_FULL } from '../../utils/constants'
import { useToolbarSlot } from '../../pages/DataLabPage'

async function loadLC() { return import('lightweight-charts') }

// ─── Shared design tokens (match Performance tab) ─────────────────────────────
const CARD   = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
const LABEL  = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400'
const STITLE = 'text-[11px] font-semibold text-gray-700 dark:text-gray-200'
const SVAL   = 'text-[13px] font-bold tabular-nums'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-2 px-4 py-6 animate-pulse">
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
function cellBg(val, dark) {
  if (val == null) return dark ? '#1f2937' : '#f8fafc'   // matches gray-800 surface
  if (val >= 15)   return dark ? '#064e20' : '#86efac'
  if (val >= 8)    return dark ? '#14532d' : '#bbf7d0'
  if (val >= 3)    return dark ? '#166534' : '#dcfce7'
  if (val >= 0)    return dark ? '#1e3a2a' : '#f0fdf4'
  if (val >= -3)   return dark ? '#3b1a1a' : '#fff1f2'
  if (val >= -8)   return dark ? '#7f1d1d' : '#fecaca'
  return dark ? '#5c0a0a' : '#fca5a5'
}
function cellFg(val, dark) {
  if (val == null) return dark ? '#2d3f52' : '#cbd5e1'
  if (val >= 8)    return dark ? '#4ade80' : '#15803d'
  if (val >= 0)    return dark ? '#86efac' : '#166534'
  if (val >= -8)   return dark ? '#fca5a5' : '#b91c1c'
  return dark ? '#f87171' : '#991b1b'
}
function sectorCol(val) {
  if (val == null) return '#6b7280'
  if (val >= 10)   return '#22c55e'
  if (val >= 3)    return '#4ade80'
  if (val >= 0)    return '#86efac'
  if (val >= -3)   return '#f87171'
  if (val >= -10)  return '#ef4444'
  return '#dc2626'
}
function fmtPct(v, dp = 1) {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(dp) + '%'
}

// ─── Weighted stats ───────────────────────────────────────────────────────────
function weightedAvg(years) {
  const maxYear = Math.max(...years.map(y => y.year))
  return Array.from({ length: 12 }, (_, mi) => {
    let sw = 0, sv = 0
    years.forEach(row => {
      const v = row.months[mi]
      if (v == null) return
      const w = row.year > maxYear - RECENT_N ? 2 : 1
      sv += v * w; sw += w
    })
    return sw > 0 ? +(sv / sw).toFixed(2) : null
  })
}
function weightedWinRate(years) {
  const maxYear = Math.max(...years.map(y => y.year))
  return Array.from({ length: 12 }, (_, mi) => {
    let pos = 0, tot = 0
    years.forEach(row => {
      const v = row.months[mi]
      if (v == null) return
      const w = row.year > maxYear - RECENT_N ? 2 : 1
      if (v > 0) pos += w
      tot += w
    })
    return tot > 0 ? +(pos / tot * 100).toFixed(1) : null
  })
}
function monthStdDev(years) {
  return Array.from({ length: 12 }, (_, mi) => {
    const vals = years.map(y => y.months[mi]).filter(v => v != null)
    if (vals.length < 2) return null
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
    return +Math.sqrt(variance).toFixed(1)
  })
}

// ─── Win rate mini bar ────────────────────────────────────────────────────────
function WinBar({ label, rate }) {
  // Continuous hue interpolation: red(0%) → amber(50%) → green(100%)
  // Maps rate 0..100 to hue 0..130; saturation 75%, lightness 48%.
  const safeRate = rate ?? 50
  const hue = Math.max(0, Math.min(130, (safeRate / 100) * 130))
  const color = rate == null ? '#9ca3af' : `hsl(${hue}, 75%, 48%)`
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 text-[10px] text-gray-500 dark:text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${rate || 0}%`, background: color }} />
      </div>
      <span className="w-8 text-[10px] font-bold text-right shrink-0" style={{ color }}>
        {rate != null ? rate + '%' : '—'}
      </span>
    </div>
  )
}

// ─── Left Panel — trimmed to 3 essential sections ─────────────────────────────
// Memoized: parent re-renders on every heatmap-cell click but the left-panel
// props (data, wAvg, wWinRate, LABELS, selectedIndexId, setSelectedIndexId)
// are all stable references unless the underlying data changes. memo() skips
// the 12-row Win% bar re-render on unrelated parent updates.
const LeftInsightPanel = memo(function LeftInsightPanel({ data, wAvg, wWinRate, LABELS, selectedIndexId, setSelectedIndexId }) {

  const validAvg  = wAvg.filter(v => v != null)
  const bestMi    = validAvg.length ? wAvg.indexOf(Math.max(...validAvg)) : -1
  const worstMi   = validAvg.length ? wAvg.indexOf(Math.min(...validAvg)) : -1

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">

      {/* Index selector — pill list */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className={`${LABEL} mb-1.5`}>Index</div>
        <div className="flex flex-wrap gap-1">
          {INDEX_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setSelectedIndexId(opt.id)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors min-w-[40px] text-center ${
                selectedIndexId === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
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

      {/* Win Rate / Month — 12 bars */}
      <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className={`${LABEL} mb-2.5`}>Win Rate / Month</div>
        <div className="space-y-1">
          {wWinRate.map((wr, i) => (
            <WinBar key={i} label={LABELS[i]} rate={wr} />
          ))}
        </div>
      </div>

      {/* Top / Bottom Years — compact grid */}
      {data?.best_years?.length > 0 && (
        <div className="shrink-0 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={`${LABEL} mb-1.5`}>Top Years</div>
              {(data.best_years || []).slice(0, 10).map((y, i) => (
                <div key={y.year} className={`flex items-center justify-between mb-0.5 px-1 py-0.5 rounded ${
                  i % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/60' : ''
                }`}>
                  <span className="text-[10px] text-gray-500 dark:text-gray-500">{i+1}. {y.year}</span>
                  <span className="text-[10px] font-bold text-green-500">{fmtPct(y.annual)}</span>
                </div>
              ))}
            </div>
            <div>
              <div className={`${LABEL} mb-1.5`}>Bottom</div>
              {(data.worst_years || []).slice(0, 10).map((y, i) => (
                <div key={y.year} className={`flex items-center justify-between mb-0.5 px-1 py-0.5 rounded ${
                  i % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/60' : ''
                }`}>
                  <span className="text-[10px] text-gray-500 dark:text-gray-500">{i+1}. {y.year}</span>
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

// ─── Month OHLC chart (interactive) ───────────────────────────────────────────
function MonthChart({ candles, dark }) {
  const ref   = useRef(null)
  const cRef  = useRef(null)
  const roRef = useRef(null)

  // For 1-day months (holidays), lightweight-charts can't lay out a single
  // candle nicely — it collapses to the right edge. Fall back to a friendly stat card.
  const singleDay = candles?.length === 1 ? candles[0] : null

  useEffect(() => {
    const el = ref.current
    if (!el || !candles?.length || candles.length === 1) return
    let cancelled = false
    loadLC().then(({ createChart, CrosshairMode }) => {
    if (cancelled || !ref.current) return

    const chart = createChart(el, {
      width:  el.clientWidth  || 400,
      height: el.clientHeight || 200,
      // Hide the lightweight-charts "tv" attribution logo (large overlay text)
      attributionLogo: false,
      layout: {
        background:  { color: 'transparent' },
        textColor:   dark ? '#94a3b8' : '#64748b',
        fontFamily:  'Inter, system-ui, sans-serif',
        fontSize:    10,
      },
      watermark: { visible: false },
      grid: {
        vertLines: { color: 'transparent' },
        horzLines: { color: 'transparent' },
      },
      crosshair:       { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: dark ? '#334155' : '#e2e8f0', minimumWidth: 50, scaleMargins: { top: 0.1, bottom: 0.1 } },
      leftPriceScale:  { visible: false },
      timeScale: {
        borderColor: dark ? '#334155' : '#e2e8f0',
        timeVisible: false,
        tickMarkFormatter: () => '',
        // Constrain candle width — without this they stretch absurdly wide on short months.
        barSpacing:    8,
        minBarSpacing: 4,
        rightOffset:   1,
      },
      handleScroll: true,
      handleScale:  true,
    })

    const cs = chart.addCandlestickSeries({
      upColor:       '#22c55e',
      downColor:     '#ef4444',
      borderVisible: false,
      wickUpColor:   '#22c55e',
      wickDownColor: '#ef4444',
    })
    cs.setData(candles.map(c => ({
      time: c.date, open: c.open, high: c.high, low: c.low, close: c.close,
    })))

    const hasTov = candles.some(c => (c.turnover || 0) > 0)
    if (hasTov) {
      const hs = chart.addHistogramSeries({
        priceFormat:  { type: 'volume' },
        priceScaleId: 'vol',
      })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } })
      hs.setData(candles.map(c => ({
        time:  c.date,
        value: c.turnover || 0,
        color: c.close >= c.open ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      })))
    }

    // High/low markers — small circles, no text label.
    // The price card below the chart already shows H/L numerically.
    if (candles.length >= 2) {
      const hi  = candles.reduce((a, b) => b.high > a.high ? b : a)
      const lo  = candles.reduce((a, b) => b.low  < a.low  ? b : a)
      const mkrs = [{ time: hi.date, position: 'aboveBar', color: '#22c55e', shape: 'circle', size: 0.6 }]
      if (lo.date !== hi.date) mkrs.push({ time: lo.date, position: 'belowBar', color: '#ef4444', shape: 'circle', size: 0.6 })
      cs.setMarkers(mkrs.sort((a, b) => a.time.localeCompare(b.time)))
    }

    chart.timeScale().fitContent()
    cRef.current = chart

    const ro = new ResizeObserver(() => {
      if (ref.current && cRef.current) {
        cRef.current.applyOptions({ width: ref.current.clientWidth, height: ref.current.clientHeight })
        cRef.current.timeScale().fitContent()
      }
    })
    roRef.current = ro
    ro.observe(el)
    })
    return () => {
      cancelled = true
      roRef.current?.disconnect(); roRef.current = null
      cRef.current?.remove(); cRef.current = null
    }
  }, [candles, dark])

  // Single-day fallback — show OHLC summary instead of a degenerate chart
  if (singleDay) {
    const c    = singleDay
    const isUp = c.close >= c.open
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center gap-1.5 px-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {c.date} · single trading day
        </div>
        <div className={`text-[20px] font-black tabular-nums ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
          {c.close.toFixed(2)}
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-500 dark:text-gray-400">O <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums">{c.open.toFixed(2)}</span></span>
          <span className="text-emerald-500">H <span className="font-bold tabular-nums">{c.high.toFixed(2)}</span></span>
          <span className="text-red-500">L <span className="font-bold tabular-nums">{c.low.toFixed(2)}</span></span>
        </div>
      </div>
    )
  }

  return <div ref={ref} className="w-full h-full" />
}

// ─── Sector diverging bar ─────────────────────────────────────────────────────
function SectorBar({ name, ret, maxAbs }) {
  const color = sectorCol(ret)
  const w     = maxAbs > 0 ? Math.abs(ret ?? 0) / maxAbs * 48 : 0
  const isPos = (ret ?? 0) >= 0
  const short = name.replace(' Sub-Index','').replace(' Index','')
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 dark:text-gray-400 w-20 shrink-0 truncate">{short}</span>
      <div className="flex flex-1 items-center" style={{ height: 10 }}>
        <div className="flex-1 flex justify-end">
          {!isPos && <div className="h-2 rounded-l-sm" style={{ width: `${w}%`, background: color }} />}
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />
        <div className="flex-1 flex justify-start">
          {isPos && <div className="h-2 rounded-r-sm" style={{ width: `${w}%`, background: color }} />}
        </div>
      </div>
      <span className="text-[10px] font-bold w-11 text-right shrink-0" style={{ color }}>
        {fmtPct(ret)}
      </span>
    </div>
  )
}

// ─── Historical rank bar ──────────────────────────────────────────────────────
function HistoricalRank({ value, allYears, month }) {
  if (value == null || !allYears?.length) return null
  const hist = allYears
    .map(y => y.months[month - 1])
    .filter(v => v != null)
    .sort((a, b) => a - b)
  if (!hist.length) return null
  const rank  = hist.filter(v => v <= value).length
  const pct   = Math.round((rank / hist.length) * 100)
  const color = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444'
  const min   = hist[0]
  const max   = hist[hist.length - 1]
  const pos   = max !== min ? ((value - min) / (max - min)) * 100 : 50

  return (
    <div>
      <div className={`${LABEL} mb-1.5`}>Historical Rank ({MONTHS_FULL[month - 1]})</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
        Ranks <span className="font-bold" style={{ color }}>{rank}/{hist.length}</span>
        {' '}({pct}th pct) · better than {Math.max(0, rank - 1)} of {hist.length} past years
      </div>
      <div className="relative h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-visible mb-1">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pos}%`, background: color, opacity: 0.3 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm" style={{ left: `${pos}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{fmtPct(min)}</span>
        <span className="font-bold" style={{ color }}>{fmtPct(value)}</span>
        <span>{fmtPct(max)}</span>
      </div>
    </div>
  )
}

// ─── Stock Mini-Chart Popover — 60-day candles on stock click ────────────────
function StockMiniChartPopover({ symbol, anchorRect, onClose, dark }) {
  const [candles, setCandles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const chartHostRef = useRef(null)
  const cRef = useRef(null)

  useEffect(() => {
    if (!symbol) return
    const ctrl = new AbortController()
    setLoading(true); setCandles(null); setError(null)
    getStockChart({ symbol, timeframe: '3M' }, { signal: ctrl.signal })
      .then(r => { if (!ctrl.signal.aborted) setCandles(r.data?.candles || r.data || []) })
      .catch(err => { if (!ctrl.signal.aborted && !isCanceled(err)) setError('Failed to load chart') })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [symbol])

  // Close on Escape, click outside, or scroll OUTSIDE the popover
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    function onClick(e) {
      if (chartHostRef.current && !chartHostRef.current.contains(e.target)) onClose()
    }
    // Only dismiss when scroll happens outside the popover. lightweight-charts
    // can emit scroll events on its internal canvas during pan/zoom; without this
    // guard the popover would close itself when the user interacts with the chart.
    function onScroll(e) {
      if (chartHostRef.current && chartHostRef.current.contains(e.target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    window.addEventListener('scroll', onScroll, true)  // capture: catch scrollable ancestors
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  // Draw chart
  useEffect(() => {
    if (!candles?.length || !chartHostRef.current) return
    let cancelled = false
    loadLC().then(({ createChart }) => {
      if (cancelled || !chartHostRef.current) return
      const chart = createChart(chartHostRef.current, {
        width: chartHostRef.current.clientWidth || 360,
        height: 180,
        attributionLogo: false,
        layout: { background: { color: 'transparent' }, textColor: dark ? '#94a3b8' : '#64748b', fontSize: 9 },
        grid:   { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        rightPriceScale: { borderColor: dark ? '#334155' : '#e2e8f0' },
        timeScale: { borderColor: dark ? '#334155' : '#e2e8f0', timeVisible: false, tickMarkFormatter: () => '' },
        handleScroll: false, handleScale: false,
      })
      const cs = chart.addCandlestickSeries({
        upColor: '#22c55e', downColor: '#ef4444',
        borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      })
      cs.setData(candles.map(c => ({ time: c.date, open: +c.open, high: +c.high, low: +c.low, close: +c.close })))
      chart.timeScale().fitContent()
      cRef.current = chart
    })
    return () => { cancelled = true; cRef.current?.remove(); cRef.current = null }
  }, [candles, dark])

  // Fixed sidebar placement — anchored to the LEFT of the right-panel (which is on the
  // right of the screen). This way the popover stays visible even when the panel scrolls.
  if (!anchorRect) return null
  const POP_W = 380
  const POP_H = 240
  const margin = 12
  // Position to the LEFT of the right panel. The right panel starts at anchorRect.right's
  // owning panel's left edge — but we don't have that ref. Use the anchor row's left edge
  // (which equals the panel's left edge minus its padding) as the anchor.
  let left = Math.max(8, anchorRect.left - POP_W - margin)
  let top  = 72  // just below navbar (56px) + a margin
  // Clamp viewport bottom
  if (top + POP_H > window.innerHeight - 8) top = Math.max(64, window.innerHeight - POP_H - 8)

  const first = candles?.[0]?.close
  const last  = candles?.[candles.length - 1]?.close
  const change = first && last ? ((last - first) / first) * 100 : null
  const changeColor = change == null ? '#9ca3af' : change >= 0 ? '#22c55e' : '#ef4444'

  return createPortal(
    <div
      ref={chartHostRef}
      className="fixed z-[100] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{ left, top, width: POP_W, height: POP_H }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-black text-gray-800 dark:text-gray-100">{symbol}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest">3-Mo</span>
          {change != null && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: changeColor }}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
        </div>
        <button onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm leading-none">
          ×
        </button>
      </div>
      <div style={{ height: 180 }} className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400">{error}</div>
        )}
        {!loading && !error && !candles?.length && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">No data</div>
        )}
      </div>
    </div>,
    document.getElementById('portal-root') || document.body
  )
}

// ─── 3-month sparkline (sector momentum) ──────────────────────────────────────
function SectorMomentumSpark({ values, height = 16, width = 44 }) {
  const valid = (values || []).filter(v => v != null)
  if (valid.length < 2) {
    // Loading placeholder — pulse a thin horizontal line instead of a `—` glyph
    return (
      <div style={{ width, height }} className="flex items-center justify-center shrink-0">
        <div className="h-px w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
      </div>
    )
  }
  const min = Math.min(...valid, 0)
  const max = Math.max(...valid, 0)
  const range = (max - min) || 1
  const lastVal = values[values.length - 1]
  const stroke = lastVal == null ? '#9ca3af' : lastVal >= 0 ? '#22c55e' : '#ef4444'
  const pts = values
    .map((v, i) => v != null
      ? `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * height}`
      : null)
    .filter(Boolean)
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Sectors column — middle column of inspect overlay ───────────────────────
function SectorsColumn({ sectors, sectorHistory, activeSector, onSectorClick, year, month }) {
  const maxAbs = sectors?.length ? Math.max(...sectors.map(s => Math.abs(s.return_pct ?? 0)), 0.1) : 1
  const best   = sectors?.length ? sectors[0] : null
  const worst  = sectors?.length ? sectors[sectors.length - 1] : null

  if (!sectors?.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] text-gray-400">
        No sector data for {MONTHS_FULL[month - 1]} {year}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: best/worst chips */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-gray-100 dark:border-gray-800 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={LABEL}>Sectors · {sectors.length}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-500">click for stocks</span>
        </div>

        {best && worst && (
          <div className="flex gap-1.5">
            <button onClick={() => best.name && onSectorClick({ name: best.name, label: best.label })}
              className="flex-1 flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
              <div className="min-w-0 text-left">
                <div className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider leading-none">Top</div>
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 truncate leading-tight">
                  {(best.label || best.name || '').replace(' Sub-Index','').replace(' Index','')}
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-500 tabular-nums shrink-0">{fmtPct(best.return_pct)}</span>
            </button>
            <button onClick={() => worst.name && onSectorClick({ name: worst.name, label: worst.label })}
              className="flex-1 flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              <div className="min-w-0 text-left">
                <div className="text-[9px] text-red-400 font-bold uppercase tracking-wider leading-none">Bottom</div>
                <div className="text-[10px] font-bold text-red-700 dark:text-red-400 truncate leading-tight">
                  {(worst.label || worst.name || '').replace(' Sub-Index','').replace(' Index','')}
                </div>
              </div>
              <span className="text-[10px] font-black text-red-500 tabular-nums shrink-0">{fmtPct(worst.return_pct)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Sector list — all sectors, scrolls */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain bg-white dark:bg-gray-900 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
        {sectors.map((s, i) => {
          const isActive = activeSector?.name === s.name
          const isBest   = best && s.name === best.name
          const isWorst  = worst && s.name === worst.name
          const history  = sectorHistory?.[s.name] || []
          return (
            <button
              key={s.index_id}
              onClick={() => s.name && onSectorClick({ name: s.name, label: s.label })}
              disabled={!s.name}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-gray-50 dark:border-gray-800/40 transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500'
                  : i % 2 === 1
                    ? 'bg-gray-50/60 dark:bg-gray-800/30 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                    : 'bg-white dark:bg-gray-900 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
              } ${s.name ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <SectorBar name={s.label || s.name} ret={s.return_pct} maxAbs={maxAbs} />
              </div>
              <SectorMomentumSpark values={history} />
              {(isBest || isWorst) && (
                <span className={`text-[9px] font-black px-1 py-px rounded shrink-0 ${
                  isBest
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-500'
                }`}>{isBest ? 'TOP' : 'BOT'}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stocks column — right column of inspect overlay ─────────────────────────
function StocksColumn({ sector, year, month, dark, onStockClick, activeStockSymbol }) {
  const [stocks,  setStocks]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [query,   setQuery]   = useState('')
  const [sort,    setSort]    = useState('return')

  useEffect(() => {
    if (!sector?.name || !year || !month) { setStocks(null); return }
    const ctrl = new AbortController()
    setLoading(true); setStocks(null); setError(null); setQuery(''); setSort('return')
    getSectorMonthStocks({ sector_index: sector.name, year, month }, { signal: ctrl.signal })
      .then(r => { if (!ctrl.signal.aborted) setStocks(r.data?.stocks || []) })
      .catch(err => { if (!ctrl.signal.aborted && !isCanceled(err)) setError('Failed to load stocks') })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [sector?.name, year, month])

  const filtered = useMemo(() => {
    let list = stocks || []
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(s => s.symbol.toLowerCase().includes(q) || (s.company_name || '').toLowerCase().includes(q))
    }
    if (sort === 'symbol') list = [...list].sort((a, b) => a.symbol.localeCompare(b.symbol))
    return list
  }, [stocks, query, sort])

  const winners = (stocks || []).filter(s => (s.return_pct ?? 0) > 0).length
  const losers  = (stocks || []).filter(s => (s.return_pct ?? 0) < 0).length
  const maxAbs  = stocks?.length ? Math.max(...stocks.map(s => Math.abs(s.return_pct ?? 0)), 0.1) : 1
  const shortName = sector ? (sector.label || (sector.name ? sector.name.replace(' Sub-Index','').replace(' Index','') : '')) : ''

  if (!sector) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
        <svg className="w-10 h-10 text-gray-200 dark:text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <div className="text-[11px] text-gray-400 dark:text-gray-600">
          Click a sector to see<br />its stocks here
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
          Then click any stock for a<br />3-month price chart
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-gray-100 dark:border-gray-800 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className={LABEL}>Stocks · {shortName}</div>
            {stocks && (
              <div className="text-[10px] text-gray-400">
                {stocks.length} symbol{stocks.length !== 1 ? 's' : ''} · {MONTHS_FULL[month - 1]} {year}
              </div>
            )}
          </div>
          {stocks?.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                ▲ {winners}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-500">
                ▼ {losers}
              </span>
            </div>
          )}
        </div>

        {stocks?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Filter…"
                className="flex-1 bg-transparent text-[10px] font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none" />
              {query && <button onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500 text-[12px] leading-none">×</button>}
            </div>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded p-0.5">
              {[['return','%'],['symbol','A-Z']].map(([v, lbl]) => (
                <button key={v} onClick={() => setSort(v)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    sort === v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}>{lbl}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stock rows */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain bg-white dark:bg-gray-900 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <div className="px-3 py-3 text-[10px] text-red-400">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-[10px] text-gray-400">
            {query ? `No stocks match "${query}"` : 'No stock data for this period'}
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div>
            {filtered.map((s, i) => {
              const color  = sectorCol(s.return_pct)
              const barW   = maxAbs > 0 ? Math.abs(s.return_pct ?? 0) / maxAbs * 100 : 0
              const isPos  = (s.return_pct ?? 0) >= 0
              const isActive = activeStockSymbol === s.symbol
              return (
                <button
                  key={s.symbol}
                  onClick={e => onStockClick(s.symbol, e.currentTarget.getBoundingClientRect())}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 dark:border-gray-800/40 transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500'
                      : i % 2 === 1
                        ? 'bg-gray-50/60 dark:bg-gray-800/30 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                        : 'bg-white dark:bg-gray-900 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                  }`}
                >
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 w-5 shrink-0 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 w-20 shrink-0">
                    <div className="text-[10px] font-black text-gray-800 dark:text-gray-100 leading-tight truncate">{s.symbol}</div>
                    {s.company_name && (
                      <div className="text-[10px] text-gray-400 truncate leading-tight">{s.company_name}</div>
                    )}
                  </div>
                  <div className="flex flex-1 items-center min-w-0" style={{ height: 10 }}>
                    <div className="flex-1 flex justify-end">
                      {!isPos && <div className="h-2 rounded-l-sm" style={{ width: `${barW}%`, background: color }} />}
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />
                    <div className="flex-1 flex justify-start">
                      {isPos && <div className="h-2 rounded-r-sm" style={{ width: `${barW}%`, background: color }} />}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold tabular-nums w-14 text-right shrink-0" style={{ color }}>
                    {fmtPct(s.return_pct)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="shrink-0 px-3 py-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[10px] text-gray-500 dark:text-gray-500">Click any stock → 3-month chart</span>
      </div>
    </div>
  )
}

// ─── Chart column — left column of inspect overlay ───────────────────────────
function ChartStatsColumn({ cell, candles, stats, available, dark, allYears, loading, dataError }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (dataError) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <div className="text-[11px] text-red-400 font-medium">{dataError}</div>
      </div>
    )
  }
  if (!available) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <div className="text-3xl">📂</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
          Daily chart data is available from 2021 onward.<br />
          Heatmap value above is from historical records.
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Chart — generous height since it has full column width */}
      <div className="shrink-0 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 dark:border-gray-800/60">
          <span className={LABEL}>Daily Candles</span>
          {stats?.trading_days && (
            <span className="text-[10px] text-gray-400">{stats.trading_days} days</span>
          )}
        </div>
        <div style={{ height: 360 }}>
          {candles?.length
            ? <MonthChart candles={candles} dark={dark} />
            : <div className="h-full flex items-center justify-center text-[10px] text-gray-400">No candle data</div>}
        </div>
      </div>

      {/* OHLC 2×2 */}
      {stats && (
        <div className="shrink-0 p-3 border-b border-gray-100 dark:border-gray-800">
          <div className={`${LABEL} mb-1.5`}>OHLC</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['Open',  stats.month_open?.toFixed(1),  null],
              ['Close', stats.month_close?.toFixed(1), (stats.month_return ?? 0) >= 0 ? '#22c55e' : '#ef4444'],
              ['High',  stats.month_high?.toFixed(1),  '#22c55e'],
              ['Low',   stats.month_low?.toFixed(1),   '#ef4444'],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1.5">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">{l}</div>
                <div className="text-[13px] font-black tabular-nums" style={{ color: c || (dark ? '#e2e8f0' : '#1e293b') }}>
                  {v ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary 3-tile */}
      {stats && (
        <div className="shrink-0 px-3 pt-2 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ['Return', fmtPct(stats.month_return, 2), (stats.month_return ?? 0) >= 0 ? '#22c55e' : '#ef4444'],
              ['Range',  stats.range_pct != null ? fmtPct(stats.range_pct) : '—', null],
              ['Days',   stats.trading_days ?? '—', null],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5">
                <div className={LABEL}>{l}</div>
                <div className={SVAL} style={{ color: c || (dark ? '#e2e8f0' : '#1e293b') }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best/Worst day */}
      {stats && (stats.best_day || stats.worst_day) && (
        <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className={`${LABEL} mb-1.5`}>Day extremes</div>
          <div className="space-y-1">
            {stats.best_day && (
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500">Best</span>
                <span className="font-bold text-green-500 tabular-nums">{stats.best_day.date.slice(5)} · {fmtPct(stats.best_day.pct)}</span>
              </div>
            )}
            {stats.worst_day && (
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500">Worst</span>
                <span className="font-bold text-red-400 tabular-nums">{stats.worst_day.date.slice(5)} · {fmtPct(stats.worst_day.pct)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical Rank */}
      {cell.value != null && (
        <div className="shrink-0 px-3 py-2">
          <HistoricalRank value={cell.value} allYears={allYears} month={cell.month} />
        </div>
      )}
    </div>
  )
}

// ─── Inline Right Panel — compact, always open beside heatmap ────────────────
// Single scroll; sections stack vertically: header → chart → OHLC → stats → day extremes →
// historical rank → sectors. Click a sector → its stocks expand inline directly below
// (no separate drill view). Click stock → mini-chart popover.
function InlineRightPanel({
  cell, onClose, onNavigate, dark, allYears, indexId,
  onMaximize,
  // shared with InspectOverlay so the selection sticks across maximize / minimize:
  activeSector, setActiveSector,
}) {
  const [loading,    setLoading]    = useState(false)
  const [candles,    setCandles]    = useState(null)
  const [stats,      setStats]      = useState(null)
  const [sectors,    setSectors]    = useState(null)
  const [available,  setAvailable]  = useState(true)
  const [dataError,  setDataError]  = useState(null)
  const [stockPop,   setStockPop]   = useState(null) // { symbol, rect }
  const [sectorHistory, setSectorHistory] = useState({})

  // ── Fetch month detail + sectors ──
  useEffect(() => {
    if (!cell) return
    const ctrl = new AbortController()
    setLoading(true); setCandles(null); setStats(null); setSectors(null)
    setAvailable(true); setDataError(null); setStockPop(null); setSectorHistory({})

    Promise.all([
      getMonthDetail({ index_id: indexId, year: cell.year, month: cell.month }, { signal: ctrl.signal }),
      getSectorMonth({ year: cell.year, month: cell.month }, { signal: ctrl.signal }),
    ])
      .then(([det, sec]) => {
        if (ctrl.signal.aborted) return
        if (!det.data.available) { setAvailable(false); return }
        setCandles(det.data.candles || [])
        setStats(det.data.stats || null)
        setSectors(sec.data.sectors || [])
      })
      .catch(err => {
        if (ctrl.signal.aborted || isCanceled(err)) return
        setDataError(apiError(err, 'Failed to load data'))
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [cell?.year, cell?.month, indexId])

  // ── Sector momentum (last 3 months) ──
  useEffect(() => {
    if (!cell || !sectors?.length) return
    const ctrl = new AbortController()
    function priorMonth(y, m, back) {
      let mo = m - back, yr = y
      while (mo <= 0) { mo += 12; yr-- }
      return { year: yr, month: mo }
    }
    const p1 = priorMonth(cell.year, cell.month, 1)
    const p2 = priorMonth(cell.year, cell.month, 2)
    Promise.all([
      getSectorMonth({ year: p2.year, month: p2.month }, { signal: ctrl.signal }).catch(() => ({ data: { sectors: [] } })),
      getSectorMonth({ year: p1.year, month: p1.month }, { signal: ctrl.signal }).catch(() => ({ data: { sectors: [] } })),
    ]).then(([r2, r1]) => {
      if (ctrl.signal.aborted) return
      const h = {}
      sectors.forEach(s => {
        if (!s.name) return
        const v2 = r2.data?.sectors?.find(x => x.name === s.name)?.return_pct ?? null
        const v1 = r1.data?.sectors?.find(x => x.name === s.name)?.return_pct ?? null
        h[s.name] = [v2, v1, s.return_pct]
      })
      setSectorHistory(h)
    })
    return () => ctrl.abort()
  }, [cell?.year, cell?.month, sectors])

  if (!cell) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
        <svg className="w-10 h-10 text-gray-200 dark:text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.5} />
          <line x1="3" y1="9" x2="21" y2="9" strokeWidth={1.5} />
          <line x1="9" y1="21" x2="9" y2="9" strokeWidth={1.5} />
        </svg>
        <div className="text-[11px] text-gray-400 dark:text-gray-600">
          Click a heatmap cell to see<br />
          chart, sectors, and stocks
        </div>
      </div>
    )
  }

  const bg = cellBg(cell.value, dark)
  const fg = cellFg(cell.value, dark)
  const sectorMaxAbs = sectors?.length ? Math.max(...sectors.map(s => Math.abs(s.return_pct ?? 0)), 0.1) : 1
  const best  = sectors?.length ? sectors[0] : null
  const worst = sectors?.length ? sectors[sectors.length - 1] : null

  const filteredSectors = sectors || []

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-900 overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="w-4 h-4 rounded-sm shrink-0 border border-gray-200 dark:border-gray-700" style={{ background: bg }} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none">
            {MONTHS_FULL[cell.month - 1]} {cell.year}
          </div>
          <div className="text-lg font-black leading-tight" style={{ color: fg }}>
            {fmtPct(cell.value, 2)}
          </div>
        </div>
        {/* Tap targets: 28px on lg+ where the panel is fixed-width (space-constrained);
            44px below lg (mobile full-page detail) per WCAG 2.5.5. */}
        <button onClick={() => onNavigate(-1)} title="Previous month (←)" aria-label="Previous month"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-[14px] lg:text-[12px]">
          ‹
        </button>
        <button onClick={() => onNavigate(1)} title="Next month (→)" aria-label="Next month"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-[14px] lg:text-[12px]">
          ›
        </button>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />
        <button onClick={onMaximize} title="Maximize — full inspect view" aria-label="Maximize view"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
          <svg className="w-3.5 h-3.5 lg:w-3 lg:h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        <button onClick={onClose} title="Clear (Esc)" aria-label="Close detail panel"
          className="shrink-0 w-11 h-11 lg:w-7 lg:h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-[20px] lg:text-lg leading-none">
          ×
        </button>
      </div>

      {/* ── Body — single scroll on a subdued surface so cards pop.
          overscroll-contain prevents wheel-scroll leaks. Thin styled scrollbar
          makes the affordance visible (default browser hides until scroll). */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-950/70 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">

        {loading && (
          <div className="flex h-32 items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && dataError && (
          <div className="p-4 text-center text-[11px] text-red-400 font-medium">{dataError}</div>
        )}
        {!loading && !dataError && !available && (
          <div className="p-4 text-center">
            <div className="text-2xl mb-2">📂</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Daily chart data available from 2021 onward.<br />
              Heatmap value above is from historical records.
            </div>
          </div>
        )}

        {!loading && !dataError && available && (
          <div className="p-3 space-y-2.5">

            {/* Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800/80 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className={LABEL}>Daily Candles</span>
                {stats?.trading_days && <span className="text-[10px] text-gray-400">{stats.trading_days} days</span>}
              </div>
              <div style={{ height: 220 }}>
                {candles?.length
                  ? <MonthChart candles={candles} dark={dark} />
                  : <div className="h-full flex items-center justify-center text-[10px] text-gray-400">No candle data</div>}
              </div>
            </div>

            {/* Stat strip: O H L C Range Days */}
            {stats && (
              <div className="grid grid-cols-6 bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800/80 shadow-sm divide-x divide-gray-100 dark:divide-gray-800">
                {[
                  ['Open',  stats.month_open?.toFixed(1),  null],
                  ['High',  stats.month_high?.toFixed(1),  '#22c55e'],
                  ['Low',   stats.month_low?.toFixed(1),   '#ef4444'],
                  ['Close', stats.month_close?.toFixed(1), null],
                  ['Range', stats.range_pct != null ? fmtPct(stats.range_pct) : '—', null],
                  ['Days',  stats.trading_days ?? '—', null],
                ].map(([l, v, c]) => (
                  <div key={l} className="px-1.5 py-1.5 flex flex-col items-center justify-center">
                    <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider leading-none">{l}</div>
                    <div className="text-[10px] font-black tabular-nums leading-tight mt-0.5" style={{ color: c || (dark ? '#e2e8f0' : '#1e293b') }}>
                      {v ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Return tile + Best/Worst day */}
            {stats && (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                  <div className={LABEL}>Return</div>
                  <div className="text-[15px] font-black tabular-nums leading-tight mt-0.5" style={{ color: (stats.month_return ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                    {fmtPct(stats.month_return, 2)}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2 shadow-sm">
                  <div className={LABEL}>Day extremes</div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {stats.best_day && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">▲</span>
                        <span className="font-bold text-green-500 tabular-nums">{stats.best_day.date.slice(5)} {fmtPct(stats.best_day.pct)}</span>
                      </div>
                    )}
                    {stats.worst_day && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">▼</span>
                        <span className="font-bold text-red-400 tabular-nums">{stats.worst_day.date.slice(5)} {fmtPct(stats.worst_day.pct)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Historical Rank */}
            {cell.value != null && (
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 px-3 py-2.5 shadow-sm">
                <HistoricalRank value={cell.value} allYears={allYears} month={cell.month} />
              </div>
            )}

            {/* Sectors */}
            {sectors?.length > 0 && (
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 p-2.5 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={LABEL}>Sectors · {sectors.length}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">click to expand stocks</span>
                </div>

                <div className="rounded-lg overflow-hidden">
                  {filteredSectors.map((s, i) => {
                    const isActive = activeSector?.name === s.name
                    const isBest   = best  && s.name === best.name
                    const isWorst  = worst && s.name === worst.name
                    const history = sectorHistory[s.name] || []
                    return (
                      <div key={s.index_id}>
                        <button
                          onClick={() => s.name && setActiveSector(isActive ? null : { name: s.name, label: s.label })}
                          disabled={!s.name}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 border-b border-gray-50 dark:border-gray-800/40 transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-blue-500'
                              : i % 2 === 1
                                ? 'bg-gray-50/60 dark:bg-gray-800/30 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                                : 'bg-white dark:bg-gray-900 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                          } ${s.name ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
                        >
                          <div className="flex-1 min-w-0">
                            <SectorBar name={s.label || s.name} ret={s.return_pct} maxAbs={sectorMaxAbs} />
                          </div>
                          <SectorMomentumSpark values={history} width={44} />
                          {(isBest || isWorst) && (
                            <span className={`text-[9px] font-black px-1 py-px rounded shrink-0 ${
                              isBest
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-100 dark:bg-red-900/40 text-red-500'
                            }`}>{isBest ? 'TOP' : 'BOT'}</span>
                          )}
                        </button>
                        {/* Inline stocks panel right under selected sector */}
                        {isActive && s.name && (
                          <InlineSectorStocks
                            sectorIndex={s.name}
                            label={s.label}
                            year={cell.year}
                            month={cell.month}
                            onStockClick={(symbol, rect) => setStockPop({ symbol, rect })}
                            activeStockSymbol={stockPop?.symbol}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-1 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="text-[10px] text-gray-500 dark:text-gray-500">← → navigate · ⤢ maximize · Esc clear</span>
      </div>

      {/* Stock mini-chart popover */}
      {stockPop && (
        <StockMiniChartPopover
          symbol={stockPop.symbol}
          anchorRect={stockPop.rect}
          onClose={() => setStockPop(null)}
          dark={dark}
        />
      )}
    </div>
  )
}

// ─── Inline sector→stocks (used inside InlineRightPanel) ─────────────────────
// Module-level cache so collapsing + re-expanding a sector doesn't refetch.
// Keyed by `${sector}:${year}:${month}`. 10-minute TTL. LRU-capped (Rule 46).
const _SECTOR_STOCKS_TTL = 10 * 60 * 1000
const _SECTOR_STOCKS_MAX = 60
const _sectorStocksCache = new Map()

// True LRU: on hit, delete + re-set to promote to most-recent slot.
// Map preserves insertion order; oldest key is always .keys().next().value.
function _getSectorStocksCache(key) {
  const entry = _sectorStocksCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts >= _SECTOR_STOCKS_TTL) {
    _sectorStocksCache.delete(key)  // expired — drop it
    return null
  }
  // Promote: delete + reinsert moves to end of iteration order
  _sectorStocksCache.delete(key)
  _sectorStocksCache.set(key, entry)
  return entry
}

function _putSectorStocksCache(key, value) {
  if (_sectorStocksCache.has(key)) _sectorStocksCache.delete(key)
  else if (_sectorStocksCache.size >= _SECTOR_STOCKS_MAX) {
    const oldest = _sectorStocksCache.keys().next().value
    if (oldest !== undefined) _sectorStocksCache.delete(oldest)
  }
  _sectorStocksCache.set(key, value)
}

function InlineSectorStocks({ sectorIndex, label, year, month, onStockClick, activeStockSymbol }) {
  const cacheKey = `${sectorIndex}:${year}:${month}`
  const cached = _getSectorStocksCache(cacheKey)

  const [stocks,  setStocks]  = useState(cached ? cached.data : null)
  const [loading, setLoading] = useState(!cached)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!sectorIndex) return
    const key = `${sectorIndex}:${year}:${month}`
    const c   = _getSectorStocksCache(key)
    if (c) {
      setStocks(c.data); setLoading(false); setError(null)
      return
    }
    const ctrl = new AbortController()
    setLoading(true); setStocks(null); setError(null)
    getSectorMonthStocks({ sector_index: sectorIndex, year, month }, { signal: ctrl.signal })
      .then(r => {
        if (ctrl.signal.aborted) return
        const data = r.data?.stocks || []
        _putSectorStocksCache(key, { data, ts: Date.now() })
        setStocks(data)
      })
      .catch(err => { if (!ctrl.signal.aborted && !isCanceled(err)) setError('Failed to load stocks') })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [sectorIndex, year, month])

  const maxAbs = stocks?.length ? Math.max(...stocks.map(s => Math.abs(s.return_pct ?? 0)), 0.1) : 1

  return (
    <div className="bg-blue-50/30 dark:bg-blue-950/10 border-b border-blue-100 dark:border-blue-900/30">
      {loading && (
        <div className="flex items-center justify-center py-3">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && <div className="px-2 py-2 text-[10px] text-red-400">{error}</div>}
      {!loading && !error && stocks !== null && stocks.length === 0 && (
        <div className="px-2 py-2 text-[10px] text-gray-400">No stock data</div>
      )}
      {!loading && !error && stocks?.length > 0 && (
        <div className="max-h-56 overflow-y-auto overscroll-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
          {stocks.map((s, i) => {
            const color = sectorCol(s.return_pct)
            const barW  = maxAbs > 0 ? Math.abs(s.return_pct ?? 0) / maxAbs * 100 : 0
            const isPos = (s.return_pct ?? 0) >= 0
            const isActive = activeStockSymbol === s.symbol
            return (
              <button
                key={s.symbol}
                onClick={e => onStockClick(s.symbol, e.currentTarget.getBoundingClientRect())}
                className={`w-full text-left flex items-center gap-1.5 px-2 py-1 ${
                  isActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-blue-100/60 dark:hover:bg-blue-900/20'
                } transition-colors`}
              >
                <span className="text-[10px] text-gray-400 w-4 shrink-0 tabular-nums">{i + 1}</span>
                <span className="text-[10px] font-bold dark:text-gray-100 w-14 shrink-0 truncate">{s.symbol}</span>
                <div className="flex flex-1 items-center min-w-0" style={{ height: 8 }}>
                  <div className="flex-1 flex justify-end">
                    {!isPos && <div className="h-1.5 rounded-l-sm" style={{ width: `${barW}%`, background: color }} />}
                  </div>
                  <div className="w-px h-2 bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />
                  <div className="flex-1 flex justify-start">
                    {isPos && <div className="h-1.5 rounded-r-sm" style={{ width: `${barW}%`, background: color }} />}
                  </div>
                </div>
                <span className="text-[10px] font-bold tabular-nums w-11 text-right shrink-0" style={{ color }}>
                  {fmtPct(s.return_pct)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Inspect Overlay — full-page 3-column view (Chart · Sectors · Stocks) ────
function InspectOverlay({ cell, onClose, onNavigate, onJump, dark, allYears, indexId, onMinimize, activeSector, setActiveSector }) {
  const [loading,      setLoading]      = useState(false)
  const [candles,      setCandles]      = useState(null)
  const [stats,        setStats]        = useState(null)
  const [sectors,      setSectors]      = useState(null)
  const [available,    setAvailable]    = useState(true)
  const [dataError,    setDataError]    = useState(null)
  const [stockPop,     setStockPop]     = useState(null) // { symbol, rect }

  // Sector momentum: last 3 months of each sector (this month + 2 prior)
  // Stored as { [sectorName]: [ret1, ret2, ret3] }
  const [sectorHistory, setSectorHistory] = useState({})

  // Fetch month detail + this-month sectors
  useEffect(() => {
    if (!cell) return
    const ctrl = new AbortController()
    setLoading(true); setCandles(null); setStats(null); setSectors(null)
    setAvailable(true); setDataError(null); setStockPop(null)
    setSectorHistory({})

    Promise.all([
      getMonthDetail({ index_id: indexId, year: cell.year, month: cell.month }, { signal: ctrl.signal }),
      getSectorMonth({ year: cell.year, month: cell.month }, { signal: ctrl.signal }),
    ])
      .then(([det, sec]) => {
        if (ctrl.signal.aborted) return
        if (!det.data.available) { setAvailable(false); return }
        setCandles(det.data.candles || [])
        setStats(det.data.stats || null)
        setSectors(sec.data.sectors || [])
      })
      .catch(err => {
        if (ctrl.signal.aborted || isCanceled(err)) return
        setDataError(apiError(err, 'Failed to load data'))
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [cell?.year, cell?.month, indexId])

  // Fetch the 2 prior months' sector returns to build momentum sparkline
  useEffect(() => {
    if (!cell || !sectors?.length) return
    const ctrl = new AbortController()

    function priorMonth(y, m, back) {
      let mo = m - back
      let yr = y
      while (mo <= 0) { mo += 12; yr-- }
      return { year: yr, month: mo }
    }
    const p1 = priorMonth(cell.year, cell.month, 1)
    const p2 = priorMonth(cell.year, cell.month, 2)

    Promise.all([
      getSectorMonth({ year: p2.year, month: p2.month }, { signal: ctrl.signal }).catch(() => ({ data: { sectors: [] } })),
      getSectorMonth({ year: p1.year, month: p1.month }, { signal: ctrl.signal }).catch(() => ({ data: { sectors: [] } })),
    ])
      .then(([r2, r1]) => {
        if (ctrl.signal.aborted) return
        const h = {}
        sectors.forEach(s => {
          if (!s.name) return
          const v2 = r2.data?.sectors?.find(x => x.name === s.name)?.return_pct ?? null
          const v1 = r1.data?.sectors?.find(x => x.name === s.name)?.return_pct ?? null
          h[s.name] = [v2, v1, s.return_pct]
        })
        setSectorHistory(h)
      })
    return () => ctrl.abort()
  }, [cell?.year, cell?.month, sectors])

  // Keyboard: Esc closes, ← → navigate months
  useEffect(() => {
    function onKey(e) {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      if (e.key === 'Escape')     { e.preventDefault(); onClose() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); onNavigate(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNavigate(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNavigate])

  if (!cell) return null

  const bg = cellBg(cell.value, dark)
  const fg = cellFg(cell.value, dark)

  return (
    <div className="fixed inset-x-0 top-[56px] bottom-0 z-40 bg-white dark:bg-gray-950 flex flex-col">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="w-3 h-3 rounded shrink-0" style={{ background: bg }} />
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
            {MONTHS_FULL[cell.month - 1]} {cell.year}
          </div>
          <div className="text-2xl font-black leading-tight" style={{ color: fg }}>
            {fmtPct(cell.value, 2)}
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={() => onNavigate(-1)} title="Previous month (←)"
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          ← Prev
        </button>
        <button onClick={() => onNavigate(1)} title="Next month (→)"
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Next →
        </button>
        <button onClick={onMinimize} title="Minimize back to side panel"
          className="ml-1 flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          Minimize
        </button>
        <button onClick={onClose} title="Close (Esc)"
          className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-lg leading-none transition-colors">
          ×
        </button>
      </div>

      {/* ── Year + Month jumper strip ── */}
      {onJump && allYears?.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">Year</span>
          <div className="flex items-center gap-1 shrink-0">
            {[...allYears].sort((a, b) => b.year - a.year).map(y => (
              <button key={y.year}
                onClick={() => {
                  // Try same month in the target year, fallback to latest with data
                  const target = y.months[cell.month - 1] != null ? cell.month
                               : ([...y.months].reverse().findIndex(v => v != null) >= 0
                                    ? 12 - [...y.months].reverse().findIndex(v => v != null)
                                    : 1)
                  onJump(y.year, target)
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                  cell.year === y.year
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                }`}>{y.year}</button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 shrink-0">Month</span>
          <div className="flex items-center gap-0.5 shrink-0">
            {MONTHS_EN.map((m, i) => {
              const yr = allYears.find(y => y.year === cell.year)
              const val = yr?.months?.[i]
              const disabled = val == null
              return (
                <button key={i}
                  onClick={() => !disabled && onJump(cell.year, i + 1)}
                  disabled={disabled}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                    cell.month === i + 1
                      ? 'bg-blue-600 text-white'
                      : disabled
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                  }`}>{m}</button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 3-column body ── */}
      <div className="flex-1 flex min-h-0">

        {/* Column 1 — Chart + stats (35%) */}
        <div className="w-[35%] min-w-[340px] border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-0">
          <ChartStatsColumn
            cell={cell} candles={candles} stats={stats}
            available={available} dark={dark} allYears={allYears}
            loading={loading} dataError={dataError}
          />
        </div>

        {/* Column 2 — Sectors (35%) */}
        <div className="w-[35%] min-w-[300px] border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-0">
          {!loading && !dataError && available && (
            <SectorsColumn
              sectors={sectors}
              sectorHistory={sectorHistory}
              activeSector={activeSector}
              onSectorClick={s => { setActiveSector(s); setStockPop(null) }}
              year={cell.year}
              month={cell.month}
            />
          )}
        </div>

        {/* Column 3 — Stocks (30%) */}
        <div className="flex-1 min-w-[280px] bg-white dark:bg-gray-900 flex flex-col min-h-0">
          {!loading && !dataError && available && (
            <StocksColumn
              sector={activeSector}
              year={cell.year}
              month={cell.month}
              dark={dark}
              activeStockSymbol={stockPop?.symbol}
              onStockClick={(symbol, rect) => setStockPop({ symbol, rect })}
            />
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="text-[10px] text-gray-500 dark:text-gray-500">
          ← → navigate months · Esc close · click sector → stocks · click stock → 3-mo chart
        </span>
      </div>

      {/* Stock mini-chart popover */}
      {stockPop && (
        <StockMiniChartPopover
          symbol={stockPop.symbol}
          anchorRect={stockPop.rect}
          onClose={() => setStockPop(null)}
          dark={dark}
        />
      )}
    </div>
  )
}


// ─── Annual bar ────────────────────────────────────────────────────────────────
function AnnualBar({ year, annual, isRecent, isLatest }) {
  const maxVal  = 80
  const clamped = Math.min(Math.max(annual ?? 0, -maxVal), maxVal)
  const w       = Math.abs(clamped) / maxVal * 100
  const isPos   = (annual ?? 0) >= 0
  const color   = isPos
    ? (isLatest ? '#22c55e' : isRecent ? '#4ade80' : '#86efac')
    : (isLatest ? '#ef4444' : isRecent ? '#f87171' : '#fca5a5')
  const opacity = isLatest ? 1 : isRecent ? 0.9 : 0.65
  return (
    <div className="flex items-center gap-1.5" style={{ opacity }}>
      <span className={`text-[10px] font-bold w-8 shrink-0 text-right ${
        isLatest ? 'text-blue-500' : isRecent ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>
        {year}
      </span>
      <div className="flex-1 flex items-center h-3.5 relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
        {isPos
          ? <div className="absolute left-1/2 h-2 rounded-r-sm" style={{ width: `${w / 2}%`, background: color }} />
          : <div className="absolute right-1/2 h-2 rounded-l-sm" style={{ width: `${w / 2}%`, background: color }} />
        }
      </div>
      <span className="text-[10px] font-bold w-11 text-right shrink-0" style={{ color }}>
        {fmtPct(annual)}
      </span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InsightPage() {
  const { isDark: dark } = useTheme()
  const [data,            setData]            = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [selected,        setSelected]        = useState(null)
  const [selectedIndexId, setSelectedIndexId] = useState(12)
  const [yearFilter,      setYearFilter]      = useState('all')
  const [mobileLeftOpen,  setMobileLeftOpen]  = useState(false)
  const [maximized,       setMaximized]       = useState(false)
  const [activeSector,    setActiveSector]    = useState(null) // shared between InlineRightPanel & InspectOverlay

  const doFetch = useCallback(async (indexId) => {
    setLoading(true); setError('')
    // Don't blank data/selected on refresh — keep the panel visible while we refetch.
    try {
      const r = await getMonthlyReturns({ index_id: indexId })
      setData(r.data)
      // Auto-select the latest month only if nothing is currently selected,
      // or if the previously-selected month no longer exists in the new data.
      setSelected(prev => {
        if (prev) {
          const row = r.data?.years?.find(y => y.year === prev.year)
          const val = row?.months?.[prev.month - 1]
          if (val != null) return { ...prev, value: val }  // refresh the value
        }
        if (r.data?.latest_data_date && r.data?.years?.length) {
          const dt  = new Date(r.data.latest_data_date)
          const yr  = dt.getFullYear()
          const mo  = dt.getMonth() + 1
          const row = r.data.years.find(y => y.year === yr)
          const val = row?.months?.[mo - 1] ?? null
          return { year: yr, month: mo, value: val }
        }
        return null
      })
    } catch (err) {
      if (isCanceled(err)) return
      setError(apiError(err, 'Failed to load data. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset selection when the user switches index (different dataset)
  const prevIndexRef = useRef(selectedIndexId)
  useEffect(() => {
    if (prevIndexRef.current !== selectedIndexId) {
      setSelected(null)
      setActiveSector(null)
      prevIndexRef.current = selectedIndexId
    }
    doFetch(selectedIndexId)
  }, [selectedIndexId, doFetch])

  const allYears   = data?.years || []
  const latestDate = data?.latest_data_date || null
  const latestDt   = latestDate ? new Date(latestDate) : new Date()
  const curYear    = latestDt.getFullYear()
  const curMon     = latestDt.getMonth() + 1

  const years = useMemo(() => allYears.filter(y => {
    if (yearFilter === '5')  return y.year >= curYear - 4
    if (yearFilter === '10') return y.year >= curYear - 9
    return true
  }), [allYears, yearFilter, curYear])

  const recentSet = useMemo(() => new Set(allYears.slice(0, RECENT_N).map(y => y.year)), [allYears])
  const wAvg      = useMemo(() => years.length ? weightedAvg(years)     : (data?.month_averages  || []), [years, data])
  const wWinRate  = useMemo(() => years.length ? weightedWinRate(years) : (data?.month_win_rates || []), [years, data])
  const wStdDev   = useMemo(() => years.length ? monthStdDev(years)     : [], [years])

  const LABELS = MONTHS_EN
  const curRow = allYears.find(y => y.year === curYear)
  const prevRow = allYears.find(y => y.year === curYear - 1)

  const handleCell = useCallback((year, month, value) => {
    setSelected({ year, month, value })
    setActiveSector(null)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelected(null)
    setActiveSector(null)
    setMaximized(false)
  }, [])

  const handleNavigate = useCallback((dir) => {
    if (!selected || !allYears.length) return
    let { year, month } = selected
    month += dir
    if (month < 1)  { month = 12; year-- }
    if (month > 12) { month = 1;  year++ }
    const row = allYears.find(y => y.year === year)
    if (!row) return
    const value = row.months[month - 1] ?? null
    setSelected({ year, month, value })
    setActiveSector(null)
  }, [selected, allYears])

  const handleJump = useCallback((year, month) => {
    if (!allYears.length) return
    const row = allYears.find(y => y.year === year)
    if (!row) return
    const value = row.months[month - 1] ?? null
    setSelected({ year, month, value })
    setActiveSector(null)
  }, [allYears])

  // Stable callback for the mobile index sheet: select index + close the sheet.
  // Pre-extracted so it doesn't break LeftInsightPanel's memo with an inline fn.
  const handleMobileIndexSelect = useCallback((id) => {
    setSelectedIndexId(id)
    setMobileLeftOpen(false)
  }, [])

  // Global keyboard nav for the inline right panel (overlay has its own when maximized).
  useEffect(() => {
    if (maximized) return  // overlay owns the keys
    const h = e => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); handleNavigate(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNavigate(1) }
      if (e.key === 'Escape')     { e.preventDefault(); handleCloseDetail() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleNavigate, handleCloseDetail, maximized])

  const annualRows = years.filter(y => y.annual != null)

  // Inject controls into DataLab tab bar
  const toolbar = useToolbarSlot(
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
      {/* Mobile: index trigger */}
      <button
        className="md:hidden flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
        onClick={() => setMobileLeftOpen(true)}
      >
        {INDEX_OPTIONS.find(o => o.id === selectedIndexId)?.label ?? 'Index'}
        <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <polyline points="6 4 10 8 6 12" />
        </svg>
      </button>

      <span className={`${LABEL} normal-case hidden sm:inline`}>
        {INDEX_OPTIONS.find(o => o.id === selectedIndexId)?.label}
      </span>
      {latestDate && (
        <span className={`${LABEL} normal-case text-gray-300 dark:text-gray-700 hidden sm:inline`}>· {latestDate}</span>
      )}

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0 hidden sm:block" />

      {/* Year filter */}
      <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-700 text-[10px] font-bold">
        {[['all','All'],['10','10yr'],['5','5yr']].map(([v, lbl]) => (
          <button key={v} onClick={() => setYearFilter(v)}
            className={`px-1.5 py-0.5 transition-colors ${
              yearFilter === v
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {lbl}
          </button>
        ))}
      </div>

      <button onClick={() => doFetch(selectedIndexId)} disabled={loading}
        className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors text-[10px]">
        {loading ? '·' : '↻'}
      </button>
    </div>
  )

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 bg-gray-50 dark:bg-gray-950">
      {toolbar}

      {/* ── Left Panel — desktop only ─────────────────────────────────────── */}
      <div className="hidden md:flex w-[200px] min-w-[180px] border-r border-gray-100 dark:border-gray-800
        bg-white dark:bg-gray-900 flex-col shrink-0 overflow-hidden relative">
        {loading && !data ? (
          <div className="flex-1"><Skeleton /></div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
            <div>
              <div className="text-red-400 text-xs mb-2">{error}</div>
              <button onClick={() => doFetch(selectedIndexId)}
                className="text-[10px] text-blue-500 underline">Retry</button>
            </div>
          </div>
        ) : (
          <>
          {loading && data && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-6 pointer-events-none">
              <div className="flex items-center gap-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm
                              px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="w-3 h-3 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Updating…</span>
              </div>
            </div>
          )}
          <LeftInsightPanel
            data={data}
            wAvg={wAvg}
            wWinRate={wWinRate}
            LABELS={LABELS}
            selectedIndexId={selectedIndexId}
            setSelectedIndexId={setSelectedIndexId}
          />
          </>
        )}
      </div>

      {/* ── Center — Heatmap + Annual strip ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50/40 dark:bg-gray-900/40">

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 relative bg-gray-50/40 dark:bg-gray-900/40 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* Heatmap card: fills the column width so there's no empty band on the
              right of the heatmap. minWidth keeps it readable when the column is narrow
              (outer overflow-x-auto provides horizontal scroll in that case). */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800/80 p-3" style={{ minWidth: 520, width: '100%' }}>

            {loading && !data && <Skeleton />}

            {/* Heatmap.
                NOTE: `border-separate` + `border-spacing-0` is required for `position: sticky`
                to work on <th>/<td> in iOS Safari (< 16). The `translate-x-0` on sticky cells
                forces compositor layout — a known fix for iOS sticky-cell rendering glitches.
                The outer column's overflow-x-auto handles horizontal scroll when the table
                is wider than the column. */}
            {data && (
              <div>
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="text-left pb-1.5 pr-2 sticky left-0 z-20 bg-white dark:bg-gray-900 translate-x-0
                        text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">
                        Year
                      </th>
                      {LABELS.map((m, i) => (
                        <th key={i} className="pb-1.5 text-center text-[10px] font-bold
                          text-gray-500 dark:text-gray-400 uppercase tracking-wide px-px min-w-[36px]">
                          {m}
                        </th>
                      ))}
                      <th className="pb-1.5 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-2 pr-1 min-w-[44px] border-l-2 border-gray-200 dark:border-gray-700">
                        YTD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((row) => {
                      const isRecent = recentSet.has(row.year)
                      const isLatest = row.year === curYear
                      const opacity  = isRecent ? 1.0 : 0.78
                      return (
                        <tr key={row.year}
                          style={{ opacity }}
                          className="hover:opacity-100 focus-within:!opacity-100 transition-opacity duration-150">
                          <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-900 translate-x-0">
                            <div className="flex items-center gap-1">
                              {isLatest ? (
                                <span className="text-[11px] font-black text-blue-500 leading-none">{row.year}</span>
                              ) : isRecent ? (
                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 leading-none">{row.year}</span>
                              ) : (
                                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 leading-none">{row.year}</span>
                              )}
                              {isLatest && <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />}
                            </div>
                          </td>
                          {row.months.map((val, mi) => {
                            const isCur = row.year === curYear && mi + 1 === curMon
                            const isSel = selected?.year === row.year && selected?.month === mi + 1
                            const isDisabled = val == null
                            return (
                              <td key={mi} className="py-0.5 px-px">
                                <button
                                  onClick={() => handleCell(row.year, mi + 1, val)}
                                  disabled={isDisabled}
                                  // tabIndex={-1} keeps disabled cells out of the keyboard tab order
                                  // (browser still allows focus on disabled <button> via clicks/scripts,
                                  // but Tab navigation should skip dead cells).
                                  tabIndex={isDisabled ? -1 : 0}
                                  aria-label={val != null
                                    ? `${LABELS[mi]} ${row.year} return ${fmtPct(val)}`
                                    : `${LABELS[mi]} ${row.year} no data`}
                                  className={[
                                    'w-full rounded text-[10px] font-bold select-none transition-all duration-100 leading-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none',
                                    !isDisabled ? 'cursor-pointer hover:scale-105 hover:shadow-sm' : 'cursor-default opacity-20',
                                    // Selection (user-clicked) takes visual priority over "current month" — once
                                    // selected, that ring IS the indicator. Avoids stacking blue ring + blue outline
                                    // on the same cell when the user clicks today's month.
                                    isSel ? 'scale-105 shadow-md ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950 z-10' : '',
                                  ].join(' ')}
                                  style={{
                                    background:    cellBg(val, dark),
                                    color:         cellFg(val, dark),
                                    padding:       '3px 1px',
                                    minWidth:      36,
                                    // "Today" outline shows only when NOT selected — selection ring is
                                    // the relevant state once user interacts.
                                    outline:       isCur && !isSel ? '1.5px dashed #60a5fa' : undefined,
                                    outlineOffset: isCur && !isSel ? '1px' : undefined,
                                  }}>
                                  {val != null ? fmtPct(val) : '·'}
                                </button>
                              </td>
                            )
                          })}
                          {/* YTD column */}
                          <td className="py-0.5 pl-2 pr-1 border-l-2 border-gray-200 dark:border-gray-700">
                            <div className="text-right text-[10px] font-black tabular-nums"
                              style={{ color: (row.annual ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                              {row.annual != null ? fmtPct(row.annual) : '—'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Weighted Avg row */}
                    {wAvg.some(v => v != null) && (
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                        <td className="py-1 pr-2 sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 translate-x-0">
                          <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">Wtd Avg</span>
                        </td>
                        {wAvg.map((v, i) => (
                          <td key={i} className="py-0.5 px-px">
                            <div className="w-full rounded text-center text-[10px] font-black tabular-nums"
                              style={{ background: cellBg(v, dark), color: cellFg(v, dark), padding: '2px 1px', minWidth: 36 }}>
                              {v != null ? fmtPct(v) : '—'}
                            </div>
                          </td>
                        ))}
                        <td className="border-l-2 border-gray-200 dark:border-gray-700" />
                      </tr>
                    )}

                    {/* Win rate row */}
                    {wWinRate.some(v => v != null) && (
                      <tr>
                        <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-900 translate-x-0">
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wide">Win%</span>
                        </td>
                        {wWinRate.map((v, i) => {
                          const color = v >= 60 ? '#22c55e' : v >= 45 ? '#f59e0b' : '#ef4444'
                          const bg    = v >= 60
                            ? (dark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.10)')
                            : v >= 45
                              ? (dark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.10)')
                              : (dark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.10)')
                          return (
                            <td key={i} className="py-0.5 px-px">
                              <div className="w-full rounded text-center text-[10px] font-black"
                                style={{ background: bg, color, padding: '2px 1px' }}>
                                {v != null ? v + '%' : '—'}
                              </div>
                            </td>
                          )
                        })}
                        <td />
                      </tr>
                    )}

                    {/* Volatility (σ) row */}
                    {wStdDev.some(v => v != null) && (
                      <tr>
                        <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-900 translate-x-0">
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wide" title="Standard deviation">σ</span>
                        </td>
                        {wStdDev.map((v, i) => (
                          <td key={i} className="py-0.5 px-px">
                            <div className="w-full text-center text-[10px] font-bold tabular-nums text-gray-500 dark:text-gray-400"
                              style={{ padding: '2px 1px' }}>
                              {v != null ? v.toFixed(1) : '—'}
                            </div>
                          </td>
                        ))}
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-1.5 mb-3 text-[10px] text-gray-500 dark:text-gray-500 px-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
                    <span className="text-blue-400 font-bold">{curYear}</span> = live
                  </span>
                  <span>YTD = annual return</span>
                  <span>σ = monthly volatility</span>
                  <span className="ml-auto text-gray-500 dark:text-gray-500">click cell for detail</span>
                </div>
              </div>
            )}

            {/* Annual performance strip */}
            {data && !loading && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <span className="text-[10px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2">Annual Performance</span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800/60">
                  <div className="text-[10px] text-gray-400 dark:text-gray-600 mb-2">
                    Brighter = more recent · dimmed = historical
                  </div>
                  <div className="space-y-px">
                    {annualRows.map(row => (
                      <AnnualBar
                        key={row.year}
                        year={row.year}
                        annual={row.annual}
                        isRecent={recentSet.has(row.year)}
                        isLatest={row.year === curYear}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Inline right panel — always open on desktop ── */}
      <div className="hidden lg:flex w-[420px] min-w-[380px] shrink-0 border-l border-gray-100 dark:border-gray-800 flex-col min-h-0 bg-white dark:bg-gray-900">
        <InlineRightPanel
          cell={selected}
          onClose={handleCloseDetail}
          onNavigate={handleNavigate}
          onMaximize={() => setMaximized(true)}
          dark={dark}
          allYears={allYears}
          indexId={selectedIndexId}
          activeSector={activeSector}
          setActiveSector={setActiveSector}
        />
      </div>

      {/* Mobile: full-page detail when a cell is selected */}
      {selected && (
        <div className="lg:hidden fixed inset-x-0 top-[56px] bottom-0 z-40 bg-white dark:bg-gray-950 flex flex-col">
          <InlineRightPanel
            cell={selected}
            onClose={handleCloseDetail}
            onNavigate={handleNavigate}
            onMaximize={() => setMaximized(true)}
            dark={dark}
            allYears={allYears}
            indexId={selectedIndexId}
            activeSector={activeSector}
            setActiveSector={setActiveSector}
          />
        </div>
      )}

      {/* ── Maximized overlay — 3-column full-page inspect ── */}
      {maximized && selected && (
        <InspectOverlay
          cell={selected}
          onClose={handleCloseDetail}
          onNavigate={handleNavigate}
          onJump={handleJump}
          onMinimize={() => setMaximized(false)}
          dark={dark}
          allYears={allYears}
          indexId={selectedIndexId}
          activeSector={activeSector}
          setActiveSector={setActiveSector}
        />
      )}

      {/* Mobile left panel sheet */}
      {mobileLeftOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
               onClick={() => setMobileLeftOpen(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
                          bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t
                          border-gray-200 dark:border-gray-800"
               style={{ height: '70vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="shrink-0 flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Select Index</span>
              <button onClick={() => setMobileLeftOpen(false)}
                aria-label="Close index sheet"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[14px]">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-900">
              <LeftInsightPanel
                data={data} wAvg={wAvg} wWinRate={wWinRate}
                LABELS={LABELS}
                selectedIndexId={selectedIndexId}
                setSelectedIndexId={handleMobileIndexSelect}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
