import { useState, useCallback, useRef, useEffect } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import { useTheme } from '../../context/ThemeContext'
import { getMonthlyReturns, getMonthDetail, getSectorMonth, getSectorMonthStocks } from '../../api/index'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_EN   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_NP   = ['Pou','Mag','Fal','Cha','Bai','Jes','Ash','Shr','Bha','Asw','Kar','Man']
const RECENT_N    = 5

// Available indices for the selector (index_id matches INDEX_MAP in dailyScraper.js)
const INDEX_OPTIONS = [
  { id: 12, label: 'NEPSE',                    short: 'NEPSE'    },
  { id: 1,  label: 'Commercial Bank',          short: 'Bank'     },
  { id: 2,  label: 'Development Bank',         short: 'DevBank'  },
  { id: 3,  label: 'Finance',                  short: 'Finance'  },
  { id: 4,  label: 'Hotels & Tourism',         short: 'Hotel'    },
  { id: 5,  label: 'Hydro Power',              short: 'Hydro'    },
  { id: 6,  label: 'Life Insurance',           short: 'Life'     },
  { id: 8,  label: 'Manufacturing',            short: 'Mfg'      },
  { id: 9,  label: 'Microfinance',             short: 'MFI'      },
  { id: 10, label: 'Mutual Fund',              short: 'MF'       },
  { id: 11, label: 'Non-Life Insurance',       short: 'Non-Life' },
  { id: 13, label: 'Others',                   short: 'Others'   },
  { id: 14, label: 'Trading',                  short: 'Trading'  },
  { id: 15, label: 'Investment',               short: 'Invest'   },
]

