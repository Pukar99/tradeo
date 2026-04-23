import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useScreen } from '../../context/ScreenContext'
import { getIndexChart, getStockChart, getTopMovers, getMarketSymbols, getSMCScan, triggerBackfill } from '../../api'

// ── Indicator math ────────────────────────────────────────────────────────────

function calcMA(data, period = 20) {
  return data.map((d, i) => {
    if (i < period - 1) return null
    const avg = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period
    return { time: d.time, value: +avg.toFixed(2) }
  }).filter(Boolean)
}

function calcEMA(data, period) {
  if (data.length < period) return []
  const k = 2 / (period + 1)
  const out = []
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period
  out.push({ time: data[period - 1].time, value: +ema.toFixed(2) })
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k)
    out.push({ time: data[i].time, value: +ema.toFixed(2) })
  }
  return out
}

function calcRSI(data, period = 14) {
  if (data.length < period + 1) return []
  const out = []
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = data[i].close - data[i - 1].close
    d >= 0 ? (gains += d) : (losses -= d)
  }
  let ag = gains / period, al = losses / period
  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const d = data[i].close - data[i - 1].close
      ag = (ag * (period - 1) + Math.max(d, 0)) / period
      al = (al * (period - 1) + Math.max(-d, 0)) / period
    }
    const rs = al === 0 ? 100 : ag / al
    out.push({ time: data[i].time, value: +(100 - 100 / (1 + rs)).toFixed(2) })
  }
  return out
}

function calcMACD(data, fast = 12, slow = 26, sig = 9) {
  if (data.length < slow + sig) return { macd: [], signal: [], hist: [] }
  const ema = (arr, p) => {
    const k = 2 / (p + 1), out = [arr[0]]
    for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i - 1] * (1 - k))
    return out
  }
  const closes = data.map(d => d.close)
  const ef = ema(closes, fast), es = ema(closes, slow)
  const ml = closes.map((_, i) => ef[i] - es[i]).slice(slow - 1)
  const times = data.map(d => d.time).slice(slow - 1)
  const sl = ema(ml, sig)
  return {
    macd:   ml.map((v, i) => ({ time: times[i], value: +v.toFixed(2) })),
    signal: sl.map((v, i) => ({ time: times[i], value: +v.toFixed(2) })),
    hist:   ml.map((v, i) => ({ time: times[i], value: +(v - sl[i]).toFixed(2) })),
  }
}

// ── Bollinger Bands (20, 2) ──────────────────────────────────────────────────
function calcBB(data, period = 20, mult = 2) {
  const upper = [], lower = [], mid = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, d) => s + d.close, 0) / period
    const std = Math.sqrt(slice.reduce((s, d) => s + (d.close - avg) ** 2, 0) / period)
    mid.push({ time: data[i].time, value: +avg.toFixed(2) })
    upper.push({ time: data[i].time, value: +(avg + mult * std).toFixed(2) })
    lower.push({ time: data[i].time, value: +(avg - mult * std).toFixed(2) })
  }
  return { upper, lower, mid }
}

// ── VWAP (Volume-Weighted Average Price) ─────────────────────────────────────
function calcVWAP(data) {
  let cumVol = 0, cumTP = 0
  return data.map(d => {
    const tp = (d.high + d.low + d.close) / 3
    const vol = d.volume || d.turnover || 0
    cumVol += vol
    cumTP += tp * vol
    return { time: d.time, value: cumVol > 0 ? +(cumTP / cumVol).toFixed(2) : 0 }
  }).filter(d => d.value > 0)
}

// ── ATR (Average True Range, 14) ─────────────────────────────────────────────
function calcATR(data, period = 14) {
  if (data.length < period + 1) return []
  const trs = []
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  const out = [{ time: data[period].time, value: +atr.toFixed(2) }]
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
    out.push({ time: data[i + 1].time, value: +atr.toFixed(2) })
  }
  return out
}

// ── Stochastic (14, 3, 3) ────────────────────────────────────────────────────
function calcStochastic(data, kPeriod = 14, dPeriod = 3) {
  if (data.length < kPeriod) return { k: [], d: [] }
  const rawK = []
  for (let i = kPeriod - 1; i < data.length; i++) {
    const slice = data.slice(i - kPeriod + 1, i + 1)
    const hh = Math.max(...slice.map(d => d.high))
    const ll = Math.min(...slice.map(d => d.low))
    const val = hh === ll ? 50 : ((data[i].close - ll) / (hh - ll)) * 100
    rawK.push({ time: data[i].time, value: +val.toFixed(2) })
  }
  // Smooth K to get %K (SMA of rawK over dPeriod)
  const kLine = rawK.map((d, i) => {
    if (i < dPeriod - 1) return null
    const avg = rawK.slice(i - dPeriod + 1, i + 1).reduce((s, x) => s + x.value, 0) / dPeriod
    return { time: d.time, value: +avg.toFixed(2) }
  }).filter(Boolean)
  // %D = SMA of %K
  const dLine = kLine.map((d, i) => {
    if (i < dPeriod - 1) return null
    const avg = kLine.slice(i - dPeriod + 1, i + 1).reduce((s, x) => s + x.value, 0) / dPeriod
    return { time: d.time, value: +avg.toFixed(2) }
  }).filter(Boolean)
  return { k: kLine, d: dLine }
}

