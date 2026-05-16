import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getPerformance } from '../../api'
import { getMarketSymbols, gCache, TTL as CACHE_TTL } from '../../utils/globalCache'

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_VER = 'v3'
const _cache    = {}
const PERF_TTL  = 60 * 60_000
const fresh     = ts => ts && Date.now() - ts < PERF_TTL

// ── Constants ─────────────────────────────────────────────────────────────────
const THRESHOLDS = [5, 10, 15, 20]
const NEPSE_C    = '#3b82f6'
const STOCK_C    = '#f59e0b'
const UP         = '#10b981'
const DOWN       = '#ef4444'

async function loadLC() { return import('lightweight-charts') }

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(a, b)      { return (!a || !b) ? null : ((b - a) / a) * 100 }
function fmtPct(n, dec = 1) {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(dec)}%`
}
function fmtDays(from, to) {
  const d = Math.round((new Date(to) - new Date(from)) / 86400000)
  return d >= 365 ? `${(d / 365).toFixed(1)}y` : `${d}d`
}
function fmtMonth(date) {
  const [y, m] = date.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[+m - 1]}'${y.slice(2)}`
}
function slice(arr, from, to) {
  if (!arr?.length) return []
  return arr.filter(d => d.date >= from && d.date <= to)
}
function stats(nSlice, sSlice) {
  const nRet  = pct(nSlice[0]?.close, nSlice[nSlice.length - 1]?.close)
  const sRet  = pct(sSlice[0]?.close, sSlice[sSlice.length - 1]?.close)
  const alpha = (nRet != null && sRet != null) ? sRet - nRet : null
  let maxDD   = null
  if (sSlice.length > 1) {
    let peak = sSlice[0].close, dd = 0
    for (const d of sSlice) {
      if (d.close > peak) peak = d.close
      const cur = ((d.close - peak) / peak) * 100
      if (cur < dd) dd = cur
    }
    maxDD = dd
  }
  return { nRet, sRet, alpha, maxDD }
}
function nameSwings(raw) {
  let b = 1, be = 1
  return raw.map((s, i) => ({
    ...s, id: i,
    name: s.type === 'bull' ? `Bull ${b++}` : `Bear ${be++}`,
  }))
}

