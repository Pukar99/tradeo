// =============================================================================
// PerformanceChart.jsx — NEPSE bull/bear cycle analysis with stock comparison
// =============================================================================
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getPerformance } from '../../api'
import { isCanceled } from '../../utils/format'
import { getMarketSymbols, registerCacheCleaner } from '../../utils/globalCache'
import { useToolbarSlot, safeSessionGet, safeSessionSet } from '../../pages/DataLabPage'
import { CARD, LABEL, STITLE, SVAL, Skeleton, fmtPct } from './shared'

// ── Cache — capped at 20 entries (LRU eviction) ───────────────────────────────
const CACHE_VER = 'v4' // v4: NEPSE history held once in _nepseCache, not per key
const PERF_TTL = 60 * 60_000
const fresh = (ts) => ts && Date.now() - ts < PERF_TTL
const _cache = {}
const _cacheKeys = [] // insertion-order list for LRU eviction
// NEPSE candles are identical for every symbol/threshold — one shared copy
// instead of 20 duplicates, and the basis for skip_nepse requests.
let _nepseCache = null // { data, ts }

function cacheSet(key, value) {
  if (_cache[key]) {
    _cacheKeys.splice(_cacheKeys.indexOf(key), 1)
  } else if (_cacheKeys.length >= 20) {
    const evict = _cacheKeys.shift()
    delete _cache[evict]
  }
  _cache[key] = value
  _cacheKeys.push(key)
}

// Called from globalCache.clearUserCache() on login/logout so swapping accounts
// doesn't leave the previous user's cycle/swing data visible.
export function clearPerformanceCache() {
  for (const k of Object.keys(_cache)) delete _cache[k]
  _cacheKeys.length = 0
  _nepseCache = null
}
// Module-load side effect: hook into the global logout flow.
// PerformanceChart is lazy-loaded so this only runs once the user opens DataLab.
// That's the right time — before then, there's no cache to clear anyway.
registerCacheCleaner(clearPerformanceCache)

// ── Constants ─────────────────────────────────────────────────────────────────
const THRESHOLDS = [5, 10, 15, 20]
const NEPSE_C = '#3b82f6'
const STOCK_C = '#f59e0b'
const UP = '#10b981'
const DOWN = '#ef4444'

async function loadLC() {
  return import('lightweight-charts')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(a, b) {
  return !a || !b ? null : ((b - a) / a) * 100
}
function fmtDays(from, to) {
  const d = Math.round((new Date(to) - new Date(from)) / 86400000)
  return d >= 365 ? `${(d / 365).toFixed(1)}y` : `${d}d`
}
function fmtMonth(date) {
  const [y, m] = date.split('-')
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[+m - 1]}'${y.slice(2)}`
}
function slice(arr, from, to) {
  if (!arr?.length) return []
  return arr.filter((d) => d.date >= from && d.date <= to)
}
function calcDD(slice) {
  if (slice.length < 2) return null
  let peak = slice[0].close,
    dd = 0
  for (const d of slice) {
    if (d.close > peak) peak = d.close
    const cur = ((d.close - peak) / peak) * 100
    if (cur < dd) dd = cur
  }
  return dd
}
function stats(nSlice, sSlice) {
  const nRet = pct(nSlice[0]?.close, nSlice[nSlice.length - 1]?.close)
  const sRet = pct(sSlice[0]?.close, sSlice[sSlice.length - 1]?.close)
  const alpha = nRet != null && sRet != null ? sRet - nRet : null
  return { nRet, sRet, alpha, maxDD: calcDD(sSlice), nepseDD: calcDD(nSlice) }
}
function nameSwings(raw) {
  let b = 1,
    be = 1
  const named = raw.map((s, i) => ({
    ...s,
    id: i,
    name: s.type === 'bull' ? `Bull ${b++}` : `Bear ${be++}`,
  }))
  return named.slice().reverse()
}

// Design tokens, Skeleton and fmtPct come from ./shared (single source for all
// three DataLab tabs).