// ── Supertrend (10, 3) ──────────────────────────────────────────────────────
function calcSupertrend(data, period = 10, mult = 3) {
  const atrVals = []
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close
    atrVals.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  if (atrVals.length < period) return { up: [], down: [] }

  const result = []
  let atr = atrVals.slice(0, period).reduce((s, v) => s + v, 0) / period
  let upperBand = ((data[period].high + data[period].low) / 2) + mult * atr
  let lowerBand = ((data[period].high + data[period].low) / 2) - mult * atr
  let supertrend = data[period].close > upperBand ? lowerBand : upperBand
  let isUp = data[period].close > supertrend

  result.push({ time: data[period].time, value: +supertrend.toFixed(2), isUp })

  for (let i = period + 1; i < data.length; i++) {
    atr = (atr * (period - 1) + atrVals[i - 1]) / period
    const hl2 = (data[i].high + data[i].low) / 2
    let newUpper = hl2 + mult * atr
    let newLower = hl2 - mult * atr
    newLower = newLower > lowerBand ? newLower : lowerBand
    newUpper = newUpper < upperBand ? newUpper : upperBand
    if (data[i].close > upperBand) { supertrend = newLower; isUp = true }
    else if (data[i].close < lowerBand) { supertrend = newUpper; isUp = false }
    else { supertrend = isUp ? newLower : newUpper }
    upperBand = newUpper; lowerBand = newLower
    result.push({ time: data[i].time, value: +supertrend.toFixed(2), isUp })
  }

  return {
    up: result.filter(d => d.isUp).map(d => ({ time: d.time, value: d.value })),
    down: result.filter(d => !d.isUp).map(d => ({ time: d.time, value: d.value })),
  }
}

async function loadLC() { return import('lightweight-charts') }

// ── Embedded Symbol Search ─────────────────────────────────────────────────────

function ChartSymbolSearch() {
  const { selectedSymbol, selectSymbol } = useScreen()
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const [symbols,setSymbols]= useState({ stocks: [], indexes: [] })
  const [cursor, setCursor] = useState(-1)
  const [loadErr,setLoadErr]= useState(null)
  const inputRef        = useRef(null)
  const listRef         = useRef(null)
  const mouseDownInList = useRef(false)

  useEffect(() => {
    getMarketSymbols()
      .then(r => { if (r.data?.stocks?.length) { setSymbols(r.data); setLoadErr(null) } })
      .catch(() => setLoadErr('Symbols unavailable'))
  }, [])

  const allItems = [
    ...symbols.indexes.map(i => ({ label: i.name, sub: 'Index', indexId: i.index_id })),
    ...symbols.stocks.map(s => ({ label: s.symbol, sub: 'Stock' })),
  ]

  const filtered = query.length < 1
    ? allItems.slice(0, 20)
    : allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase())).slice(0, 30)

  const handleSelect = useCallback((item) => {
    selectSymbol(item.label, item.indexId || null)
    setQuery(''); setOpen(false); setCursor(-1)
  }, [selectSymbol])

  function handleKey(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && cursor >= 0) handleSelect(filtered[cursor])
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <div className="relative w-full max-w-[220px]">
      <div
        className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 cursor-pointer"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 40) }}
      >
        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          data-chart-search
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!mouseDownInList.current) setOpen(false) }}
          onKeyDown={handleKey}
          placeholder={selectedSymbol}
          autoComplete="off"
          className="bg-transparent text-[11px] font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 outline-none w-full"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          <ul ref={listRef}>
            {filtered.map((item, i) => (
              <li key={item.label}
                onMouseDown={() => { mouseDownInList.current = true; handleSelect(item); mouseDownInList.current = false }}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                  i === cursor ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{item.label}</span>
                <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${
                  item.sub === 'Index'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>{item.sub}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && filtered.length === 0 && query.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2 text-[10px] text-gray-400">
          {loadErr || `No results for "${query}"`}
        </div>
      )}
    </div>
  )
}

// ── HUD Controls — timeframe, chart type, indicators ──────────────────────────

const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']
const INDICATORS = ['MA', 'EMA', 'BB', 'VWAP', 'RSI', 'MACD', 'ATR', 'STOCH', 'ST']