// ── Symbol Search ─────────────────────────────────────────────────────────────
function SymbolSearch({ value, onChange }) {
  const [q,      setQ]      = useState(value || '')
  const [open,   setOpen]   = useState(false)
  const [items,  setItems]  = useState([])
  const [cursor, setCursor] = useState(-1)
  const ml   = useRef(false)
  const list = useRef(null)

  useEffect(() => {
    getMarketSymbols().then(r => {
      setItems(r.data.stocks || [])
    }).catch(() => {})
  }, [])

  const lq  = q.toLowerCase()
  const flt = q.length < 1
    ? items.slice(0, 20)
    : items.filter(s => s.symbol.toLowerCase().includes(lq) ||
        (s.company_name && s.company_name.toLowerCase().includes(lq))).slice(0, 30)

  function pick(s) { setQ(s.symbol); setOpen(false); setCursor(-1); onChange(s.symbol, s.company_name || null) }
  function onKey(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flt.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && cursor >= 0) pick(flt[cursor])
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }
  useEffect(() => {
    if (cursor >= 0 && list.current) list.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 w-[160px] sm:w-[200px]">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!ml.current) setOpen(false) }}
          onKeyDown={onKey}
          placeholder="Search symbol…"
          className="bg-transparent text-sm font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none w-full"
        />
        {q && <button onClick={() => { setQ(''); onChange('', null) }}
          className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>}
      </div>
      {open && flt.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          <ul ref={list}>
            {flt.map((s, i) => (
              <li key={s.symbol}
                onMouseDown={() => { ml.current = true; pick(s); ml.current = false }}
                className={`px-3 py-2 cursor-pointer ${i === cursor ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{s.symbol}</div>
                {s.company_name && <div className="text-xs text-gray-400 truncate">{s.company_name}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Inline candlestick chart — exposes chart instance via ref for cursor sync ──
const MiniCandle = forwardRef(function MiniCandle({ data, height = 360 }, fwdRef) {
  const { isDark } = useTheme()
  const domRef  = useRef(null)
  const chartR  = useRef(null)
  const seriesR = useRef(null)

  // Expose chart instance to parent for crosshair sync
  useImperativeHandle(fwdRef, () => ({
    getChart:  () => chartR.current,
    getSeries: () => seriesR.current,
  }), [])

  useEffect(() => {
    if (!domRef.current || !height) return
    let cancelled = false

    if (chartR.current) {
      try { chartR.current._ro?.disconnect(); chartR.current.remove() } catch (_) {}
      chartR.current = null; seriesR.current = null
    }

    const bg = isDark ? '#0a0f1a' : '#f8fafc'
    const tx = isDark ? '#64748b' : '#94a3b8'
    const br = isDark ? '#1e293b' : '#e2e8f0'
    const w  = domRef.current.clientWidth || 400

    loadLC().then(({ createChart }) => {
      if (cancelled || !domRef.current) return

      const chart = createChart(domRef.current, {
        width: w, height,
        attributionLogo: false,
        layout:    { background: { color: bg }, textColor: tx, fontSize: 10 },
        grid:      { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        crosshair: {
          mode: 1,
          vertLine: { color: isDark ? '#475569' : '#94a3b8', width: 1, style: 3, labelVisible: true },
          horzLine: { color: isDark ? '#475569' : '#94a3b8', width: 1, style: 3, labelVisible: true },
        },
        rightPriceScale: { borderColor: br, scaleMargins: { top: 0.08, bottom: 0.08 } },
        timeScale: { borderColor: br, timeVisible: true, barSpacing: 8, minBarSpacing: 3 },
        handleScroll: true,
        handleScale:  true,
      })
      chartR.current = chart

      if (data?.length) {
        const s = chart.addCandlestickSeries({
          upColor: UP, downColor: DOWN,
          borderUpColor: UP, borderDownColor: DOWN,
          wickUpColor: UP + 'cc', wickDownColor: DOWN + 'cc',
          priceLineVisible: false,
        })
        s.setData(data.map(d => ({ time: d.date, open: +d.open, high: +d.high, low: +d.low, close: +d.close })))
        seriesR.current = s
        chart.timeScale().fitContent()
      }

      if (cancelled || !domRef.current) return
      const ro = new ResizeObserver(() => {
        if (domRef.current && chartR.current) chartR.current.applyOptions({ width: domRef.current.clientWidth })
      })
      ro.observe(domRef.current)
      chart._ro = ro
    })

    return () => {
      cancelled = true
      if (chartR.current) {
        try { chartR.current._ro?.disconnect(); chartR.current.remove() } catch (_) {}
        chartR.current = null; seriesR.current = null
      }
    }
  }, [data, isDark, height]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full" style={{ height }}>
      {!data?.length && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 dark:text-gray-700">
          No data
        </div>
      )}
      <div ref={domRef} style={{ width: '100%', height }} />
    </div>
  )
})

// ── Sparkline (tiny inline chart for the table) ───────────────────────────────
function Sparkline({ data, color, width = 80, height = 32 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !data?.length) return
    canvas.width  = width * 2   // retina
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
    ctx.clearRect(0, 0, width, height)

    const closes = data.map(d => d.close)
    const min    = Math.min(...closes)
    const max    = Math.max(...closes)
    const range  = max - min || 1
    const pad    = 3

    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.5
    ctx.lineJoin    = 'round'
    closes.forEach((v, i) => {
      const x = pad + (i / (closes.length - 1)) * (width - pad * 2)
      const y = height - pad - ((v - min) / range) * (height - pad * 2)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [data, color, width, height])

  if (!data?.length) return <div style={{ width, height }} className="flex items-center justify-center text-[9px] text-gray-300">—</div>

  return (
    <canvas ref={ref}
      style={{ width, height, display: 'block' }}
      className="rounded"
    />
  )
}

// ── Alpha bar (inline in table) ───────────────────────────────────────────────
function AlphaBar({ alpha, maxAlpha = 50 }) {
  if (alpha == null) return <span className="text-xs text-gray-400">—</span>
  const w     = Math.min(Math.abs(alpha) / maxAlpha * 100, 100)
  const color = alpha >= 0 ? '#10b981' : '#ef4444'
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="relative flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600 z-10" />
        <div className="absolute top-0 h-full rounded-full"
          style={{
            width:  `${w / 2}%`,
            left:   alpha >= 0 ? '50%' : `${50 - w / 2}%`,
            background: color,
          }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums w-14 text-right shrink-0" style={{ color }}>
        {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}pp
      </span>
    </div>
  )
}

// ── Summary strip — compact inline stats ──────────────────────────────────────
function SummaryStrip({ swings, nepse, stock, symbol }) {
  if (!swings.length) return null

  const allStats = swings.map(sw => {
    const ns = slice(nepse, sw.from, sw.to)
    const ss = stock ? slice(stock, sw.from, sw.to) : []
    return { ...stats(ns, ss), type: sw.type }
  })

  const bulls    = allStats.filter(s => s.type === 'bull')
  const bears    = allStats.filter(s => s.type === 'bear')
  const alphas   = allStats.map(s => s.alpha).filter(v => v != null)
  const bAlphas  = bulls.map(s => s.alpha).filter(v => v != null)
  const beAlphas = bears.map(s => s.alpha).filter(v => v != null)
  const avg      = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const outRate  = alphas.length ? alphas.filter(v => v > 0).length / alphas.length * 100 : null
  const bullAvg  = avg(bAlphas)
  const bearAvg  = avg(beAlphas)

  return (
    <div className="shrink-0 flex items-center gap-1 px-4 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 overflow-x-auto">
      {/* Cycles */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
        <span className="text-[9px] font-semibold text-gray-400 uppercase">Cycles</span>
        <span className="text-[13px] font-black text-gray-800 dark:text-gray-100 tabular-nums">{swings.length}</span>
        <span className="text-[9px] text-gray-400">{bulls.length}▲{bears.length}▼</span>
      </div>

      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

      {/* Bull avg alpha */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
        <span className="text-[9px] font-semibold text-gray-400 uppercase">Bull α</span>
        <span className={`text-[13px] font-black tabular-nums ${bullAvg == null ? 'text-gray-400' : bullAvg >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {bullAvg == null ? '—' : `${bullAvg >= 0 ? '+' : ''}${bullAvg.toFixed(1)}`}
        </span>
        <span className="text-[9px] text-gray-400">{bAlphas.length}sw</span>
      </div>

      {/* Bear avg alpha */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
        <span className="text-[9px] font-semibold text-gray-400 uppercase">Bear α</span>
        <span className={`text-[13px] font-black tabular-nums ${bearAvg == null ? 'text-gray-400' : bearAvg >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {bearAvg == null ? '—' : `${bearAvg >= 0 ? '+' : ''}${bearAvg.toFixed(1)}`}
        </span>
        <span className="text-[9px] text-gray-400">{beAlphas.length}sw</span>
      </div>

      {/* Outperform rate */}
      {symbol && outRate != null && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0">
          <span className="text-[9px] font-semibold text-gray-400 uppercase">Win rate</span>
          <span className={`text-[13px] font-black tabular-nums ${outRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {outRate.toFixed(0)}%
          </span>
          <span className="text-[9px] text-gray-400">vs NEPSE</span>
        </div>
      )}
    </div>
  )
}

// ── Cycle row in the table ────────────────────────────────────────────────────
function CycleRow({ swing, nepse, stock, symbol, expanded, onToggle, maxAlpha }) {
  const isBull     = swing.type === 'bull'
  const nepseSlice = slice(nepse, swing.from, swing.to)
  const stockSlice = stock ? slice(stock, swing.from, swing.to) : []
  const st         = stats(nepseSlice, stockSlice)

  // Refs to both chart instances for crosshair sync
  const nepseRef = useRef(null)
  const stockRef = useRef(null)
  const syncingRef = useRef(false)  // prevent infinite sync loop

  // Wire crosshair sync once charts mount (when expanded)
  useEffect(() => {
    if (!expanded) return
    let unsubscribers = []
    const tid = setTimeout(() => {
      const nc = nepseRef.current?.getChart()
      const sc = stockRef.current?.getChart()
      const ns = nepseRef.current?.getSeries()
      const ss = stockRef.current?.getSeries()
      if (!nc || !sc) return

      function syncCursor(source, target, sourceSeries, targetSeries) {
        const unsub = source.subscribeCrosshairMove(param => {
          if (syncingRef.current) return
          syncingRef.current = true
          try {
            if (!param.time || !param.point || !targetSeries) {
              target.clearCrosshairPosition()
            } else {
              const bar = param.seriesData?.get(sourceSeries)
              const price = bar?.close ?? bar?.value ?? null
              if (price != null) {
                target.setCrosshairPosition(price, param.time, targetSeries)
              }
            }
          } catch (_) {}
          syncingRef.current = false
        })
        if (unsub) unsubscribers.push(unsub)
      }

      if (ns && ss) {
        syncCursor(nc, sc, ns, ss)
        syncCursor(sc, nc, ss, ns)
      }

      // Also sync time scale scroll/zoom
      const unsubNR = nc.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (syncingRef.current || !range) return
        syncingRef.current = true
        sc.timeScale().setVisibleLogicalRange(range)
        syncingRef.current = false
      })
      const unsubSR = sc.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (syncingRef.current || !range) return
        syncingRef.current = true
        nc.timeScale().setVisibleLogicalRange(range)
        syncingRef.current = false
      })
      if (unsubNR) unsubscribers.push(unsubNR)
      if (unsubSR) unsubscribers.push(unsubSR)
    }, 100)

    return () => {
      clearTimeout(tid)
      unsubscribers.forEach(fn => { try { fn() } catch (_) {} })
      unsubscribers = []
    }
  }, [expanded])

  return (
    <>
      {/* ── Main row ── */}
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors ${
          expanded
            ? 'bg-blue-50 dark:bg-blue-950/30'
            : isBull
              ? 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
              : 'hover:bg-red-50/50 dark:hover:bg-red-900/10'
        }`}
      >
        {/* Type */}
        <td className="py-2.5 pl-5 pr-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
              isBull ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                     : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
            }`}>{isBull ? '▲' : '▼'}</div>
            <div>
              <div className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{swing.name}</div>
              {swing.current && <div className="text-[8px] font-bold text-blue-500 uppercase">Live</div>}
            </div>
          </div>
        </td>

        {/* Period */}
        <td className="py-2.5 px-3 whitespace-nowrap">
          <div className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
            {fmtMonth(swing.from)} → {fmtMonth(swing.to)}
          </div>
          <div className="text-[9px] text-gray-400">{fmtDays(swing.from, swing.to)}</div>
        </td>

        {/* NEPSE return + sparkline */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            <Sparkline data={nepseSlice} color={NEPSE_C} />
            <span className={`text-[12px] font-bold tabular-nums ${(st.nRet ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {fmtPct(st.nRet)}
            </span>
          </div>
        </td>

        {/* Stock return + sparkline */}
        <td className="py-2.5 px-3">
          {symbol ? (
            <div className="flex items-center gap-2">
              <Sparkline data={stockSlice} color={STOCK_C} />
              <span className={`text-[12px] font-bold tabular-nums ${
                st.sRet == null ? 'text-gray-400' : st.sRet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
              }`}>
                {fmtPct(st.sRet)}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-300 dark:text-gray-600 italic">select stock</span>
          )}
        </td>

        {/* Alpha bar */}
        <td className="py-2.5 px-3 pr-5 min-w-[180px]">
          <AlphaBar alpha={st.alpha} maxAlpha={maxAlpha} />
        </td>

        {/* Expand chevron */}
        <td className="py-2.5 pr-4">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="4 6 8 10 12 6" />
          </svg>
        </td>
      </tr>

      {/* ── Expanded chart row ── */}
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-900/40 border-b-2 border-gray-200 dark:border-gray-700">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-3">

              {/* NEPSE chart */}
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: NEPSE_C }} />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">NEPSE</span>
                    <span className="text-xs text-gray-400">{swing.from} → {swing.to}</span>
                  </div>
                  <span className={`text-base font-black tabular-nums ${(st.nRet ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {fmtPct(st.nRet, 2)}
                  </span>
                </div>
                <MiniCandle ref={nepseRef} data={nepseSlice} height={240} />
              </div>

              {/* Stock chart */}
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STOCK_C }} />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{symbol || '—'}</span>
                    <span className="text-xs text-gray-400">{swing.from} → {swing.to}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {st.sRet != null && (
                      <span className={`text-base font-black tabular-nums ${st.sRet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {fmtPct(st.sRet, 2)}
                      </span>
                    )}
                    {st.alpha != null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        st.alpha >= 0
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}>
                        α {st.alpha >= 0 ? '+' : ''}{st.alpha.toFixed(1)}pp
                      </span>
                    )}
                    {st.maxDD != null && (
                      <span className="text-[10px] text-gray-400 tabular-nums">DD {fmtPct(st.maxDD, 1)}</span>
                    )}
                  </div>
                </div>
                <MiniCandle ref={stockRef} data={stock ? stockSlice : []} height={240} />
              </div>
            </div>

          </td>
        </tr>
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerformanceChart() {
  const [symbol,    setSymbol]    = useState('')
  const [company,   setCompany]   = useState(null)
  const [threshold, setThreshold] = useState(10)

  const [nepse,    setNepse]    = useState([])
  const [swings,   setSwings]   = useState([])
  const [stock,    setStock]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState(null)  // swing id or null

  const fetch = useCallback(() => {
    const key = `${symbol || '_'}:${threshold}:${CACHE_VER}`
    if (_cache[key] && fresh(_cache[key].ts)) {
      const named = nameSwings(_cache[key].swings || [])
      setNepse(_cache[key].nepse || [])
      setSwings(named)
      setStock(_cache[key].stock || null)
      return
    }
    setLoading(true)
    setError('')
    const params = symbol ? { symbol, threshold } : { threshold }
    getPerformance(params)
      .then(r => {
        const named = nameSwings(r.data.swings || [])
        _cache[key] = { nepse: r.data.nepse, swings: r.data.swings, stock: r.data.stock, ts: Date.now() }
        setNepse(r.data.nepse  || [])
        setSwings(named)
        setStock(r.data.stock  || null)
        setLoading(false)
      })
      .catch(err => { setError(err.response?.data?.error || 'Failed to load'); setLoading(false) })
  }, [symbol, threshold])

  useEffect(() => { fetch() }, [fetch])

  // Max alpha across all swings for consistent bar scaling — memoized to avoid
  // recalculating slice()+stats() on every hover/expand state change
  const maxAlpha = useMemo(() => Math.max(
    50,
    ...swings.map(sw => {
      const ns = slice(nepse, sw.from, sw.to)
      const ss = stock ? slice(stock, sw.from, sw.to) : []
      const a  = stats(ns, ss).alpha
      return a != null ? Math.abs(a) : 0
    })
  ), [swings, nepse, stock])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-wrap overflow-x-auto">

        <SymbolSearch value={symbol} onChange={(sym, name) => { setSymbol(sym); setCompany(name); setExpanded(null) }} />

        {symbol && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full" style={{ background: STOCK_C }} />
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{symbol}</span>
            {company && <span className="text-[10px] text-gray-400 hidden lg:block truncate max-w-[180px]">{company}</span>}
          </div>
        )}

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-400">Swing ≥</span>
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {THRESHOLDS.map(t => (
              <button key={t} onClick={() => { setThreshold(t); setExpanded(null) }}
                className={`px-2.5 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${
                  threshold === t
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>{t}%</button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-400 shrink-0">
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 rounded" style={{ background: NEPSE_C }} />NEPSE</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 rounded" style={{ background: STOCK_C }} />{symbol || 'Stock'}</span>
          <span className="text-gray-300 dark:text-gray-700 hidden xl:block">α = outperform pp</span>
          {loading && <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <SummaryStrip swings={swings} nepse={nepse} stock={stock} symbol={symbol} />

      {/* ── Error ── */}
      {error && (
        <div className="shrink-0 px-5 py-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && swings.length === 0 && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <svg className="w-12 h-12 text-gray-200 dark:text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <p className="text-sm text-gray-400">No swings detected at {threshold}% — try a lower threshold</p>
        </div>
      )}

      {/* ── Cycle table ── */}
      {swings.length > 0 && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="text-left py-2.5 pl-5 pr-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cycle</th>
                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: NEPSE_C }} /> NEPSE
                  </span>
                </th>
                <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: STOCK_C }} /> {symbol || 'Stock'}
                  </span>
                </th>
                <th className="text-left py-2.5 px-3 pr-5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Alpha vs NEPSE</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {swings.map(sw => (
                <CycleRow
                  key={sw.id}
                  swing={sw}
                  nepse={nepse}
                  stock={stock}
                  symbol={symbol}
                  expanded={expanded === sw.id}
                  onToggle={() => setExpanded(prev => prev === sw.id ? null : sw.id)}
                  maxAlpha={maxAlpha}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