// ─── Colour helpers ───────────────────────────────────────────────────────────
function cellBg(val, dark) {
  if (val == null) return dark ? '#0f172a' : '#f8fafc'
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
  return Array.from({ length: 12 }, (_, mi) => {
    let sw = 0, sv = 0
    years.forEach((row, idx) => {
      const v = row.months[mi]
      if (v == null) return
      const w = idx < RECENT_N ? 2 : 1
      sv += v * w; sw += w
    })
    return sw > 0 ? +(sv / sw).toFixed(2) : null
  })
}
function weightedWinRate(years) {
  return Array.from({ length: 12 }, (_, mi) => {
    let pos = 0, tot = 0
    years.forEach((row, idx) => {
      const v = row.months[mi]
      if (v == null) return
      const w = idx < RECENT_N ? 2 : 1
      if (v > 0) pos += w
      tot += w
    })
    return tot > 0 ? +(pos / tot * 100).toFixed(1) : null
  })
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Spark({ vals, color, h = 28 }) {
  const valid = (vals || []).filter(v => v != null)
  if (!valid.length) return <div style={{ height: h }} />
  const W = 200, H = h
  const PL = 2, PR = 2, PT = 2, PB = 2
  const minV = Math.min(...valid, 0) - 1
  const maxV = Math.max(...valid, 0) + 1
  const rng  = (maxV - minV) || 1
  const xs   = i => PL + (i / 11) * (W - PL - PR)
  const ys   = v => PT + ((maxV - v) / rng) * (H - PT - PB)
  const pts  = (vals || []).map((v, i) => v != null ? `${xs(i).toFixed(1)},${ys(v).toFixed(1)}` : null).filter(Boolean)
  const z    = ys(0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <line x1={PL} x2={W-PR} y1={z} y2={z} stroke="#374151" strokeWidth={0.5} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Win rate mini bar ────────────────────────────────────────────────────────
function WinBar({ label, rate }) {
  const color = rate >= 60 ? '#22c55e' : rate >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 text-[9px] text-gray-500 dark:text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${rate || 0}%`, background: color }} />
      </div>
      <span className="w-8 text-[9px] font-bold text-right shrink-0" style={{ color }}>
        {rate != null ? rate + '%' : '—'}
      </span>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
function Tile({ label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-800/60 rounded-lg px-2 py-1.5 border border-gray-100 dark:border-gray-700/40">
      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-[11px] font-black mt-0.5" style={{ color: color || undefined }}>{value ?? '—'}</div>
    </div>
  )
}

// ─── Left Panel ───────────────────────────────────────────────────────────────
function LeftInsightPanel({ data, years, wAvg, wWinRate, dark, curYear, curRow, prevRow,
  recentSet, useNP, setUseNP, LABELS, selectedIndexId, setSelectedIndexId }) {

  const validAvg  = wAvg.filter(v => v != null)
  const bestMi    = validAvg.length ? wAvg.indexOf(Math.max(...validAvg)) : -1
  const worstMi   = validAvg.length ? wAvg.indexOf(Math.min(...validAvg)) : -1
  const annualRows = years.filter(y => y.annual != null)
  const posYears  = annualRows.filter(y => y.annual > 0).length
  const negYears  = annualRows.filter(y => y.annual <= 0).length
  const avgAnnual = annualRows.length
    ? +(annualRows.reduce((s, y) => s + y.annual, 0) / annualRows.length).toFixed(1)
    : null
  const maxAnnual = annualRows.length ? Math.max(...annualRows.map(y => y.annual)) : null
  const minAnnual = annualRows.length ? Math.min(...annualRows.map(y => y.annual)) : null

  // Streak dates
  const streakCount = data?.current_streak?.count || 0
  const streakDir   = data?.current_streak?.direction

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">

      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest">Insight</div>
        <div className="text-[9px] text-gray-400 mt-0.5">NEPSE Seasonality & Analytics</div>
      </div>

      {/* Index selector */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Index</div>
        <div className="flex flex-wrap gap-1">
          {INDEX_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setSelectedIndexId(opt.id)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors ${
                selectedIndexId === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {opt.short}
            </button>
          ))}
        </div>
      </div>

      {/* Month labels toggle */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Labels</span>
        <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-700 text-[9px] font-black">
          {['EN','NP'].map((t, i) => (
            <button key={t} onClick={() => setUseNP(i === 1)}
              className={`px-2 py-0.5 transition-colors ${
                (i === 1) === useNP
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* All-time summary tiles */}
      {data && (
        <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 space-y-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-1">
            All-Time Summary
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Tile label="Avg Annual" value={fmtPct(avgAnnual)} color={avgAnnual >= 0 ? '#22c55e' : '#ef4444'} />
            <Tile label="Bull Years" value={posYears} color="#22c55e" />
            <Tile label="Bear Years" value={negYears} color="#ef4444" />
            <Tile label="Years Data"  value={annualRows.length} />
          </div>
          {maxAnnual != null && (
            <div className="grid grid-cols-2 gap-1.5">
              <Tile label="Best Year"  value={fmtPct(maxAnnual)} color="#4ade80" />
              <Tile label="Worst Year" value={fmtPct(minAnnual)} color="#f87171" />
            </div>
          )}
        </div>
      )}

      {/* Live streak */}
      {streakCount > 0 && (
        <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2">
            Live Streak
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black leading-none ${streakDir === 'positive' ? 'text-green-500' : 'text-red-400'}`}>
              {streakDir === 'positive' ? '▲' : '▼'}{streakCount}
            </span>
            <div className="text-[9px] text-gray-400 leading-relaxed">
              consecutive {streakDir}<br />
              month{streakCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Year spotlight */}
      {(curRow || prevRow) && (
        <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 space-y-2.5">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-600">
            Year Spotlight
          </div>
          {curRow && (
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-black text-blue-500">{curYear}</span>
                <span className={`text-sm font-black ${(curRow.annual ?? 0) >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {fmtPct(curRow.annual)}
                </span>
              </div>
              <Spark vals={curRow.months} color={dark ? '#4ade80' : '#16a34a'} h={30} />
            </div>
          )}
          {prevRow && (
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{curYear - 1}</span>
                <span className={`text-xs font-black ${(prevRow.annual ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(prevRow.annual)}
                </span>
              </div>
              <Spark vals={prevRow.months} color={dark ? '#60a5fa' : '#3b82f6'} h={24} />
            </div>
          )}
        </div>
      )}

      {/* Best / Worst month */}
      {bestMi >= 0 && (
        <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2">
            Seasonal Edge
          </div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900 p-2">
              <div className="text-[8px] text-green-500 font-bold uppercase mb-0.5">Best</div>
              <div className="text-[12px] font-black text-green-600">{MONTHS_EN[bestMi]}</div>
              <div className="text-[10px] font-bold text-green-500">{fmtPct(wAvg[bestMi])}</div>
              <div className="text-[8px] text-gray-400 mt-0.5">{wWinRate[bestMi]}% win rate</div>
            </div>
            <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 p-2">
              <div className="text-[8px] text-red-400 font-bold uppercase mb-0.5">Worst</div>
              <div className="text-[12px] font-black text-red-500">{MONTHS_EN[worstMi]}</div>
              <div className="text-[10px] font-bold text-red-400">{fmtPct(wAvg[worstMi])}</div>
              <div className="text-[8px] text-gray-400 mt-0.5">{wWinRate[worstMi]}% win rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Win rate by month */}
      <div className="shrink-0 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2.5">
          Win Rate / Month
        </div>
        <div className="space-y-1">
          {wWinRate.map((wr, i) => (
            <WinBar key={i} label={LABELS[i]} rate={wr} />
          ))}
        </div>
      </div>

      {/* Top / Bottom years */}
      {data?.best_years?.length > 0 && (
        <div className="shrink-0 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[8px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Top Years</div>
              {(data.best_years || []).slice(0, 5).map((y, i) => (
                <div key={y.year} className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] text-gray-500 dark:text-gray-500">
                    {i+1}. {y.year}
                    {recentSet.has(y.year) && <span className="ml-1 w-1 h-1 rounded-full bg-blue-400 inline-block align-middle" />}
                  </span>
                  <span className="text-[9px] font-bold text-green-500">{fmtPct(y.annual)}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[8px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Bottom</div>
              {(data.worst_years || []).slice(0, 5).map((y, i) => (
                <div key={y.year} className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] text-gray-500 dark:text-gray-500">{i+1}. {y.year}</span>
                  <span className="text-[9px] font-bold text-red-400">{fmtPct(y.annual)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Month OHLC chart (interactive) ───────────────────────────────────────────
function MonthChart({ candles, dark }) {
  const ref  = useRef(null)
  const cRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !candles?.length) return

    const chart = createChart(el, {
      width:  el.clientWidth  || 400,
      height: el.clientHeight || 200,
      layout: {
        background:  { color: 'transparent' },
        textColor:   dark ? '#94a3b8' : '#64748b',
        fontFamily:  'Inter, system-ui, sans-serif',
        fontSize:    10,
      },
      watermark: { visible: false },
      grid: {
        vertLines: { color: dark ? '#1e293b' : '#f1f5f9' },
        horzLines: { color: dark ? '#1e293b' : '#f1f5f9' },
      },
      crosshair:       { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: dark ? '#334155' : '#e2e8f0', minimumWidth: 50 },
      leftPriceScale:  { visible: false },
      timeScale: {
        borderColor: dark ? '#334155' : '#e2e8f0',
        timeVisible: false,
        tickMarkFormatter: () => '',
      },
      // Interactive — allow scroll and scale for analysis
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

    if (candles.length >= 2) {
      const hi  = candles.reduce((a, b) => b.high > a.high ? b : a)
      const lo  = candles.reduce((a, b) => b.low  < a.low  ? b : a)
      const mkrs = [{ time: hi.date, position: 'aboveBar', color: '#22c55e', shape: 'arrowDown', text: hi.high.toFixed(0) }]
      if (lo.date !== hi.date) mkrs.push({ time: lo.date, position: 'belowBar', color: '#ef4444', shape: 'arrowUp', text: lo.low.toFixed(0) })
      cs.setMarkers(mkrs.sort((a, b) => a.time.localeCompare(b.time)))
    }

    chart.timeScale().fitContent()
    cRef.current = chart

    const ro = new ResizeObserver(() => {
      if (ref.current && cRef.current)
        cRef.current.applyOptions({ width: ref.current.clientWidth, height: ref.current.clientHeight })
    })
    ro.observe(el)
    return () => { ro.disconnect(); chart.remove(); cRef.current = null }
  }, [candles, dark])

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
      <span className="text-[9px] text-gray-500 dark:text-gray-400 w-20 shrink-0 truncate">{short}</span>
      <div className="flex flex-1 items-center" style={{ height: 10 }}>
        <div className="flex-1 flex justify-end">
          {!isPos && <div className="h-2 rounded-l-sm" style={{ width: `${w}%`, background: color }} />}
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 shrink-0 mx-0.5" />
        <div className="flex-1 flex justify-start">
          {isPos && <div className="h-2 rounded-r-sm" style={{ width: `${w}%`, background: color }} />}
        </div>
      </div>
      <span className="text-[9px] font-bold w-11 text-right shrink-0" style={{ color }}>
        {fmtPct(ret)}
      </span>
    </div>
  )
}

// ─── Company list for a sector×month ─────────────────────────────────────────
function CompanyList({ sectorIndex, year, month, onClose }) {
  const [stocks,  setStocks]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!sectorIndex || !year || !month) return
    const ctrl = new AbortController()
    setLoading(true); setStocks(null); setError(null)
    getSectorMonthStocks({ sector_index: sectorIndex, year, month })
      .then(r => { if (!ctrl.signal.aborted) setStocks(r.data.stocks || []) })
      .catch(() => { if (!ctrl.signal.aborted) setError('Failed to load stocks') })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [sectorIndex, year, month])

  const maxAbs = stocks?.length ? Math.max(...stocks.map(s => Math.abs(s.return_pct ?? 0)), 0.1) : 1
  const shortName = sectorIndex.replace(' Sub-Index','').replace(' Index','')

  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/60">
        <span className="text-[10px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-wide">{shortName}</span>
        <button onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">×</button>
      </div>
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && <div className="px-3 py-3 text-[10px] text-red-400">{error}</div>}
      {!loading && !error && stocks?.length === 0 && (
        <div className="px-3 py-3 text-[10px] text-gray-400">No stock data for this period.</div>
      )}
      {!loading && !error && stocks?.length > 0 && (
        <div className="max-h-52 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/80">
              <tr>
                {['#','Symbol','Company','Return','Bar'].map(h => (
                  <th key={h} className="px-2 py-1 text-left text-[8px] font-bold uppercase tracking-wide text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocks.map((s, i) => {
                const color = sectorCol(s.return_pct)
                const barW  = maxAbs > 0 ? Math.abs(s.return_pct ?? 0) / maxAbs * 100 : 0
                return (
                  <tr key={s.symbol} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-2 py-1 text-[9px] text-gray-400 w-6">{i + 1}</td>
                    <td className="px-2 py-1"><span className="text-[10px] font-bold dark:text-gray-100">{s.symbol}</span></td>
                    <td className="px-2 py-1 max-w-[90px]"><span className="text-[9px] text-gray-500 truncate block">{s.company_name}</span></td>
                    <td className="px-2 py-1 text-right"><span className="text-[10px] font-bold tabular-nums" style={{ color }}>{fmtPct(s.return_pct)}</span></td>
                    <td className="px-2 py-1">
                      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${barW}%`, background: color }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Historical rank bar ───────────────────────────────────────────────────────
// Shows how this month's return ranks among all historical occurrences of the same calendar month
function HistoricalRank({ value, allYears, month }) {
  if (value == null || !allYears?.length) return null
  const hist = allYears
    .map(y => y.months[month - 1])
    .filter(v => v != null)
    .sort((a, b) => a - b)
  if (!hist.length) return null
  const rank     = hist.filter(v => v <= value).length
  const pct      = Math.round((rank / hist.length) * 100)
  const color    = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444'
  const min      = hist[0]
  const max      = hist[hist.length - 1]
  const pos      = max !== min ? ((value - min) / (max - min)) * 100 : 50

  return (
    <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
      <div className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
        Historical Rank ({MONTHS_FULL[month - 1]})
      </div>
      <div className="text-[9px] text-gray-500 dark:text-gray-400 mb-1">
        Ranks <span className="font-bold" style={{ color }}>{rank}/{hist.length}</span>
        {' '}({pct}th percentile) · better than {rank - 1} of {hist.length} past years
      </div>
      {/* Range bar with marker */}
      <div className="relative h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-visible mb-1">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pos}%`, background: color, opacity: 0.3 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm" style={{ left: `${pos}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[8px] text-gray-400">
        <span>{fmtPct(min)}</span>
        <span className="font-bold" style={{ color }}>{fmtPct(value)}</span>
        <span>{fmtPct(max)}</span>
      </div>
    </div>
  )
}

// ─── Right Detail Panel ───────────────────────────────────────────────────────
function DetailPanel({ cell, onClose, onNavigate, dark, allYears, indexId }) {
  const [tab,               setTab]               = useState('chart')
  const [loading,           setLoading]           = useState(false)
  const [candles,           setCandles]           = useState(null)
  const [stats,             setStats]             = useState(null)
  const [sectors,           setSectors]           = useState(null)
  const [available,         setAvailable]         = useState(true)
  const [dataError,         setDataError]         = useState(null)
  const [activeSectorIndex, setActiveSectorIndex] = useState(null)

  useEffect(() => {
    if (!cell) return
    const ctrl = new AbortController()
    setLoading(true); setCandles(null); setStats(null); setSectors(null)
    setAvailable(true); setDataError(null); setActiveSectorIndex(null); setTab('chart')

    Promise.all([
      getMonthDetail({ index_id: indexId, year: cell.year, month: cell.month }),
      getSectorMonth({ year: cell.year, month: cell.month }),
    ])
      .then(([det, sec]) => {
        if (ctrl.signal.aborted) return
        if (!det.data.available) { setAvailable(false); return }
        setCandles(det.data.candles || [])
        setStats(det.data.stats || null)
        setSectors(sec.data.sectors || [])
      })
      .catch(err => {
        if (ctrl.signal.aborted) return
        const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to load data'
        setDataError(msg)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [cell?.year, cell?.month, indexId])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const bg     = cell ? cellBg(cell.value, dark) : (dark ? '#1e293b' : '#f1f5f9')
  const fg     = cell ? cellFg(cell.value, dark) : (dark ? '#94a3b8' : '#64748b')
  const maxAbs = sectors?.length ? Math.max(...sectors.map(s => Math.abs(s.return_pct ?? 0)), 0.1) : 1

  // If no cell selected, show collapsed placeholder
  if (!cell) {
    return (
      <div className="w-10 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-center">
        <span className="text-[8px] text-gray-300 dark:text-gray-700 writing-mode-vertical rotate-90 whitespace-nowrap select-none">
          Click a cell
        </span>
      </div>
    )
  }

  return (
    <div className="w-[300px] shrink-0 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700/60 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-1">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: bg }} />
              <span className="text-[10px] font-black text-gray-900 dark:text-white leading-none">
                {MONTHS_FULL[cell.month - 1]} {cell.year}
              </span>
            </div>
            <div className="text-lg font-black leading-none" style={{ color: fg }}>
              {fmtPct(cell.value, 2)}
            </div>
          </div>
          <button onClick={onClose}
            className="mt-0.5 w-5 h-5 flex items-center justify-center rounded text-gray-400
              hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm leading-none transition-colors shrink-0">
            ×
          </button>
        </div>
        {/* Month navigation */}
        <div className="flex items-center gap-1 mt-2">
          <button onClick={() => onNavigate(-1)}
            className="flex-1 py-0.5 text-[9px] font-bold rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            ← Prev
          </button>
          <button onClick={() => onNavigate(1)}
            className="flex-1 py-0.5 text-[9px] font-bold rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Next →
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!loading && !dataError && available && (
        <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
          {[['chart','Price'],['sectors','Sectors']].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
                tab === id
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Network error */}
        {!loading && dataError && (
          <div className="p-4 text-center">
            <div className="text-[10px] text-red-400 mb-1">{dataError}</div>
            <div className="text-[9px] text-gray-400">Try clicking the cell again</div>
          </div>
        )}

        {/* No data (pre-2021 or missing) */}
        {!loading && !dataError && !available && (
          <div className="p-4 text-center">
            <div className="text-xl mb-1">📂</div>
            <div className="text-[10px] text-gray-400 leading-relaxed">
              Daily chart data is only available from 2021.<br />
              The heatmap return is from historical records.
            </div>
          </div>
        )}

        {/* Chart tab */}
        {!loading && !dataError && available && tab === 'chart' && (
          <div>
            <div style={{ height: 200 }} className="bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
              {candles?.length
                ? <MonthChart candles={candles} dark={dark} />
                : <div className="h-full flex items-center justify-center text-xs text-gray-400">No candle data</div>}
            </div>

            {stats && (
              <div className="p-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  {[
                    ['Open',  stats.month_open?.toFixed(1),  null],
                    ['Close', stats.month_close?.toFixed(1), null],
                    ['High',  stats.month_high?.toFixed(1),  '#22c55e'],
                    ['Low',   stats.month_low?.toFixed(1),   '#ef4444'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="rounded bg-gray-50 dark:bg-gray-800/80 px-2 py-1.5">
                      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{l}</div>
                      <div className="text-[10px] font-black mt-0.5"
                        style={{ color: c || (dark ? '#e2e8f0' : '#1e293b') }}>
                        {v ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <div className="rounded bg-gray-50 dark:bg-gray-800/80 px-2 py-1.5">
                    <div className="text-[8px] text-gray-400 uppercase tracking-wide">Ret</div>
                    <div className="text-[10px] font-black mt-0.5" style={{ color: (stats.month_return ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                      {fmtPct(stats.month_return, 2)}
                    </div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-800/80 px-2 py-1.5">
                    <div className="text-[8px] text-gray-400 uppercase tracking-wide">Range</div>
                    <div className="text-[10px] font-black text-gray-700 dark:text-gray-200 mt-0.5">
                      {stats.range_pct != null ? fmtPct(stats.range_pct) : '—'}
                    </div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-800/80 px-2 py-1.5">
                    <div className="text-[8px] text-gray-400 uppercase tracking-wide">Days</div>
                    <div className="text-[10px] font-black text-gray-700 dark:text-gray-200 mt-0.5">
                      {stats.trading_days ?? '—'}
                    </div>
                  </div>
                </div>

                {(stats.best_day || stats.worst_day) && (
                  <div className="space-y-1 pt-1.5 border-t border-gray-100 dark:border-gray-800">
                    {stats.best_day && (
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-gray-400">Best day</span>
                        <span className="font-bold text-green-500">
                          {stats.best_day.date.slice(5)} · {fmtPct(stats.best_day.pct)}
                        </span>
                      </div>
                    )}
                    {stats.worst_day && (
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-gray-400">Worst day</span>
                        <span className="font-bold text-red-400">
                          {stats.worst_day.date.slice(5)} · {fmtPct(stats.worst_day.pct)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Historical rank — always shown if we have value */}
            <HistoricalRank value={cell.value} allYears={allYears} month={cell.month} />
          </div>
        )}

        {/* Sectors tab */}
        {!loading && !dataError && available && tab === 'sectors' && (
          <div>
            <div className="p-2.5">
              <div className="text-[8px] text-gray-400 uppercase tracking-widest mb-1.5 font-bold">
                {MONTHS_FULL[cell.month - 1]} {cell.year} · click a sector to see stocks
              </div>
              <div className="space-y-0.5">
                {(sectors || []).map(s => {
                  const isActive = activeSectorIndex === s.name
                  return (
                    <div key={s.index_id}>
                      <button
                        onClick={() => setActiveSectorIndex(isActive ? null : s.name)}
                        className={`w-full text-left rounded px-1.5 py-1 transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-800'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                      >
                        <SectorBar name={s.name} ret={s.return_pct} maxAbs={maxAbs} />
                      </button>
                      {isActive && (
                        <CompanyList
                          sectorIndex={s.name}
                          year={cell.year}
                          month={cell.month}
                          onClose={() => setActiveSectorIndex(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              {sectors?.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-gray-400">Best</span>
                    <span className="font-bold text-green-500">
                      {sectors[0].name.replace(' Sub-Index','').replace(' Index','')} {fmtPct(sectors[0].return_pct)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-gray-400">Worst</span>
                    <span className="font-bold text-red-400">
                      {sectors[sectors.length-1].name.replace(' Sub-Index','').replace(' Index','')} {fmtPct(sectors[sectors.length-1].return_pct)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-2.5 py-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[8px] text-gray-300 dark:text-gray-700">Esc to close · ← → to navigate</span>
      </div>
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
      <span className={`text-[9px] font-bold w-8 shrink-0 text-right ${
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
      <span className="text-[9px] font-bold w-11 text-right shrink-0" style={{ color }}>
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
  const [useNP,           setUseNP]           = useState(false)
  const [selected,        setSelected]        = useState(null)
  const [selectedIndexId, setSelectedIndexId] = useState(12)
  const [yearFilter,      setYearFilter]      = useState('all') // 'all' | '10' | '5'

  const doFetch = useCallback(async (indexId) => {
    setLoading(true); setError(''); setData(null); setSelected(null)
    try {
      const r = await getMonthlyReturns({ index_id: indexId })
      setData(r.data)
      if (r.data?.latest_data_date && r.data?.years?.length) {
        const dt  = new Date(r.data.latest_data_date)
        const yr  = dt.getFullYear()
        const mo  = dt.getMonth() + 1
        const row = r.data.years.find(y => y.year === yr)
        const val = row?.months?.[mo - 1] ?? null
        setSelected({ year: yr, month: mo, value: val })
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { doFetch(selectedIndexId) }, [selectedIndexId, doFetch])

  const allYears   = data?.years || []
  const latestDate = data?.latest_data_date || null
  const latestDt   = latestDate ? new Date(latestDate) : new Date()
  const curYear    = latestDt.getFullYear()
  const curMon     = latestDt.getMonth() + 1

  // Year range filter
  const years = allYears.filter(y => {
    if (yearFilter === '5')  return y.year >= curYear - 4
    if (yearFilter === '10') return y.year >= curYear - 9
    return true
  })

  const recentSet = new Set(allYears.slice(0, RECENT_N).map(y => y.year))
  const wAvg      = years.length ? weightedAvg(years)     : (data?.month_averages  || [])
  const wWinRate  = years.length ? weightedWinRate(years) : (data?.month_win_rates || [])

  const LABELS = useNP ? MONTHS_NP : MONTHS_EN
  const curRow = allYears.find(y => y.year === curYear)
  const prevRow = allYears.find(y => y.year === curYear - 1)

  const handleCell = useCallback((year, month, value) => {
    setSelected(p => p?.year === year && p?.month === month ? null : { year, month, value })
  }, [])

  // Navigate to prev/next month from the detail panel
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
  }, [selected, allYears])

  // Keyboard: arrow keys navigate heatmap, Escape closes detail
  useEffect(() => {
    const h = e => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); handleNavigate(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNavigate(1) }
      if (e.key === 'Escape')     setSelected(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleNavigate])

  const annualRows = years.filter(y => y.annual != null)

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 bg-white dark:bg-gray-950">

      {/* ── Left Panel ───────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[220px] border-r border-gray-100 dark:border-gray-800
        bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-hidden">
        {loading && !data ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
            <div>
              <div className="text-red-400 text-xs mb-2">{error}</div>
              <button onClick={() => doFetch(selectedIndexId)}
                className="text-[10px] text-blue-500 underline">Retry</button>
            </div>
          </div>
        ) : (
          <LeftInsightPanel
            data={data}
            years={years}
            wAvg={wAvg}
            wWinRate={wWinRate}
            dark={dark}
            curYear={curYear}
            curRow={curRow}
            prevRow={prevRow}
            recentSet={recentSet}
            useNP={useNP}
            setUseNP={setUseNP}
            LABELS={LABELS}
            selectedIndexId={selectedIndexId}
            setSelectedIndexId={(id) => { setSelectedIndexId(id) }}
          />
        )}
      </div>

      {/* ── Center ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">

        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5
          border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">
              Monthly Returns
            </span>
            <span className="text-[9px] text-gray-400 dark:text-gray-600 font-medium">
              {INDEX_OPTIONS.find(o => o.id === selectedIndexId)?.label}
            </span>
            {latestDate && (
              <span className="text-[9px] text-gray-300 dark:text-gray-700">· {latestDate}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Year filter */}
            <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-700 text-[8px] font-bold">
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
            {selected && (
              <button onClick={() => setSelected(null)}
                className="text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-0.5
                  border border-gray-200 dark:border-gray-700 rounded transition-colors">
                × Clear
              </button>
            )}
            <button onClick={() => doFetch(selectedIndexId)} disabled={loading}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700
                text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors text-xs">
              {loading ? '·' : '↻'}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <div style={{ minWidth: 520 }}>

            {loading && !data && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-400">Loading data…</span>
              </div>
            )}

            {/* Heatmap */}
            {data && (
              <div className="px-3 pt-2.5">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left pb-1.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-950
                        text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wide w-10">
                        Year
                      </th>
                      {LABELS.map((m, i) => (
                        <th key={i} className="pb-1.5 text-center text-[9px] font-bold
                          text-gray-400 dark:text-gray-600 uppercase tracking-wide px-px min-w-[34px]">
                          {m}
                        </th>
                      ))}
                      <th className="pb-1.5 text-right text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wide pl-2 pr-1 min-w-[44px]">
                        YTD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((row) => {
                      const isRecent = recentSet.has(row.year)
                      const isLatest = row.year === curYear
                      const opacity  = isRecent ? 1.0 : 0.6
                      return (
                        <tr key={row.year}
                          style={{ opacity }}
                          className="hover:opacity-100 transition-opacity duration-150">
                          <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-950">
                            <div className="flex items-center gap-1">
                              {isLatest ? (
                                <span className="text-[11px] font-black text-blue-500 leading-none">{row.year}</span>
                              ) : isRecent ? (
                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 leading-none">{row.year}</span>
                              ) : (
                                <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-600 leading-none">{row.year}</span>
                              )}
                              {isLatest && <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />}
                            </div>
                          </td>
                          {row.months.map((val, mi) => {
                            const isCur = row.year === curYear && mi + 1 === curMon
                            const isSel = selected?.year === row.year && selected?.month === mi + 1
                            return (
                              <td key={mi} className="py-0.5 px-px">
                                <button
                                  onClick={() => handleCell(row.year, mi + 1, val)}
                                  disabled={val == null}
                                  className={[
                                    'w-full rounded text-[10px] font-bold select-none transition-all duration-100 leading-none',
                                    val != null ? 'cursor-pointer hover:scale-110 hover:shadow-sm' : 'cursor-default opacity-20',
                                    isSel ? 'scale-110 shadow-md ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-950 z-10' : '',
                                  ].join(' ')}
                                  style={{
                                    background:    cellBg(val, dark),
                                    color:         cellFg(val, dark),
                                    padding:       '3px 1px',
                                    minWidth:      34,
                                    outline:       isCur ? '2px solid #60a5fa' : undefined,
                                    outlineOffset: isCur ? '1px' : undefined,
                                  }}>
                                  {val != null ? fmtPct(val) : '·'}
                                </button>
                              </td>
                            )
                          })}
                          {/* Annual return */}
                          <td className="py-0.5 pl-2 pr-1">
                            <div className="text-right text-[9px] font-black"
                              style={{ color: (row.annual ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                              {row.annual != null ? fmtPct(row.annual) : '—'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Weighted Avg row */}
                    {wAvg.some(v => v != null) && (
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                        <td className="py-1 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-950">
                          <span className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wide">Avg</span>
                        </td>
                        {wAvg.map((v, i) => (
                          <td key={i} className="py-0.5 px-px">
                            <div className="w-full rounded text-center text-[9px] font-black"
                              style={{ background: cellBg(v, dark), color: cellFg(v, dark), padding: '2px 1px', opacity: 0.9 }}>
                              {v != null ? fmtPct(v) : '—'}
                            </div>
                          </td>
                        ))}
                        <td />
                      </tr>
                    )}

                    {/* Win rate row */}
                    {wWinRate.some(v => v != null) && (
                      <tr>
                        <td className="py-0.5 pr-2 sticky left-0 z-10 bg-white dark:bg-gray-950">
                          <span className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wide">Win%</span>
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
                              <div className="w-full rounded text-center text-[9px] font-black"
                                style={{ background: bg, color, padding: '2px 1px' }}>
                                {v != null ? v + '%' : '—'}
                              </div>
                            </td>
                          )
                        })}
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-1.5 mb-3 text-[8px] text-gray-400 dark:text-gray-600 px-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
                    <span className="text-blue-400 font-bold">{curYear}</span> = live
                  </span>
                  <span>Recent {RECENT_N}yr full opacity</span>
                  <span>Avg = weighted ({RECENT_N}yr = 2×)</span>
                  <span>YTD = annual so far</span>
                  <span className="ml-auto text-gray-300 dark:text-gray-700">← → arrow keys navigate · click cell for detail</span>
                </div>
              </div>
            )}

            {/* Analytics strip — Annual performance only (removed duplicate SeasonGrid) */}
            {data && !loading && (
              <div className="px-3 pb-6 space-y-3">
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <span className="text-[8px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-widest px-2">Annual Performance</span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800/50">
                  <div className="text-[9px] text-gray-400 dark:text-gray-600 mb-2">
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

      {/* ── Right Detail Panel ───────────────────────────────────────────── */}
      <DetailPanel
        cell={selected}
        onClose={() => setSelected(null)}
        onNavigate={handleNavigate}
        dark={dark}
        allYears={allYears}
        indexId={selectedIndexId}
      />
    </div>
  )
}