function ChartHUDControls() {
  const { chartType, setChartType, timeframe, setTimeframe, activeIndicators = [], toggleIndicator, smcEnabled, setSmcEnabled } = useScreen() || {}

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Chart type */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
        {[['candlestick','Candle'], ['line','Line']].map(([type, label]) => (
          <button key={type} onClick={() => setChartType(type)}
            className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
              chartType === type
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Timeframes */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
        {TIMEFRAMES.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
              timeframe === tf
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {tf}
          </button>
        ))}
      </div>

      {/* Indicators */}
      <div className="flex items-center gap-0.5">
        {INDICATORS.map(ind => (
          <button key={ind} onClick={() => toggleIndicator(ind)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
              activeIndicators.includes(ind)
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500'
            }`}>
            {ind}
          </button>
        ))}
        <button onClick={() => setSmcEnabled(p => !p)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors ml-1 ${
            smcEnabled
              ? 'bg-purple-500 border-purple-500 text-white'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-300 hover:text-purple-500'
          }`}>
          SMC
        </button>
      </div>
    </div>
  )
}

// ── HUD Price + Symbol ─────────────────────────────────────────────────────────

function ChartHUDPrice({ latestClose, chartData }) {
  const { selectedSymbol } = useScreen()

  const lastBar = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const change  = lastBar ? (lastBar.diff_pct ?? lastBar.per_change ?? null) : null
  const isPos   = parseFloat(change) >= 0
  const close   = latestClose ?? lastBar?.close

  return (
    <div className="flex items-baseline gap-2 pointer-events-none" translate="no">
      <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300 tracking-wide">{selectedSymbol}</span>
      {close != null && (
        <>
          <span className="text-[20px] font-black text-gray-900 dark:text-white tabular-nums leading-none">
            {parseFloat(close).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {change != null && (
            <span className={`text-[11px] font-bold ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
              {isPos ? '▲' : '▼'} {Math.abs(parseFloat(change)).toFixed(2)}%
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ── Position Badge ─────────────────────────────────────────────────────────────

const ENTRY_DOT_COLORS  = ['bg-blue-400', 'bg-amber-400', 'bg-violet-400', 'bg-emerald-400', 'bg-pink-400']
const ENTRY_TEXT_COLORS = ['text-blue-400', 'text-amber-400', 'text-violet-400', 'text-emerald-400', 'text-pink-400']

function PositionBadge({ positions, latestClose }) {
  if (!positions?.length) return null

  const close    = parseFloat(latestClose) || 0
  const totalQty = positions.reduce((s, p) => s + (p.remaining_quantity ?? p.quantity ?? 0), 0)
  const avgEntry = totalQty > 0
    ? positions.reduce((s, p) => s + parseFloat(p.entry_price) * (p.remaining_quantity ?? p.quantity ?? 0), 0) / totalQty
    : 0
  const isLong     = positions.every(p => p.position !== 'SHORT')
  const totalUnreal = close
    ? positions.reduce((s, p) => {
        const qty  = p.remaining_quantity ?? p.quantity ?? 0
        const e    = parseFloat(p.entry_price)
        const long = p.position !== 'SHORT'
        return s + (long ? (close - e) * qty : (e - close) * qty)
      }, 0)
    : 0
  const pnlPct  = avgEntry ? ((close - avgEntry) / avgEntry * 100) * (isLong ? 1 : -1) : 0
  const isPos   = totalUnreal >= 0
  const isSingle = positions.length === 1

  return (
    <div className="absolute bottom-8 left-3 z-20 pointer-events-none" translate="no">
      <div className="bg-white/96 dark:bg-gray-900/96 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden w-56">
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-1.5 ${isLong ? 'bg-blue-50 dark:bg-blue-950/40' : 'bg-red-50 dark:bg-red-950/40'}`}>
          <div className="flex items-center gap-1.5">
            <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded ${
              isLong ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-red-100 dark:bg-red-900 text-red-500'
            }`}>{positions[0]?.position}</span>
            <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100">
              {isSingle ? (positions[0].symbol ?? '') : `${positions.length} entries`}
            </span>
          </div>
          {close > 0 && (
            <span className={`text-[11px] font-bold tabular-nums ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
              {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Summary */}
        <div className="px-3 pt-2 pb-1 grid grid-cols-3 gap-x-2 gap-y-1 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Avg Entry</p>
            <p className="text-[9px] font-semibold text-blue-400 tabular-nums">{avgEntry.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Qty</p>
            <p className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{totalQty}</p>
          </div>
          {close > 0 && (
            <div>
              <p className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5">Unreal</p>
              <p className={`text-[9px] font-semibold tabular-nums ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
                {isPos ? '+' : '−'}Rs.{Math.abs(Math.round(totalUnreal)).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Per-entry */}
        <div className="px-3 py-2 space-y-1.5">
          {positions.map((pos, idx) => {
            const e   = parseFloat(pos.entry_price)
            const qty = pos.remaining_quantity ?? pos.quantity ?? 0
            const long = pos.position !== 'SHORT'
            const u   = close ? (long ? (close - e) * qty : (e - close) * qty) : null
            const rr  = pos.sl && pos.tp
              ? (Math.abs(parseFloat(pos.tp) - e) / Math.abs(e - parseFloat(pos.sl))).toFixed(1)
              : null
            return (
              <div key={pos.id ?? idx} className="flex items-start gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 shrink-0 ${ENTRY_DOT_COLORS[idx % ENTRY_DOT_COLORS.length]}`} />
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 flex-1">
                  <div>
                    <p className="text-[7px] text-gray-400 uppercase tracking-widest">Entry</p>
                    <p className={`text-[9px] font-semibold tabular-nums ${ENTRY_TEXT_COLORS[idx % ENTRY_TEXT_COLORS.length]}`}>{e.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[7px] text-gray-400 uppercase tracking-widest">Qty</p>
                    <p className="text-[9px] font-semibold text-gray-600 dark:text-gray-400 tabular-nums">{qty}</p>
                  </div>
                  {u !== null && (
                    <div>
                      <p className="text-[7px] text-gray-400 uppercase tracking-widest">P&L</p>
                      <p className={`text-[9px] font-semibold tabular-nums ${u >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {u >= 0 ? '+' : '−'}{Math.abs(Math.round(u)).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {pos.sl && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest">SL</p><p className="text-[9px] font-semibold text-red-400 tabular-nums">{parseFloat(pos.sl).toFixed(2)}</p></div>}
                  {pos.tp && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest">TP</p><p className="text-[9px] font-semibold text-emerald-400 tabular-nums">{parseFloat(pos.tp).toFixed(2)}</p></div>}
                  {rr   && <div><p className="text-[7px] text-gray-400 uppercase tracking-widest">R:R</p><p className="text-[9px] font-semibold text-violet-400">1:{rr}</p></div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* SL→TP progress bar (single position only) */}
        {isSingle && (() => {
          const pos  = positions[0]
          const sl   = pos.sl ? parseFloat(pos.sl) : null
          const tp   = pos.tp ? parseFloat(pos.tp) : null
          const e    = parseFloat(pos.entry_price)
          if (!sl || !tp || !close) return null
          const range    = tp - sl
          const entryPct = Math.min(100, Math.max(0, ((e  - sl) / range) * 100))
          const closePct = Math.min(100, Math.max(0, ((close - sl) / range) * 100))
          return (
            <div className="px-3 pb-2.5">
              <div className="relative h-1.5 rounded-full overflow-visible mb-1">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400 via-gray-200 dark:via-gray-700 to-emerald-400" />
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-blue-400 rounded-full" style={{ left: `${entryPct}%` }} />
                <div className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
                  style={{ left: `${closePct}%`, top: '50%', transform: 'translate(-50%,-50%)' }} />
              </div>
              <div className="flex justify-between text-[7px]">
                <span className="text-red-400">{sl.toFixed(2)}</span>
                <span className={`font-semibold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>{close.toFixed(2)}</span>
                <span className="text-emerald-400">{tp.toFixed(2)}</span>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Movers Overlay ─────────────────────────────────────────────────────────────

function MoversOverlay({ movers, date, pinned, onClear }) {
  if (!movers || (!movers.gainers?.length && !movers.losers?.length)) return null
  const { selectSymbol } = useScreen()

  return (
    <div translate="no" className={`absolute top-14 right-2 z-20 w-52 rounded-2xl border shadow-lg backdrop-blur-sm text-[10px] overflow-hidden
      ${pinned
        ? 'bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 ring-1 ring-blue-400/30'
        : 'bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700'
      }`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{date}</span>
        {pinned ? (
          <button onClick={onClear} className="text-[9px] text-blue-400 hover:text-blue-600 font-semibold flex items-center gap-0.5">
            <span>📌</span> Pinned
          </button>
        ) : (
          <span className="text-[8px] text-gray-300 dark:text-gray-600">Click to pin</span>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
        <div className="px-2 py-2">
          <p className="text-[8px] font-semibold text-emerald-500 uppercase tracking-widest mb-1">Gainers</p>
          {(movers.gainers || []).slice(0, 5).map((s, i) => (
            <div key={i}
              onClick={() => selectSymbol(s.s)}
              className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 transition-colors"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-200">{s.s}</span>
              <span className="text-emerald-500 font-semibold">+{s.p}%</span>
            </div>
          ))}
        </div>
        <div className="px-2 py-2">
          <p className="text-[8px] font-semibold text-red-400 uppercase tracking-widest mb-1">Losers</p>
          {(movers.losers || []).slice(0, 5).map((s, i) => (
            <div key={i}
              onClick={() => selectSymbol(s.s)}
              className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 transition-colors"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-200">{s.s}</span>
              <span className="text-red-400 font-semibold">{s.p}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── OHLC Tooltip ──────────────────────────────────────────────────────────────

function OHLCTooltip({ bar, change }) {
  if (!bar) return null
  const isUp = (bar.close ?? bar.value) >= (bar.open ?? bar.value)
  return (
    <div className="absolute top-14 left-3 z-10 pointer-events-none" translate="no">
      <div className="bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
        <div className="text-[9px] text-gray-400 mb-1">{bar.time}</div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-[15px] font-bold ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
            {(bar.close ?? bar.value)?.toLocaleString()}
          </span>
          {change != null && (
            <span className={`text-[10px] font-semibold ${change >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
            </span>
          )}
        </div>
        {bar.open != null && (
          <div className="grid grid-cols-4 gap-x-3 text-[9px]">
            {['O','H','L','C'].map(l => <span key={l} className="text-gray-400">{l}</span>)}
            <span className="text-gray-700 dark:text-gray-300">{bar.open?.toLocaleString()}</span>
            <span className="text-emerald-500">{bar.high?.toLocaleString()}</span>
            <span className="text-red-400">{bar.low?.toLocaleString()}</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{bar.close?.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-2 p-4 animate-pulse">
      <div className="flex gap-1 items-end h-full">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-sm"
            style={{ height: `${30 + (Math.sin(i * 0.4) * 30 + 40)}%` }} />
        ))}
      </div>
    </div>
  )
}

// ── Sub-pane label ─────────────────────────────────────────────────────────────

function SubPaneLabel({ title, sub, color, legend }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-1 pb-0.5 shrink-0">
      <span className={`text-[8px] font-bold uppercase tracking-widest`} style={{ color }}>{title}</span>
      {sub && <span className="text-[8px] text-gray-400">{sub}</span>}
      {legend && legend.map((l, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="w-2 h-0.5 rounded inline-block" style={{ background: l.color }} />
          <span className="text-[8px] text-gray-400">{l.label}</span>
        </span>
      ))}
    </div>
  )
}

// ── Main StockChart ────────────────────────────────────────────────────────────

export default function StockChart() {
  const { isDark } = useTheme()
  const {
    selectedSymbol, selectedIndexId, chartType, timeframe,
    activeIndicators = [], isIndex, onHover, onPin, pinnedDate, clearPin,
    activePositions, smcEnabled,
  } = useScreen() || {}

  const mainRef    = useRef(null)
  const rsiRef     = useRef(null)
  const macdRef    = useRef(null)
  const atrRef     = useRef(null)
  const stochRef   = useRef(null)
  const chartsRef  = useRef({})
  const seriesRef  = useRef({})
  const moversCache    = useRef({})
  const pendingHover   = useRef(null)  // debounce movers fetch
  const pinnedDateRef  = useRef(pinnedDate)

  const [chartData,   setChartData]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [tooltip,     setTooltip]     = useState(null)
  const [overlayData, setOverlayData] = useState(null)
  const [latestClose, setLatestClose] = useState(null)
  const [smcData,     setSmcData]     = useState(null)

  const C = {
    bg:     isDark ? '#030712' : '#ffffff',
    grid:   'transparent',
    text:   isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#111827' : '#f3f4f6',
    up:     '#10b981',
    down:   '#ef4444',
    ma:     '#3b82f6',
    ema:    '#f59e0b',
    rsi:    '#a78bfa',
    macd:   '#60a5fa',
    signal: '#f59e0b',
  }

  // Debounced movers fetch — avoids spamming on every crosshair pixel
  const getMovers = useCallback(async (date) => {
    if (!date) return null
    if (moversCache.current[date]) return moversCache.current[date]
    try {
      const r = await getTopMovers(date)
      moversCache.current[date] = r.data
      return r.data
    } catch { return null }
  }, [])

  // Fetch chart data
  useEffect(() => {
    setLoading(true); setError(null); setTooltip(null); setOverlayData(null)

    const req = isIndex()
      ? getIndexChart({ index_id: selectedIndexId, timeframe })
      : getStockChart({ symbol: selectedSymbol, timeframe })

    req.then(async r => {
      const data = r.data.data || []
      setChartData(data)
      setLatestClose(data.length > 0 ? data[data.length - 1].close : null)
      setLoading(false)

      // Gap detection: if latest candle is older than expected, trigger backfill
      if (data.length > 0) {
        const latestCandle = data[data.length - 1].time // 'YYYY-MM-DD'
        const nowNPT = new Date(Date.now() + (5 * 60 + 45) * 60 * 1000)
        const hNPT = nowNPT.getUTCHours()
        const mNPT = nowNPT.getUTCMinutes()
        // Market data available after 3:10 PM NPT
        const afterClose = hNPT > 15 || (hNPT === 15 && mNPT >= 10)
        if (!afterClose) return // market still open — no gap expected

        // Find last trading day (skip weekends: Sat=6, Sun=0 from 2026-04-01)
        const expected = (() => {
          const d = new Date(nowNPT)
          for (let i = 0; i < 7; i++) {
            const s = d.toISOString().slice(0, 10)
            const dow = d.getUTCDay()
            const isWeekend = s >= '2026-04-01' ? (dow === 0 || dow === 6) : (dow === 5 || dow === 6)
            if (!isWeekend) return s
            d.setUTCDate(d.getUTCDate() - 1)
          }
        })()

        if (latestCandle < expected) {
          console.log(`[CHART] Gap detected: latest=${latestCandle}, expected=${expected} — triggering backfill`)
          try {
            const wasIndex = isIndex() // capture before any await
            const bf = await triggerBackfill(expected)
            if (bf.data?.filled) {
              const reloaded = wasIndex
                ? await getIndexChart({ index_id: selectedIndexId, timeframe })
                : await getStockChart({ symbol: selectedSymbol, timeframe })
              const fresh = reloaded.data.data || []
              setChartData(fresh)
              setLatestClose(fresh.length > 0 ? fresh[fresh.length - 1].close : null)
            }
          } catch { /* backfill is best-effort — chart still shows existing data */ }
        }
      }
    }).catch(e => {
      setError(e.response?.data?.error || 'Failed to load chart data')
      setLoading(false)
    })
  }, [selectedSymbol, selectedIndexId, timeframe]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch SMC data when enabled for stocks
  useEffect(() => {
    if (!smcEnabled || isIndex()) { setSmcData(null); return }
    getSMCScan({ symbol: selectedSymbol, days: 250 })
      .then(r => setSmcData(r.data))
      .catch(() => setSmcData(null))
  }, [smcEnabled, selectedSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build / rebuild charts
  useEffect(() => {
    if (loading || !chartData.length || !mainRef.current) return

    Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
    chartsRef.current = {}; seriesRef.current = {}

    const changeMap = {}
    chartData.forEach(d => { changeMap[d.time] = d.diff_pct ?? d.per_change })

    let cancelled = false
    let roCleanup = null

    loadLC().then(({ createChart, CrosshairMode, LineStyle }) => {
      if (cancelled || !mainRef.current) return

      const base = {
        layout:         { background: { color: C.bg }, textColor: C.text, fontSize: 11 },
        attributionLogo: false,
        grid:           { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
        crosshair: {
          mode:     CrosshairMode.Normal,
          vertLine: { width: 1, color: '#363a45', style: LineStyle.Solid },
          horzLine: { width: 1, color: '#363a45', style: LineStyle.Solid },
        },
        rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.12 } },
        timeScale: { borderColor: C.border, timeVisible: true, fixLeftEdge: true, fixRightEdge: false, rightOffset: 5 },
        handleScroll: true, handleScale: true,
      }

      const main = createChart(mainRef.current, {
        ...base,
        width:  mainRef.current.clientWidth,
        height: mainRef.current.clientHeight,
      })
      chartsRef.current.main = main

      let priceSeries
      if (chartType === 'candlestick') {
        priceSeries = main.addCandlestickSeries({
          upColor: C.up, downColor: C.down,
          borderUpColor: C.up, borderDownColor: C.down,
          wickUpColor: C.up + 'cc', wickDownColor: C.down + 'cc',
        })
        priceSeries.setData(chartData)
      } else {
        priceSeries = main.addAreaSeries({
          lineColor: C.ma, topColor: C.ma + '33', bottomColor: C.ma + '00',
          lineWidth: 2, priceLineVisible: true,
        })
        priceSeries.setData(chartData.map(d => ({ time: d.time, value: d.close })))
      }
      seriesRef.current.price = priceSeries

      // MA overlay
      if (activeIndicators.includes('MA')) {
        const ma = calcMA(chartData, 20)
        if (ma.length) {
          const s = main.addLineSeries({ color: C.ma + '90', lineWidth: 1.5, priceLineVisible: false, title: 'MA20' })
          s.setData(ma)
        }
      }

      // EMA overlay
      if (activeIndicators.includes('EMA')) {
        const ema = calcEMA(chartData, 20)
        if (ema.length) {
          const s = main.addLineSeries({ color: C.ema + 'cc', lineWidth: 1.5, priceLineVisible: false, title: 'EMA20' })
          s.setData(ema)
        }
      }

      // Bollinger Bands overlay
      if (activeIndicators.includes('BB')) {
        const { upper, lower, mid } = calcBB(chartData, 20, 2)
        if (upper.length) {
          const sU = main.addLineSeries({ color: '#a78bfa88', lineWidth: 1, priceLineVisible: false, title: 'BB+' })
          const sL = main.addLineSeries({ color: '#a78bfa88', lineWidth: 1, priceLineVisible: false, title: 'BB-' })
          const sM = main.addLineSeries({ color: '#a78bfa55', lineWidth: 1, lineStyle: 2, priceLineVisible: false, title: '' })
          sU.setData(upper); sL.setData(lower); sM.setData(mid)
        }
      }

      // VWAP overlay
      if (activeIndicators.includes('VWAP') && !isIndex()) {
        const vwap = calcVWAP(chartData)
        if (vwap.length) {
          const s = main.addLineSeries({ color: '#f59e0bcc', lineWidth: 1.5, lineStyle: 2, priceLineVisible: false, title: 'VWAP' })
          s.setData(vwap)
        }
      }

      // Supertrend overlay
      if (activeIndicators.includes('ST')) {
        const { up, down } = calcSupertrend(chartData, 10, 3)
        if (up.length) {
          const sUp = main.addLineSeries({ color: '#34d399', lineWidth: 2, priceLineVisible: false, title: 'ST↑', lineStyle: 0 })
          sUp.setData(up)
        }
        if (down.length) {
          const sDn = main.addLineSeries({ color: '#f87171', lineWidth: 2, priceLineVisible: false, title: 'ST↓', lineStyle: 0 })
          sDn.setData(down)
        }
      }

      // Position lines + markers
      const ENTRY_COLORS = ['#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#f472b6']
      const markers = []

      if (activePositions?.length) {
        activePositions.forEach((pos, idx) => {
          const { entry_price, sl, tp, entry_date, position: dir } = pos
          const entryColor = ENTRY_COLORS[idx % ENTRY_COLORS.length]
          const entryStr   = entry_date ? entry_date.slice(0, 10) : null
          const startIdx   = entryStr ? chartData.findIndex(d => d.time >= entryStr) : 0
          const fromData   = startIdx >= 0 ? chartData.slice(startIdx) : chartData.slice(-Math.min(chartData.length, 60))

          const addPosLine = (price, color, lineStyle, label) => {
            if (!price || !fromData.length) return
            const s = main.addLineSeries({
              color, lineWidth: 1.5, lineStyle,
              priceLineVisible: false, lastValueVisible: true,
              title: activePositions.length > 1 ? `${label}${idx + 1}` : label,
              crosshairMarkerVisible: false,
            })
            s.setData(fromData.map(d => ({ time: d.time, value: parseFloat(price) })))
          }

          addPosLine(entry_price, entryColor, 0, 'Entry')
          addPosLine(sl, idx === 0 ? '#f87171' : '#fca5a5', 2, 'SL')
          addPosLine(tp, idx === 0 ? '#34d399' : '#6ee7b7', 2, 'TP')

          if (fromData.length) {
            markers.push({
              time:     fromData[0].time,
              position: dir === 'SHORT' ? 'aboveBar' : 'belowBar',
              color:    entryColor,
              shape:    dir === 'SHORT' ? 'arrowDown' : 'arrowUp',
              text:     activePositions.length > 1 ? `E${idx + 1}` : '',
              size:     2,
            })
          }
        })
        if (markers.length) {
          markers.sort((a, b) => a.time < b.time ? -1 : 1)
          priceSeries.setMarkers(markers)
        }
      }

      // Volume histogram
      const volSeries = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
      main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })
      volSeries.setData(chartData.map(d => ({
        time: d.time, value: d.volume || d.turnover || 0,
        color: d.close >= d.open ? C.up + '44' : C.down + '44',
      })))

      // SMC overlays — Order Blocks as horizontal bands, patterns as markers
      if (smcData && smcEnabled) {
        // Order Blocks — draw as horizontal lines from OB candle to chart end
        const lastDate = chartData[chartData.length - 1]?.time
        for (const ob of (smcData.order_blocks || [])) {
          const obColor = ob.type === 'bullish' ? '#34d39960' : '#f8717160'
          const obTop = Math.max(ob.high, ob.open, ob.close)
          const obBottom = Math.min(ob.low, ob.open, ob.close)
          // Draw OB zone as two lines (top and bottom of the zone)
          const fromIdx = chartData.findIndex(d => d.time >= ob.date)
          if (fromIdx < 0) continue
          const obData = chartData.slice(fromIdx).map(d => ({ time: d.time, value: obTop }))
          if (obData.length) {
            const sTop = main.addLineSeries({ color: obColor, lineWidth: 1, lineStyle: 2, priceLineVisible: false, crosshairMarkerVisible: false, title: '' })
            sTop.setData(obData)
            const sBot = main.addLineSeries({ color: obColor, lineWidth: 1, lineStyle: 2, priceLineVisible: false, crosshairMarkerVisible: false, title: '' })
            sBot.setData(chartData.slice(fromIdx).map(d => ({ time: d.time, value: obBottom })))
          }
        }

        // FVG — draw gap zones
        for (const gap of (smcData.fvg || []).slice(-8)) {
          const gapColor = gap.type === 'bullish' ? '#60a5fa30' : '#f4728630'
          const fromIdx = chartData.findIndex(d => d.time >= gap.date)
          if (fromIdx < 0) continue
          // Only extend FVG 10 candles forward
          const gapSlice = chartData.slice(fromIdx, fromIdx + 10)
          if (gapSlice.length) {
            const sT = main.addLineSeries({ color: gapColor, lineWidth: 1, lineStyle: 1, priceLineVisible: false, crosshairMarkerVisible: false, title: '' })
            sT.setData(gapSlice.map(d => ({ time: d.time, value: gap.top })))
            const sB = main.addLineSeries({ color: gapColor, lineWidth: 1, lineStyle: 1, priceLineVisible: false, crosshairMarkerVisible: false, title: '' })
            sB.setData(gapSlice.map(d => ({ time: d.time, value: gap.bottom })))
          }
        }

        // BOS + CHoCH + patterns as markers on the price series
        const smcMarkers = []
        for (const b of (smcData.bos || [])) {
          smcMarkers.push({
            time: b.date, position: b.type === 'bullish' ? 'belowBar' : 'aboveBar',
            color: b.type === 'bullish' ? '#34d399' : '#f87171',
            shape: b.type === 'bullish' ? 'arrowUp' : 'arrowDown',
            text: 'BOS', size: 1,
          })
        }
        for (const ch of (smcData.choch || [])) {
          smcMarkers.push({
            time: ch.date, position: ch.type === 'bullish' ? 'belowBar' : 'aboveBar',
            color: '#f59e0b',
            shape: 'circle',
            text: 'CHoCH', size: 1,
          })
        }
        for (const sw of (smcData.sweeps || [])) {
          smcMarkers.push({
            time: sw.date, position: sw.type === 'buy_side' ? 'belowBar' : 'aboveBar',
            color: '#a78bfa',
            shape: 'square',
            text: sw.type === 'buy_side' ? 'Sweep$' : 'Sweep$', size: 1,
          })
        }
        for (const p of (smcData.patterns || []).slice(-10)) {
          const isBullish = p.type.includes('bullish') || p.type === 'hammer' || p.type === 'inside_bar'
          smcMarkers.push({
            time: p.date, position: isBullish ? 'belowBar' : 'aboveBar',
            color: isBullish ? '#22c55e' : '#ef4444',
            shape: 'circle',
            text: p.type.replace('_', ' ').replace('bullish ', '').replace('bearish ', '').slice(0, 6),
            size: 0,
          })
        }

        if (smcMarkers.length) {
          // Merge with existing position markers if any
          const existingMarkers = markers || []
          const allMarkers = [...existingMarkers, ...smcMarkers].sort((a, b) => a.time < b.time ? -1 : 1)
          priceSeries.setMarkers(allMarkers)
        }
      }

      // Crosshair events — debounce movers fetch by 80ms
      main.subscribeCrosshairMove(param => {
        if (pinnedDateRef.current) return
        if (cancelled) return
        if (!param.time) { setTooltip(null); setOverlayData(null); onHover(null, null); return }
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })

        // Debounce: cancel previous pending fetch
        if (pendingHover.current) clearTimeout(pendingHover.current)
        pendingHover.current = setTimeout(async () => {
          if (cancelled || pinnedDateRef.current) return
          const movers = await getMovers(param.time)
          if (cancelled || pinnedDateRef.current) return
          setOverlayData({ date: param.time, movers, pinned: false })
          onHover(param.time, movers)
        }, 80)
      })

      main.subscribeClick(async param => {
        if (cancelled) return
        if (!param.time) return
        const bar = param.seriesData?.get(priceSeries)
        if (!bar) return
        if (pendingHover.current) { clearTimeout(pendingHover.current); pendingHover.current = null }
        const movers = await getMovers(param.time)
        if (cancelled) return
        setTooltip({ ...bar, time: param.time, change: changeMap[param.time] })
        setOverlayData({ date: param.time, movers, pinned: true })
        onPin(param.time, movers)
      })

      // RSI sub-pane
      if (activeIndicators.includes('RSI') && rsiRef.current) {
        const rsiData = calcRSI(chartData)
        if (rsiData.length) {
          const rc = createChart(rsiRef.current, {
            ...base,
            width: rsiRef.current.clientWidth,
            height: rsiRef.current.clientHeight,
            rightPriceScale: { ...base.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
          })
          chartsRef.current.rsi = rc
          rc.addLineSeries({ color: C.rsi, lineWidth: 1.5, priceLineVisible: false }).setData(rsiData)
          rc.addLineSeries({ color: C.down + '80', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(rsiData.map(d => ({ time: d.time, value: 70 })))
          rc.addLineSeries({ color: C.up + '80', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(rsiData.map(d => ({ time: d.time, value: 30 })))
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) rc.timeScale().setVisibleLogicalRange(r) })
          rc.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) main.timeScale().setVisibleLogicalRange(r) })
        }
      }

      // MACD sub-pane
      if (activeIndicators.includes('MACD') && macdRef.current) {
        const { macd, signal, hist } = calcMACD(chartData)
        if (macd.length) {
          const mc = createChart(macdRef.current, {
            ...base,
            width: macdRef.current.clientWidth,
            height: macdRef.current.clientHeight,
          })
          chartsRef.current.macd = mc
          mc.addLineSeries({ color: C.macd, lineWidth: 1.5, priceLineVisible: false }).setData(macd)
          mc.addLineSeries({ color: C.signal, lineWidth: 1.5, priceLineVisible: false }).setData(signal)
          mc.addHistogramSeries({ priceLineVisible: false }).setData(
            hist.map(d => ({ ...d, color: d.value >= 0 ? C.up + '99' : C.down + '99' }))
          )
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) mc.timeScale().setVisibleLogicalRange(r) })
        }
      }

      // ATR sub-pane
      if (activeIndicators.includes('ATR') && atrRef.current) {
        const atrData = calcATR(chartData)
        if (atrData.length) {
          const ac = createChart(atrRef.current, {
            ...base,
            width: atrRef.current.clientWidth,
            height: atrRef.current.clientHeight,
          })
          chartsRef.current.atr = ac
          ac.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false, title: 'ATR14' }).setData(atrData)
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) ac.timeScale().setVisibleLogicalRange(r) })
        }
      }

      // Stochastic sub-pane
      if (activeIndicators.includes('STOCH') && stochRef.current) {
        const { k, d } = calcStochastic(chartData)
        if (k.length) {
          const sc = createChart(stochRef.current, {
            ...base,
            width: stochRef.current.clientWidth,
            height: stochRef.current.clientHeight,
            rightPriceScale: { ...base.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
          })
          chartsRef.current.stoch = sc
          sc.addLineSeries({ color: '#60a5fa', lineWidth: 1.5, priceLineVisible: false, title: '%K' }).setData(k)
          sc.addLineSeries({ color: '#f87171', lineWidth: 1.5, priceLineVisible: false, title: '%D' }).setData(d)
          // 80/20 levels
          sc.addLineSeries({ color: C.down + '60', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(k.map(p => ({ time: p.time, value: 80 })))
          sc.addLineSeries({ color: C.up + '60', lineWidth: 1, lineStyle: 2, priceLineVisible: false }).setData(k.map(p => ({ time: p.time, value: 20 })))
          main.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r) sc.timeScale().setVisibleLogicalRange(r) })
        }
      }

      main.timeScale().fitContent()

      // Resize both width AND height
      const ro = new ResizeObserver(() => {
        if (mainRef.current && chartsRef.current.main) {
          chartsRef.current.main.applyOptions({
            width:  mainRef.current.clientWidth,
            height: mainRef.current.clientHeight,
          })
        }
        if (rsiRef.current && chartsRef.current.rsi) {
          chartsRef.current.rsi.applyOptions({
            width:  rsiRef.current.clientWidth,
            height: rsiRef.current.clientHeight,
          })
        }
        if (macdRef.current && chartsRef.current.macd) {
          chartsRef.current.macd.applyOptions({
            width:  macdRef.current.clientWidth,
            height: macdRef.current.clientHeight,
          })
        }
        if (atrRef.current && chartsRef.current.atr) {
          chartsRef.current.atr.applyOptions({
            width:  atrRef.current.clientWidth,
            height: atrRef.current.clientHeight,
          })
        }
        if (stochRef.current && chartsRef.current.stoch) {
          chartsRef.current.stoch.applyOptions({
            width:  stochRef.current.clientWidth,
            height: stochRef.current.clientHeight,
          })
        }
      })
      if (mainRef.current) ro.observe(mainRef.current)
      roCleanup = () => ro.disconnect()
    })

    return () => {
      cancelled = true
      if (pendingHover.current) clearTimeout(pendingHover.current)
      if (roCleanup) roCleanup()
      Object.values(chartsRef.current).forEach(c => { try { c.remove() } catch (_) {} })
      chartsRef.current = {}
    }
  }, [chartData, isDark, chartType, activeIndicators, activePositions, smcData, smcEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    pinnedDateRef.current = pinnedDate
    if (!pinnedDate) setOverlayData(prev => prev ? { ...prev, pinned: false } : null)
  }, [pinnedDate])

  const showRSI   = activeIndicators.includes('RSI')
  const showMACD  = activeIndicators.includes('MACD')
  const showATR   = activeIndicators.includes('ATR')
  const showSTOCH = activeIndicators.includes('STOCH')
  const indCount  = (showRSI ? 1 : 0) + (showMACD ? 1 : 0) + (showATR ? 1 : 0) + (showSTOCH ? 1 : 0)
  const mainPct   = indCount === 0 ? 100 : indCount === 1 ? 70 : indCount === 2 ? 55 : indCount === 3 ? 45 : 40

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-[12px] text-gray-400">{error}</p>
      <button
        onClick={() => { setError(null); setLoading(true) }}
        className="text-[10px] text-blue-500 hover:underline"
      >Retry</button>
    </div>
  )

  const subPanePct = indCount === 0 ? 0 : Math.round((100 - mainPct) / indCount)

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-950 overflow-hidden">

      {/* ── HUD top bar ── */}
      <div className="shrink-0 z-30 flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <ChartSymbolSearch />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
        <ChartHUDControls />
      </div>

      {/* ── Overlays (absolute inside the chart area below) ── */}

      {/* ── Chart area ── */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Price overlay top-left */}
          <div className="absolute top-2 left-3 z-20 pointer-events-none">
            {chartData.length > 0 && (
              <ChartHUDPrice latestClose={latestClose} chartData={chartData} />
            )}
          </div>

          {/* Position badge */}
          <PositionBadge positions={activePositions} latestClose={latestClose} />

          {/* OHLC tooltip */}
          <OHLCTooltip bar={tooltip} change={tooltip?.change} />

          {/* Pinned hint */}
          {overlayData?.pinned && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="text-[9px] text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                📌 Movers shown in right panel — click to unpin
              </span>
            </div>
          )}

          {/* Main price chart */}
          <div
            ref={mainRef}
            className="w-full shrink-0"
            style={{ height: `${mainPct}%` }}
          />

          {showRSI && (
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="RSI" sub="14" color="#a78bfa"
                legend={[{ color: '#ef444480', label: '70 OB' }, { color: '#10b98180', label: '30 OS' }]} />
              <div ref={rsiRef} className="w-full flex-1 min-h-0" />
            </div>
          )}

          {showMACD && (
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="MACD" sub="12 / 26 / 9" color="#60a5fa"
                legend={[{ color: '#60a5fa', label: 'MACD' }, { color: '#f59e0b', label: 'Signal' }]} />
              <div ref={macdRef} className="w-full flex-1 min-h-0" />
            </div>
          )}

          {showATR && (
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="ATR" sub="14" color="#f59e0b"
                legend={[{ color: '#f59e0b', label: 'ATR' }]} />
              <div ref={atrRef} className="w-full flex-1 min-h-0" />
            </div>
          )}

          {showSTOCH && (
            <div className="w-full shrink-0 border-t border-gray-100 dark:border-gray-800 flex flex-col" style={{ height: `${subPanePct}%` }}>
              <SubPaneLabel title="STOCH" sub="14 / 3 / 3" color="#60a5fa"
                legend={[{ color: '#60a5fa', label: '%K' }, { color: '#f87171', label: '%D' }]} />
              <div ref={stochRef} className="w-full flex-1 min-h-0" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