// ── Symbol Search ─────────────────────────────────────────────────────────────
function SymbolSearch({ value, onChange }) {
  const [q, setQ] = useState(value || '')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(-1)
  const [rect, setRect] = useState(null)
  const wrapRef = useRef(null)
  const ml = useRef(false)
  const list = useRef(null)

  useEffect(() => {
    getMarketSymbols()
      .then((r) => setItems(r.data.stocks || []))
      .catch(() => {})
  }, [])

  const lq = q.toLowerCase()
  const flt =
    q.length < 1
      ? items.slice(0, 20)
      : items
          .filter(
            (s) =>
              s.symbol.toLowerCase().startsWith(lq) ||
              s.symbol.toLowerCase().includes(lq) ||
              (s.company_name && s.company_name.toLowerCase().includes(lq))
          )
          // symbols that start with the query float to top
          .sort((a, b) => {
            const as = a.symbol.toLowerCase().startsWith(lq) ? 0 : 1
            const bs = b.symbol.toLowerCase().startsWith(lq) ? 0 : 1
            return as - bs
          })
          .slice(0, 30)

  function openDropdown() {
    if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect())
    setOpen(true)
  }
  function pick(s) {
    setQ(s.symbol)
    setOpen(false)
    setCursor(-1)
    onChange(s.symbol, s.company_name || null)
  }
  function clear() {
    setQ('')
    setOpen(false)
    onChange('', null)
  }
  function onKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      openDropdown()
      setCursor((c) => Math.min(c + 1, flt.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Pick highlighted result first. If no highlight, only auto-pick when the
      // top result is an EXACT prefix match — otherwise user may be mid-typing
      // and we'd silently swap symbols on them.
      if (cursor >= 0 && flt[cursor]) {
        pick(flt[cursor])
      } else if (flt[0]?.symbol?.toLowerCase() === q.toLowerCase()) {
        pick(flt[0])
      }
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setCursor(-1)
    }
  }

  useEffect(() => {
    if (cursor >= 0 && list.current)
      list.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  // Reposition the dropdown when the page scrolls / resizes — without this,
  // any wheel scroll outside the search detaches the dropdown from its input.
  useEffect(() => {
    if (!open) return
    function reposition() {
      if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  // Highlight matched portion of text
  function highlight(text, query) {
    if (!query || !text) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-sm px-px">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <>
      {/* Input */}
      <div
        ref={wrapRef}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 w-[160px] focus-within:border-blue-400 dark:focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-200 dark:focus-within:ring-blue-900 transition-all"
      >
        <svg
          className="w-3 h-3 text-gray-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            openDropdown()
            setCursor(-1)
          }}
          onFocus={openDropdown}
          onBlur={() => {
            if (!ml.current) setOpen(false)
          }}
          onKeyDown={onKey}
          placeholder="Symbol / company…"
          maxLength={20}
          className="bg-transparent text-[10px] font-semibold text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none w-full"
        />
        {q && (
          <button
            onClick={clear}
            className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 text-[14px] leading-none shrink-0"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown — fixed so it escapes overflow:hidden parents */}
      {open && flt.length > 0 && rect && (
        <div
          className="fixed z-[999] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          style={{ top: rect.bottom + 6, left: rect.left, width: 260 }}
          onMouseEnter={() => {
            ml.current = true
          }}
          onMouseLeave={() => {
            ml.current = false
          }}
        >
          {/* Header hint */}
          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-medium">
              {flt.length} result{flt.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-gray-300 dark:text-gray-700">
              ↑↓ navigate · Enter select
            </span>
          </div>
          <ul
            ref={list}
            className="max-h-56 overflow-y-auto overscroll-contain bg-white dark:bg-gray-900 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full"
          >
            {flt.map((s, i) => (
              <li
                key={s.symbol}
                // onPointerDown unifies mouse + touch + pen.
                // preventDefault() stops the input's onBlur from firing first,
                // which would close the dropdown before pick() registers.
                onPointerDown={(e) => {
                  e.preventDefault()
                  ml.current = true
                  pick(s)
                  ml.current = false
                }}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                  i === cursor
                    ? 'bg-blue-50 dark:bg-blue-950/50'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 opacity-60" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
                    {highlight(s.symbol, q)}
                  </div>
                  {s.company_name && (
                    <div className="text-[10px] text-gray-400 truncate leading-tight">
                      {highlight(s.company_name, q)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// ── Inline candlestick chart — exposes chart instance via ref for cursor sync ──
const MiniCandle = forwardRef(function MiniCandle({ data, height = 360 }, fwdRef) {
  const { isDark } = useTheme()
  const domRef = useRef(null)
  const chartR = useRef(null)
  const seriesR = useRef(null)

  useImperativeHandle(
    fwdRef,
    () => ({
      getChart: () => chartR.current,
      getSeries: () => seriesR.current,
    }),
    []
  )

  useEffect(() => {
    if (!domRef.current || !height) return
    let cancelled = false

    if (chartR.current) {
      try {
        chartR.current._ro?.disconnect()
        chartR.current.remove()
      } catch (_) {}
      chartR.current = null
      seriesR.current = null
    }

    // Match card bg exactly
    const bg = isDark ? '#111827' : '#ffffff'
    const tx = isDark ? '#64748b' : '#94a3b8'
    const br = isDark ? '#1f2937' : '#e2e8f0'
    const w = domRef.current.clientWidth || 400

    loadLC().then(({ createChart }) => {
      if (cancelled || !domRef.current) return

      const chart = createChart(domRef.current, {
        width: w,
        height,
        layout: { background: { color: bg }, textColor: tx, fontSize: 10, attributionLogo: false },
        grid: { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
        crosshair: {
          mode: 1,
          vertLine: {
            color: isDark ? '#475569' : '#94a3b8',
            width: 1,
            style: 3,
            labelVisible: true,
          },
          horzLine: {
            color: isDark ? '#475569' : '#94a3b8',
            width: 1,
            style: 3,
            labelVisible: true,
          },
        },
        rightPriceScale: { borderColor: br, scaleMargins: { top: 0.08, bottom: 0.08 } },
        timeScale: { borderColor: br, timeVisible: true, barSpacing: 8, minBarSpacing: 3 },
        handleScroll: true,
        handleScale: true,
      })
      chartR.current = chart

      if (data?.length) {
        const s = chart.addCandlestickSeries({
          upColor: UP,
          downColor: DOWN,
          borderUpColor: UP,
          borderDownColor: DOWN,
          wickUpColor: UP + 'cc',
          wickDownColor: DOWN + 'cc',
          priceLineVisible: false,
        })
        s.setData(
          data.map((d) => ({
            time: d.date,
            open: +d.open,
            high: +d.high,
            low: +d.low,
            close: +d.close,
          }))
        )
        seriesR.current = s

        // Volume bars — bottom 20% of chart, only if data has turnover
        const hasTov = data.some((d) => (d.turnover || 0) > 0)
        if (hasTov) {
          chart.applyOptions({
            rightPriceScale: { borderColor: br, scaleMargins: { top: 0.08, bottom: 0.22 } },
          })
          const vol = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'vol',
          })
          chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
          vol.setData(
            data.map((d) => ({
              time: d.date,
              value: d.turnover || 0,
              color:
                +d.close >= +d.open
                  ? isDark
                    ? 'rgba(16,185,129,0.18)'
                    : 'rgba(16,185,129,0.15)'
                  : isDark
                    ? 'rgba(239,68,68,0.18)'
                    : 'rgba(239,68,68,0.15)',
            }))
          )
        }

        chart.timeScale().fitContent()
      }

      if (cancelled || !domRef.current) return
      const ro = new ResizeObserver(() => {
        if (domRef.current && chartR.current)
          chartR.current.applyOptions({ width: domRef.current.clientWidth })
      })
      ro.observe(domRef.current)
      chart._ro = ro
    })

    return () => {
      cancelled = true
      if (chartR.current) {
        try {
          chartR.current._ro?.disconnect()
          chartR.current.remove()
        } catch (_) {}
        chartR.current = null
        seriesR.current = null
      }
    }
  }, [data, isDark, height]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full" style={{ height }}>
      {!data?.length && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400">
          No data
        </div>
      )}
      <div ref={domRef} style={{ width: '100%', height }} />
    </div>
  )
})

// ── Wrapper that measures its container height and passes px to MiniCandle ───
const AutoMiniCandle = forwardRef(function AutoMiniCandle({ data }, ref) {
  const wrapRef = useRef(null)
  const [h, setH] = useState(300)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const px = Math.floor(e.contentRect.height)
      if (px > 0) setH(px)
    })
    ro.observe(el)
    const initial = Math.floor(el.clientHeight)
    if (initial > 0) setH(initial)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={wrapRef} className="w-full h-full">
      <MiniCandle ref={ref} data={data} height={h} />
    </div>
  )
})

// ── Left panel cycle item ─────────────────────────────────────────────────────
function CycleItem({ swing, precomp, symbol, isActive, onClick, index }) {
  const isBull = swing.type === 'bull'
  const nepseSlice = precomp?.ns || []
  const stockSlice = precomp?.ss || []
  const st = precomp?.st || {}

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-800 transition-colors ${
        isActive
          ? isBull
            ? 'bg-emerald-50 dark:bg-emerald-900/20'
            : 'bg-red-50 dark:bg-red-900/20'
          : index % 2 === 1
            ? 'bg-gray-50/60 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/60'
            : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/60'
      }`}
    >
      {/* Always visible: badge + name + NEPSE % */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span
            className={`text-[10px] font-black ${isBull ? 'text-emerald-500' : 'text-red-400'}`}
          >
            {isBull ? '▲' : '▼'}
          </span>
          <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200">
            {swing.name}
          </span>
          {swing.current && (
            <span className="text-[9px] font-bold text-blue-500 uppercase">·Live</span>
          )}
        </div>
        <span
          className={`text-[10px] font-bold tabular-nums ${(st.nRet ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}
        >
          {fmtPct(st.nRet)}
        </span>
      </div>

      {/* Expanded details */}
      {isActive && (
        <div className="mt-2">
          {/* Period */}
          <div className="text-[10px] text-gray-400 mb-2">
            {fmtMonth(swing.from)} → {fmtMonth(swing.to)} · {fmtDays(swing.from, swing.to)}
          </div>

          {/* Side-by-side: NEPSE | Stock */}
          <div
            className={`grid gap-2 ${symbol && stockSlice.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            {/* NEPSE column */}
            {nepseSlice.length > 0 &&
              (() => {
                const high = Math.max(...nepseSlice.map((d) => +d.high || +d.close))
                const low = Math.min(...nepseSlice.map((d) => +d.low || +d.close))
                const open = +nepseSlice[0]?.open || +nepseSlice[0]?.close
                const close = +nepseSlice[nepseSlice.length - 1]?.close
                return (
                  <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg px-2 py-1.5 space-y-0.5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">
                      NEPSE
                    </div>
                    {[
                      ['Open', open?.toFixed(0), null],
                      ['Close', close?.toFixed(0), (st.nRet ?? 0) >= 0 ? '#22c55e' : '#ef4444'],
                      ['High', high?.toFixed(0), '#22c55e'],
                      ['Low', low?.toFixed(0), '#ef4444'],
                      ['Max DD', st.nepseDD != null ? fmtPct(st.nepseDD, 1) : null, '#ef4444'],
                    ].map(
                      ([l, v, c]) =>
                        v != null && (
                          <div key={l} className="flex justify-between items-center gap-1">
                            <span className="text-[10px] text-gray-400">{l}</span>
                            <span
                              className="text-[10px] font-bold tabular-nums"
                              style={{ color: c || undefined }}
                            >
                              {v}
                            </span>
                          </div>
                        )
                    )}
                  </div>
                )
              })()}

            {/* Stock column */}
            {symbol &&
              stockSlice.length > 0 &&
              (() => {
                const high = Math.max(...stockSlice.map((d) => +d.high || +d.close))
                const low = Math.min(...stockSlice.map((d) => +d.low || +d.close))
                const open = +stockSlice[0]?.open || +stockSlice[0]?.close
                const close = +stockSlice[stockSlice.length - 1]?.close
                return (
                  <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg px-2 py-1.5 space-y-0.5">
                    <div
                      className="text-[10px] font-black uppercase tracking-widest mb-1"
                      style={{ color: STOCK_C }}
                    >
                      {symbol}
                    </div>
                    {[
                      ['Open', open?.toFixed(0), null],
                      ['Close', close?.toFixed(0), (st.sRet ?? 0) >= 0 ? '#22c55e' : '#ef4444'],
                      ['High', high?.toFixed(0), '#22c55e'],
                      ['Low', low?.toFixed(0), '#ef4444'],
                      ['Ret', fmtPct(st.sRet), (st.sRet ?? 0) >= 0 ? '#22c55e' : '#ef4444'],
                    ].map(
                      ([l, v, c]) =>
                        v != null && (
                          <div key={l} className="flex justify-between items-center gap-1">
                            <span className="text-[10px] text-gray-400">{l}</span>
                            <span
                              className="text-[10px] font-bold tabular-nums"
                              style={{ color: c || undefined }}
                            >
                              {v}
                            </span>
                          </div>
                        )
                    )}
                  </div>
                )
              })()}

            {/* Symbol selected but no data */}
            {symbol && stockSlice.length === 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg px-2 py-1.5 flex items-center justify-center">
                <span className="text-[10px] text-gray-300 dark:text-gray-700">No data</span>
              </div>
            )}
          </div>
        </div>
      )}
    </button>
  )
}

// ── Right panel — side-by-side charts for selected cycle ─────────────────────
function CycleDetail({ swing, precomp, nepse, stock, symbol }) {
  // Use precomp values when available — fall back to computing inside the memo
  // so the redundant slice+stats work is skipped entirely when precomp exists.
  const nepseSlice = useMemo(
    () => precomp?.ns ?? slice(nepse, swing.from, swing.to),
    [precomp, nepse, swing.from, swing.to]
  )
  const stockSlice = useMemo(
    () => precomp?.ss ?? (stock ? slice(stock, swing.from, swing.to) : []),
    [precomp, stock, swing.from, swing.to]
  )
  const st = useMemo(
    () => precomp?.st ?? stats(nepseSlice, stockSlice),
    [precomp, nepseSlice, stockSlice]
  )
  const isBull = swing.type === 'bull'

  const nepseRef = useRef(null)
  const stockRef = useRef(null)
  const syncingRef = useRef(false)

  // Wire crosshair + timescale sync — retries for 5s to handle AutoMiniCandle
  // height settling (ResizeObserver causes MiniCandle to remount after first render)
  useEffect(() => {
    if (!symbol || !stock) return
    let unsubs = []
    let attempts = 0
    let lastNc = null

    function trySync() {
      const nc = nepseRef.current?.getChart()
      const sc = stockRef.current?.getChart()
      const ns = nepseRef.current?.getSeries()
      const ss = stockRef.current?.getSeries()

      // If chart instances changed (remount), re-run even if max attempts reached
      const chartChanged = nc && nc !== lastNc
      if (!nc || !sc || !ns || !ss) {
        if (++attempts < 40) {
          setTimeout(trySync, 150)
          return
        }
        return
      }
      // Chart remounted — clear old subs and re-sync
      if (chartChanged && lastNc) {
        unsubs.forEach((fn) => {
          try {
            fn()
          } catch (_) {}
        })
        unsubs = []
      }
      lastNc = nc
      if (unsubs.length) return // already synced to this instance

      function sub(src, tgt, srcS, tgtS) {
        const u = src.subscribeCrosshairMove((p) => {
          if (syncingRef.current) return
          syncingRef.current = true
          try {
            if (!p.time || !p.point) tgt.clearCrosshairPosition()
            else {
              const bar = p.seriesData?.get(srcS)
              const price = bar?.close ?? bar?.value ?? null
              if (price != null) tgt.setCrosshairPosition(price, p.time, tgtS)
            }
          } catch (_) {}
          syncingRef.current = false
        })
        if (u) unsubs.push(u)
      }
      sub(nc, sc, ns, ss)
      sub(sc, nc, ss, ns)

      const uN = nc.timeScale().subscribeVisibleLogicalRangeChange((r) => {
        if (syncingRef.current || !r) return
        syncingRef.current = true
        sc.timeScale().setVisibleLogicalRange(r)
        syncingRef.current = false
      })
      const uS = sc.timeScale().subscribeVisibleLogicalRangeChange((r) => {
        if (syncingRef.current || !r) return
        syncingRef.current = true
        nc.timeScale().setVisibleLogicalRange(r)
        syncingRef.current = false
      })
      if (uN) unsubs.push(uN)
      if (uS) unsubs.push(uS)
    }
    const tid = setTimeout(trySync, 300)
    return () => {
      clearTimeout(tid)
      unsubs.forEach((fn) => {
        try {
          fn()
        } catch (_) {}
      })
      unsubs = []
    }
  }, [swing.id, symbol, stock])

  const showStock = symbol && stock

  // Below lg: stack vertically with scroll so each chart gets full width.
  // At lg+: side-by-side flex row (the original layout).
  // Fixed pixel min-height per chart at narrow widths so candles stay readable
  // even after the parent's auto-height grants too little space.
  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 overflow-y-auto lg:overflow-hidden">
      {/* NEPSE chart */}
      <div
        className={`${CARD} overflow-hidden flex flex-col shrink-0 lg:shrink min-h-[280px] lg:min-h-0 ${showStock ? 'flex-1' : 'w-full lg:w-full'}`}
      >
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: NEPSE_C }} />
            <span className={`${STITLE} shrink-0`}>NEPSE</span>
            <span
              className={`text-[10px] font-black px-1.5 py-px rounded shrink-0 ${
                isBull
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/40 text-red-500'
              }`}
            >
              {isBull ? '▲ Bull' : '▼ Bear'}
            </span>
            <span className={`${LABEL} normal-case truncate`}>
              {fmtMonth(swing.from)} → {fmtMonth(swing.to)} · {fmtDays(swing.from, swing.to)}
            </span>
          </div>
          <span
            className={`${SVAL} shrink-0 ${(st.nRet ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
          >
            {fmtPct(st.nRet, 2)}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <AutoMiniCandle ref={nepseRef} data={nepseSlice} />
        </div>
      </div>

      {/* Stock chart */}
      {showStock && (
        <div
          className={`${CARD} overflow-hidden flex flex-col shrink-0 lg:shrink flex-1 min-h-[280px] lg:min-h-0`}
        >
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STOCK_C }} />
              <span className={`${STITLE} truncate`}>{symbol}</span>
              <span className={`${LABEL} normal-case truncate`}>
                {fmtMonth(swing.from)} → {fmtMonth(swing.to)}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {st.sRet != null && (
                <span className={`${SVAL} ${st.sRet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {fmtPct(st.sRet, 2)}
                </span>
              )}
              {st.maxDD != null && (
                <span className={`${LABEL} normal-case hidden sm:inline`}>
                  DD {fmtPct(st.maxDD, 1)}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <AutoMiniCandle ref={stockRef} data={stockSlice} />
          </div>
        </div>
      )}

      {/* Symbol selected but no data */}
      {symbol && !stock && (
        <div className={`${CARD} flex-1 flex items-center justify-center min-h-[120px]`}>
          <span className="text-[11px] text-gray-400">No data for {symbol} in this period</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL — Compare Summary + Cycle Returns + Compound Ladder
// ─────────────────────────────────────────────────────────────────────────────
function NoSymbolEmptyState({ swings, bulls, bears }) {
  if (!swings.length)
    return (
      <div className="flex-1 flex items-center justify-center px-4 text-center">
        <p className="text-[11px] text-gray-400">No data — adjust threshold</p>
      </div>
    )

  const bullStats =
    bulls.length > 0 &&
    (() => {
      const gains = bulls.map((s) => s.pct ?? 0)
      return {
        count: bulls.length,
        avg: gains.reduce((s, v) => s + v, 0) / gains.length,
        best: Math.max(...gains),
      }
    })()
  const bearStats =
    bears.length > 0 &&
    (() => {
      const drops = bears.map((s) => s.pct ?? 0)
      return {
        count: bears.length,
        avg: drops.reduce((s, v) => s + v, 0) / drops.length,
        worst: Math.min(...drops),
      }
    })()

  return (
    <div className="space-y-3">
      <div className={`${CARD} p-3`}>
        <p className={`${LABEL} mb-1.5`}>Compare a stock</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          Search a symbol in the toolbar to see how it performed against NEPSE across every cycle,
          plus a what-if investment calculator.
        </p>
      </div>

      {bullStats && (
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className={`${LABEL} text-emerald-400`}>Bull Cycles</p>
            <p className="text-xl font-black text-emerald-500 tabular-nums leading-none">
              {bullStats.count}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">Avg gain</span>
              <span className="font-semibold text-emerald-500">+{bullStats.avg.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">Best</span>
              <span className="font-semibold text-emerald-500">+{bullStats.best.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {bearStats && (
        <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className={`${LABEL} text-red-400`}>Bear Cycles</p>
            <p className="text-xl font-black text-red-500 tabular-nums leading-none">
              {bearStats.count}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">Avg drop</span>
              <span className="font-semibold text-red-500">{bearStats.avg.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-400">Worst</span>
              <span className="font-semibold text-red-500">{bearStats.worst.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact cycle chip — "▲1" / "▼1" — derived from cycle.name (e.g. "Bull 1", "Bear 2")
function cycleChip(cycle) {
  if (!cycle?.name) return ''
  const num = cycle.name.match(/\d+/)?.[0] || ''
  return (cycle.type === 'bull' ? '▲' : '▼') + num
}

// ─── Cycle row: dual mini-bar for NEPSE vs stock returns inside one cycle ─────
function CycleRow({ cycle, nRet, sRet, symbol, max, isActive, isStart, partial, onClick }) {
  const isBull = cycle.type === 'bull'

  const barFor = (v) => {
    if (v == null) return { w: 0, color: '#9ca3af', left: 50 }
    const w = Math.min((Math.abs(v) / max) * 50, 50)
    const color = v >= 0 ? '#10b981' : '#ef4444'
    return { w, color, left: v >= 0 ? 50 : 50 - w }
  }
  const nBar = barFor(nRet)
  const sBar = barFor(sRet)

  // Visual states (can stack):
  //   isActive (blue ring + bg)   = "this cycle is the one in the center chart"
  //   isStart  (amber left border) = "this cycle is the Compound Ladder investment anchor"
  // Different semantics → different visual codes.
  return (
    <button
      onClick={onClick}
      title={`${cycle.name} · ${cycle.from} → ${cycle.to}`}
      className={`w-full text-left px-2 py-1.5 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors border-l-2
        ${isStart ? 'border-l-amber-500' : 'border-l-transparent'}
        ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-inset ring-blue-300 dark:ring-blue-700'
            : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
        }`}
    >
      <div className="flex items-center gap-2">
        {/* Cycle chip — ▲1 / ▼1 */}
        <span
          className={`shrink-0 inline-flex items-center justify-center px-1 h-5 min-w-[28px] rounded text-[10px] font-black tabular-nums relative
          ${
            isBull
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-100   dark:bg-red-900/40   text-red-500   dark:text-red-400'
          }`}
        >
          {cycleChip(cycle)}
          {isStart && (
            <span
              className="absolute -top-1 -right-1 text-[9px] font-black px-1 rounded-sm bg-amber-500 text-white leading-tight"
              title="Investment start"
            >
              ▶
            </span>
          )}
        </span>

        {/* Diverging dual-bar */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* NEPSE row */}
          <div className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-[10px] font-bold uppercase tracking-widest text-blue-400">
              NEP
            </span>
            <div className="relative flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
              <div
                className="absolute top-0 h-full rounded-sm"
                style={{ width: `${nBar.w}%`, left: `${nBar.left}%`, background: nBar.color }}
              />
            </div>
            <span
              className={`w-12 shrink-0 text-right text-[10px] font-bold tabular-nums ${(nRet ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {nRet == null ? '—' : `${nRet >= 0 ? '+' : ''}${nRet.toFixed(1)}%`}
            </span>
          </div>
          {/* Stock row */}
          {symbol && (
            <div className="flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-[10px] font-bold uppercase tracking-widest text-amber-500 truncate">
                {symbol.slice(0, 4)}
              </span>
              {partial && (
                <span
                  className="shrink-0 text-[9px] text-amber-500 leading-none"
                  title="Partial data — stock was not listed for the full cycle; excluded from win rate and alpha"
                >
                  ◐
                </span>
              )}
              <div className="relative flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
                <div
                  className="absolute top-0 h-full rounded-sm"
                  style={{ width: `${sBar.w}%`, left: `${sBar.left}%`, background: sBar.color }}
                />
              </div>
              <span
                className={`w-12 shrink-0 text-right text-[10px] font-bold tabular-nums ${(sRet ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
              >
                {sRet == null ? '—' : `${sRet >= 0 ? '+' : ''}${sRet.toFixed(1)}%`}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function CompareRightPanel({
  symbol,
  swings,
  allStats,
  expanded,
  setExpanded,
  winRateInfo,
  bulls,
  bears,
}) {
  // Investment amount for ladder (default Rs.100 to match user's reference)
  const [amount, setAmount] = useState(100)
  // Start cycle id (chronological). null = oldest cycle.
  const [startCycleId, setStartCycleId] = useState(null)

  // Reset startCycleId when swings change (new symbol / threshold)
  useEffect(() => {
    setStartCycleId(null)
  }, [swings])

  // Empty state — no symbol entered
  if (!symbol) return <NoSymbolEmptyState swings={swings} bulls={bulls} bears={bears} />

  // Chronological copy (allStats is most-recent-first via nameSwings.reverse())
  const chrono = [...(allStats || [])].sort((a, b) => a.id - b.id)
  const valid = chrono.filter((x) => x.st.sRet != null && x.st.nRet != null)

  if (!valid.length)
    return (
      <div className="space-y-3">
        <div className={`${CARD} p-3`}>
          <p className={`${LABEL} mb-1.5`}>{symbol}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            No price data for this symbol across the detected cycles.
          </p>
        </div>
      </div>
    )

  // Aggregate stats — win/loss counts live in winRateInfo (shown in the card header).
  // Partial-coverage cycles (stock listed mid-cycle) are excluded; if EVERY cycle
  // is partial (newly listed stock) fall back to all valid so the card isn't empty.
  const aggBase = valid.filter((x) => !x.partial)
  const agg = aggBase.length ? aggBase : valid
  const avgAlpha = agg.reduce((s, x) => s + (x.st.alpha || 0), 0) / agg.length
  const totalAlpha = agg.reduce((s, x) => s + (x.st.alpha || 0), 0)
  const bestCycle = agg.reduce((b, x) => (x.st.alpha > (b?.st.alpha ?? -Infinity) ? x : b), null)
  const worstCycle = agg.reduce((b, x) => (x.st.alpha < (b?.st.alpha ?? +Infinity) ? x : b), null)

  // Bar scaling: max of both NEPSE and stock returns in absolute terms
  const maxAbs = Math.max(
    ...chrono.flatMap((x) => [Math.abs(x.st.nRet ?? 0), Math.abs(x.st.sRet ?? 0)]),
    1
  )

  // Compound ladder rows: start from startCycleId (or first valid cycle) and ride every cycle
  const startIdx =
    startCycleId == null
      ? 0
      : Math.max(
          0,
          chrono.findIndex((x) => x.id === startCycleId)
        )
  const ladder = []
  let nBal = amount,
    sBal = amount
  for (let i = startIdx; i < chrono.length; i++) {
    const x = chrono[i]
    const nRet = x.st.nRet ?? 0
    const sRet = x.st.sRet ?? 0
    nBal = nBal * (1 + nRet / 100)
    sBal = sBal * (1 + sRet / 100)
    ladder.push({ id: x.id, cycle: swings.find((s) => s.id === x.id), nRet, sRet, nBal, sBal })
  }
  const lastRow = ladder[ladder.length - 1]
  // amount can be 0 mid-typing — guard the division so the footer never shows NaN%
  const finalNepsePct = lastRow && amount > 0 ? ((lastRow.nBal - amount) / amount) * 100 : 0
  const finalStockPct = lastRow && amount > 0 ? ((lastRow.sBal - amount) / amount) * 100 : 0
  const finalAlphaPct = finalStockPct - finalNepsePct

  const fmtRs = (v) =>
    v == null ? '—' : `Rs.${v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1)}`

  return (
    <div className="space-y-3">
      {/* ── 1. Win-rate summary ── */}
      <div className={`${CARD} p-3`}>
        <div className="flex items-baseline justify-between mb-1.5">
          <p className={`${LABEL}`}>{symbol} vs NEPSE</p>
          {winRateInfo && (
            <span
              className={`text-[11px] font-bold tabular-nums ${winRateInfo.pct >= 50 ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {winRateInfo.wins}/{winRateInfo.total} ({winRateInfo.pct}%)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <p className={`${LABEL} mb-0.5`}>Avg α</p>
            <p
              className={`text-[13px] font-bold tabular-nums ${avgAlpha >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {avgAlpha >= 0 ? '+' : ''}
              {avgAlpha.toFixed(1)}pp
            </p>
          </div>
          <div>
            <p className={`${LABEL} mb-0.5`}>Total α</p>
            <p
              className={`text-[13px] font-bold tabular-nums ${totalAlpha >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {totalAlpha >= 0 ? '+' : ''}
              {totalAlpha.toFixed(1)}pp
            </p>
          </div>
        </div>
        {bestCycle && worstCycle && bestCycle.id !== worstCycle.id && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Best {swings.find((s) => s.id === bestCycle.id)?.name || `Cycle ${bestCycle.id}`} ·{' '}
              {bestCycle.st.alpha >= 0 ? '+' : ''}
              {bestCycle.st.alpha.toFixed(1)}pp
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-[10px] font-semibold text-red-500 dark:text-red-400">
              Worst {swings.find((s) => s.id === worstCycle.id)?.name || `Cycle ${worstCycle.id}`} ·{' '}
              {worstCycle.st.alpha.toFixed(1)}pp
            </span>
          </div>
        )}
      </div>

      {/* ── 2. Cycle Returns — diverging dual bars per cycle (NEPSE vs symbol) ── */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 flex items-center justify-between">
          <p className={STITLE}>Cycle Returns</p>
          <span className="text-[10px] text-gray-400 normal-case">oldest → latest</span>
        </div>
        <div className="max-h-[280px] overflow-y-auto bg-white dark:bg-gray-900">
          {chrono.map((x) => (
            <CycleRow
              key={x.id}
              cycle={swings.find((s) => s.id === x.id)}
              nRet={x.st.nRet}
              sRet={x.st.sRet}
              symbol={symbol}
              max={maxAbs}
              partial={x.partial}
              isActive={expanded === x.id}
              isStart={startCycleId === x.id}
              onClick={() => setExpanded((prev) => (prev === x.id ? null : x.id))}
            />
          ))}
        </div>
      </div>

      {/* ── 3. Compound Ladder (Rs.X across cycles) ── */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
          <div className="flex items-center justify-between mb-1.5">
            <p className={STITLE}>Compound Ladder</p>
            {startCycleId != null && (
              <button
                onClick={() => setStartCycleId(null)}
                className="text-[10px] text-blue-500 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Invest</span>
            <span className="text-[10px] text-gray-400">Rs.</span>
            <input
              type="number"
              min={1}
              step={100}
              value={amount}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setAmount(isNaN(v) || v < 0 ? 0 : v)
              }}
              className="w-20 text-[11px] font-semibold tabular-nums text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400"
            />
            <span className="text-[10px] text-gray-400 ml-auto">
              from {swings.find((s) => s.id === ladder[0]?.id)?.name || 'start'} →{' '}
              {swings.find((s) => s.id === lastRow?.id)?.name || 'end'}
            </span>
          </div>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Cycle
          </span>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">NEPSE</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 truncate">
              {symbol}
            </p>
          </div>
        </div>

        <div className="max-h-[240px] overflow-y-auto bg-white dark:bg-gray-900">
          {ladder.map((row) => {
            const isBull = row.cycle?.type === 'bull'
            const isStart = startCycleId === row.id
            return (
              <button
                key={row.id}
                onClick={() => setStartCycleId((prev) => (prev === row.id ? null : row.id))}
                title={
                  isStart
                    ? 'Investment starts here. Click to unset.'
                    : `Anchor investment start at ${row.cycle?.name || 'this cycle'}`
                }
                className={`w-full grid grid-cols-[40px_1fr_1fr] items-center gap-1 px-2 py-1 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors relative
                  ${
                    isStart
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-l-2 border-l-amber-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/50 border-l-2 border-l-transparent'
                  }`}
              >
                <span
                  className={`inline-flex items-center justify-center px-1 h-5 min-w-[34px] rounded text-[10px] font-black tabular-nums relative
                  ${
                    isBull
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-100   dark:bg-red-900/40   text-red-500   dark:text-red-400'
                  }`}
                >
                  {cycleChip(row.cycle)}
                  {isStart && (
                    <span
                      className="absolute -top-1 -right-1 text-[9px] font-black px-1 rounded-sm bg-amber-500 text-white leading-tight"
                      title="Investment start"
                    >
                      ▶
                    </span>
                  )}
                </span>
                <div className="text-right tabular-nums">
                  <span
                    className={`text-[10px] block ${row.nRet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                  >
                    {row.nRet >= 0 ? '+' : ''}
                    {row.nRet.toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">
                    {fmtRs(row.nBal)}
                  </span>
                </div>
                <div className="text-right tabular-nums">
                  <span
                    className={`text-[10px] block ${row.sRet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                  >
                    {row.sRet >= 0 ? '+' : ''}
                    {row.sRet.toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">
                    {fmtRs(row.sBal)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Final summary footer */}
        {lastRow && (
          <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
            <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                End
              </span>
              <div className="text-right">
                <p
                  className={`text-[11px] font-black tabular-nums ${finalNepsePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  {finalNepsePct >= 0 ? '+' : ''}
                  {finalNepsePct.toFixed(1)}%
                </p>
                <p className="text-[10px] text-gray-500 tabular-nums">{fmtRs(lastRow.nBal)}</p>
              </div>
              <div className="text-right">
                <p
                  className={`text-[11px] font-black tabular-nums ${finalStockPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                >
                  {finalStockPct >= 0 ? '+' : ''}
                  {finalStockPct.toFixed(1)}%
                </p>
                <p className="text-[10px] text-gray-500 tabular-nums">{fmtRs(lastRow.sBal)}</p>
              </div>
            </div>
            <div className="mt-1.5 text-center text-[10px] text-gray-500 dark:text-gray-400">
              {symbol} alpha vs NEPSE:{' '}
              <span
                className={`font-bold tabular-nums ${finalAlphaPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
              >
                {finalAlphaPct >= 0 ? '+' : ''}
                {finalAlphaPct.toFixed(1)}pp
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerformanceChart() {
  // Controls survive refresh via sessionStorage (same pattern as the tab id)
  const [symbol, setSymbol] = useState(() => safeSessionGet('tradeo_perf_symbol', ''))
  const [threshold, setThreshold] = useState(() => {
    const v = parseFloat(safeSessionGet('tradeo_perf_threshold', '10'))
    return THRESHOLDS.includes(v) ? v : 10
  })
  useEffect(() => {
    safeSessionSet('tradeo_perf_symbol', symbol)
  }, [symbol])
  useEffect(() => {
    safeSessionSet('tradeo_perf_threshold', String(threshold))
  }, [threshold])

  const [nepse, setNepse] = useState([])
  const [swings, setSwings] = useState([])
  const [stock, setStock] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [cycleFilter, setCycleFilter] = useState('all')

  const lastSwingRef = useRef(null)
  const reqIdRef = useRef(0)

  const loadData = useCallback(() => {
    const key = `${symbol || '_'}:${threshold}:${CACHE_VER}`
    const nepseFresh = _nepseCache && fresh(_nepseCache.ts)
    if (_cache[key] && fresh(_cache[key].ts) && nepseFresh) {
      const named = nameSwings(_cache[key].swings || [])
      setError('')
      setNepse(_nepseCache.data || [])
      setSwings(named)
      setStock(_cache[key].stock || null)
      return
    }

    setLoading(true)
    setError('')
    // skip_nepse: the NEPSE array (~1400 candles) is identical for every
    // symbol/threshold — only request it when the shared copy is stale.
    const params = {
      threshold,
      ...(symbol ? { symbol } : {}),
      ...(nepseFresh ? { skip_nepse: 1 } : {}),
    }
    // Key guard instead of AbortController: the axios dedup interceptor collapses
    // duplicate in-flight requests (StrictMode), but it cannot cancel a DIFFERENT
    // superseded request — without this guard a slow response for symbol A could
    // overwrite state after the user already switched to symbol B.
    const reqId = ++reqIdRef.current
    getPerformance(params)
      .then((r) => {
        if (reqId !== reqIdRef.current) return
        if (r.data.nepse) _nepseCache = { data: r.data.nepse, ts: Date.now() }
        cacheSet(key, { swings: r.data.swings, stock: r.data.stock, ts: Date.now() })
        setNepse(_nepseCache?.data || [])
        setSwings(nameSwings(r.data.swings || []))
        setStock(r.data.stock || null)
      })
      .catch((err) => {
        if (reqId !== reqIdRef.current || isCanceled(err)) return
        setError('Failed to load data')
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false)
      })
  }, [symbol, threshold])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Pre-compute all slices + stats once per [swings, nepse, stock] change.
  // Prevents O(N) slice() calls inside every CycleItem render.
  const allStats = useMemo(
    () =>
      swings.map((sw) => {
        const ns = slice(nepse, sw.from, sw.to)
        const ss = stock ? slice(stock, sw.from, sw.to) : []
        // Stock listed mid-cycle: its return covers only part of the window, so
        // comparing it against NEPSE's full-cycle return is apples-to-oranges.
        // <80% trading-day coverage → flagged partial, excluded from win rate/alpha.
        const partial = ss.length > 0 && ns.length > 0 && ss.length < ns.length * 0.8
        return { id: sw.id, ns, ss, partial, st: stats(ns, ss) }
      }),
    [swings, nepse, stock]
  )

  const statsById = useMemo(() => {
    const m = {}
    allStats.forEach((x) => {
      m[x.id] = x
    })
    return m
  }, [allStats])

  // Reset cycleFilter + lastSwingRef when new data arrives
  useEffect(() => {
    setCycleFilter('all')
    lastSwingRef.current = null
  }, [swings])

  // Derived lists — declared BEFORE useToolbarSlot
  const bulls = useMemo(() => swings.filter((s) => s.type === 'bull'), [swings])
  const bears = useMemo(() => swings.filter((s) => s.type === 'bear'), [swings])
  const filteredSwings = useMemo(
    () => (cycleFilter === 'all' ? swings : swings.filter((s) => s.type === cycleFilter)),
    [swings, cycleFilter]
  )

  // Win rate with denominator (only cycles where stock data exists)
  const winRateInfo = useMemo(() => {
    if (!symbol || !allStats.length) return null
    // Partial-coverage cycles are excluded — their alpha is not comparable
    const withAlpha = allStats.filter((x) => x.st.alpha != null && !x.partial)
    if (!withAlpha.length) return null
    const wins = withAlpha.filter((x) => x.st.alpha > 0).length
    return { wins, total: withAlpha.length, pct: Math.round((wins / withAlpha.length) * 100) }
  }, [allStats, symbol])

  // Inject controls into the DataLab tab bar via portal
  const toolbar = useToolbarSlot(
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
      <SymbolSearch
        value={symbol}
        onChange={(sym) => {
          setSymbol(sym)
          setExpanded(null)
        }}
      />

      {symbol && (
        <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STOCK_C }} />
          <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-100">
            {symbol}
          </span>
        </div>
      )}

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        <span className={`${LABEL} normal-case`}>Swing ≥</span>
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
          {THRESHOLDS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setThreshold(t)
                setExpanded(null)
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                threshold === t
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t}%
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 rounded" style={{ background: NEPSE_C }} />
          <span className={`${LABEL} normal-case`}>NEPSE</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 rounded" style={{ background: STOCK_C }} />
          <span className={`${LABEL} normal-case`}>{symbol || 'Stock'}</span>
        </span>
        {loading && (
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Cycle count + win rate — right side of toolbar */}
      {swings.length > 0 && (
        <>
          <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />
          <span className={`${LABEL} normal-case`}>
            <span className="text-emerald-500 font-bold">{bulls.length}▲</span>{' '}
            <span className="text-red-400 font-bold">{bears.length}▼</span>
            {/* This tab's data window starts at 2020 (Breakdown covers full history) */}
            <span className="hidden sm:inline text-gray-300 dark:text-gray-600"> · since 2020</span>
          </span>
          {symbol && winRateInfo && (
            <div
              className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                winRateInfo.pct >= 50
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-500'
              }`}
            >
              {symbol} beat NEPSE {winRateInfo.wins}/{winRateInfo.total} ({winRateInfo.pct}%)
            </div>
          )}
        </>
      )}
    </div>
  )

  // Auto-select first cycle on load
  useEffect(() => {
    if (swings.length > 0 && expanded === null) setExpanded(swings[0].id)
  }, [swings]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeSwing = swings.find((sw) => sw.id === expanded) || null
  const activeIndex = filteredSwings.findIndex((sw) => sw.id === expanded)

  // Always keep last non-null swing so chart stays visible when collapsed
  if (activeSwing) lastSwingRef.current = activeSwing
  const displaySwing = activeSwing || lastSwingRef.current

  // Prev / Next navigation
  const goTo = useCallback(
    (dir) => {
      const next = filteredSwings[activeIndex + dir]
      if (next) setExpanded(next.id)
    },
    [filteredSwings, activeIndex]
  )

  // Keyboard: ↑ ↓ arrow keys navigate cycles
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        goTo(-1)
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        goTo(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo])

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-950">
      {toolbar}

      {/* ── LEFT RAIL — 160px @ md, 200px @ lg+ (matches Insight/Breakdown) ── */}
      <div className="hidden md:flex w-[160px] lg:w-[200px] shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-col overflow-hidden">
        {/* Filter chips — All / Bull / Bear */}
        {swings.length > 0 && (
          <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
            {[
              ['all', `All ${swings.length}`],
              ['bull', `▲ ${bulls.length}`],
              ['bear', `▼ ${bears.length}`],
            ].map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setCycleFilter(v)}
                className={`flex-1 py-1 text-[10px] font-bold transition-colors ${
                  cycleFilter === v
                    ? v === 'bull'
                      ? 'text-emerald-500 border-b-2 border-emerald-500'
                      : v === 'bear'
                        ? 'text-red-400 border-b-2 border-red-400'
                        : 'text-gray-700 dark:text-gray-200 border-b-2 border-gray-600 dark:border-gray-300'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && <div className="px-3 py-2 text-[10px] text-red-500">{error}</div>}

        {/* Loading */}
        {loading && swings.length === 0 && <Skeleton />}

        {/* Empty */}
        {!loading && swings.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3 text-center">
            <svg
              className="w-8 h-8 text-gray-200 dark:text-gray-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <p className="text-[10px] text-gray-400">No swings at {threshold}%</p>
          </div>
        )}

        {/* Cycle list */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-900 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
          {filteredSwings.map((sw, i) => (
            <CycleItem
              key={sw.id}
              swing={sw}
              precomp={statsById[sw.id]}
              symbol={symbol}
              isActive={expanded === sw.id}
              onClick={() => setExpanded((prev) => (prev === sw.id ? null : sw.id))}
              index={i}
            />
          ))}
          {filteredSwings.length === 0 && swings.length > 0 && (
            <div className="flex items-center justify-center py-8 text-[10px] text-gray-400">
              No {cycleFilter} cycles
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER — chart area ── */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Mobile cycle strip — the left rail is hidden below md and ↑↓ keys need
            a keyboard, so phones get a horizontal chip strip to switch cycles */}
        {swings.length > 0 && (
          <div className="md:hidden shrink-0 flex items-center gap-1.5 px-3 pt-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filteredSwings.map((sw) => {
              const isBull = sw.type === 'bull'
              const isActive = expanded === sw.id
              const ret = statsById[sw.id]?.st?.nRet
              return (
                <button
                  key={sw.id}
                  onClick={() => setExpanded(sw.id)}
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold tabular-nums border transition-colors ${
                    isActive
                      ? isBull
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-500'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <span>{cycleChip(sw)}</span>
                  <span>{fmtPct(ret)}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex-1 min-h-0 p-3">
          {displaySwing ? (
            <CycleDetail
              swing={displaySwing}
              precomp={statsById[displaySwing.id]}
              nepse={nepse}
              stock={stock}
              symbol={symbol}
            />
          ) : loading ? (
            // Loading: cycles being detected
            <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Detecting cycles…</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600">
                First load on Render free tier can take ~30s
              </p>
            </div>
          ) : error ? (
            // Error
            <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
              <svg
                className="w-8 h-8 text-red-300 dark:text-red-900"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M5 19h14a2 2 0 0 0 1.84-2.75L13.74 4a2 2 0 0 0-3.48 0L3.16 16.25A2 2 0 0 0 5 19z"
                />
              </svg>
              <p className="text-[11px] text-red-500">{error}</p>
              <button
                onClick={loadData}
                className="px-3 py-1 rounded text-[10px] font-semibold border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                Retry
              </button>
            </div>
          ) : swings.length === 0 ? (
            // No cycles at this threshold
            <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
              <svg
                className="w-8 h-8 text-gray-200 dark:text-gray-800"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                No bull/bear cycles at <span className="font-bold tabular-nums">{threshold}%</span>{' '}
                threshold
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600">
                Try a smaller threshold from the toolbar above
              </p>
            </div>
          ) : (
            // Has cycles, none selected yet
            <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
              <svg
                className="w-8 h-8 text-gray-200 dark:text-gray-800"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                <span className="hidden md:inline">Select a cycle from the left panel</span>
                <span className="md:hidden">Detected {swings.length} cycles</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — 420px (≥ lg only; below lg, charts use full width) ── */}
      <div className="hidden lg:flex w-[420px] shrink-0 border-l border-gray-100 dark:border-gray-800 flex-col min-h-0 bg-white dark:bg-gray-900">
        <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-900 p-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
          <CompareRightPanel
            symbol={symbol}
            swings={swings}
            allStats={allStats}
            expanded={expanded}
            setExpanded={setExpanded}
            winRateInfo={winRateInfo}
            bulls={bulls}
            bears={bears}
          />
        </div>
      </div>
    </div>
  )
}
