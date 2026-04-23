import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { BASE_URL } from '../../api'

const getToken = () => localStorage.getItem('token')
const API = `${BASE_URL}/api`

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const INDEX_OPTIONS = [
  { id: 12, label: 'NEPSE',       short: 'NEPSE'    },
  { id: 1,  label: 'Commercial Bank',           short: 'Bank'     },
  { id: 2,  label: 'Development Bank',          short: 'DevBank'  },
  { id: 3,  label: 'Finance',                   short: 'Finance'  },
  { id: 4,  label: 'Microfinance',              short: 'MFI'      },
  { id: 5,  label: 'Life Insurance',            short: 'Life'     },
  { id: 6,  label: 'Non-Life Insurance',        short: 'Non-Life' },
  { id: 7,  label: 'Hydropower',                short: 'Hydro'    },
  { id: 8,  label: 'Manufacturing & Processing',short: 'Mfg'      },
  { id: 9,  label: 'Hotel & Tourism',           short: 'Hotel'    },
  { id: 10, label: 'Trading',                   short: 'Trading'  },
  { id: 11, label: 'Investment',                short: 'Invest'   },
]

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct == null) return '#6b7280'
  if (pct >= 0)    return '#10b981'
  if (pct > -12)   return '#f59e0b'
  if (pct > -25)   return '#ef4444'
  return '#b91c1c'
}
function pctTextCls(pct) {
  if (pct == null) return 'text-gray-400'
  if (pct >= 0)    return 'text-emerald-500'
  if (pct > -12)   return 'text-amber-500'
  if (pct > -25)   return 'text-red-500'
  return 'text-red-700 dark:text-red-400'
}
function heatColor(pct, dark) {
  if (pct == null) return dark ? '#1f2937' : '#f9fafb'
  if (pct >=  15) return dark ? '#064e3b' : '#d1fae5'
  if (pct >=   5) return dark ? '#065f46' : '#a7f3d0'
  if (pct >=   0) return dark ? '#166534' : '#dcfce7'
  if (pct >  -5)  return dark ? '#7f1d1d' : '#fee2e2'
  if (pct > -15)  return dark ? '#991b1b' : '#fca5a5'
  return                dark ? '#450a0a' : '#fecaca'
}
function phaseCls(phase) {
  const m = {
    'Crash':       'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
    'Bear Market': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    'Correction':  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
    'Major Bull':  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    'Bull Run':    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800',
    'Rally':       'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  }
  return m[phase] || 'bg-gray-100 dark:bg-gray-800 text-gray-500'
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE CHART — SVG candlestick with hover tooltip, Y-axis, coloured zone
// ─────────────────────────────────────────────────────────────────────────────
function PriceChart({ candles, startDate, endDate, type = 'bear', dark, label = '', height = 260 }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const VW = 900, VH = height
  const PAD = { top: 24, bottom: 34, left: 56, right: 14 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom

  const candleW = Math.max(1, Math.min(8, Math.floor(chartW / Math.max(candles?.length || 1, 1)) - 1))

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx = Math.round(relX / chartW * (candles.length - 1))
    setHover(Math.max(0, Math.min(candles.length - 1, idx)))
  }, [candles, chartW])

  if (!candles?.length) return (
    <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: VH }}>
      No chart data
    </div>
  )

  const hasWicks = candles.some(c => c.high != null && c.low != null)
  const allHigh  = candles.map(c => hasWicks ? +c.high  : Math.max(+(c.open ?? c.close), +c.close))
  const allLow   = candles.map(c => hasWicks ? +c.low   : Math.min(+(c.open ?? c.close), +c.close))
  const maxV = Math.max(...allHigh)
  const minV = Math.min(...allLow)
  const span = maxV - minV || 1

  const cx = i => PAD.left + (i / Math.max(1, candles.length - 1)) * chartW
  const cy = v => PAD.top  + (1 - (+v - minV) / span) * chartH

  const si = candles.findIndex(c => c.date >= startDate)
  const ei = candles.findIndex(c => c.date >= endDate)
  const zoneStart = si >= 0 ? si : 0
  const zoneEnd   = ei >= 0 ? ei : candles.length - 1

  const zoneColor = type === 'bull' ? '#10b981' : '#ef4444'
  const zoneBg    = type === 'bull' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = minV + (i / 4) * span
    return { v, y: cy(v) }
  })

  const dateTick = [...new Set([0, zoneStart, zoneEnd, candles.length - 1])]
    .filter(i => i >= 0 && i < candles.length)

  const hoverCandle = hover !== null ? candles[hover] : null
  const hoverX      = hover !== null ? cx(hover) : null

  const zStartClose = +candles[zoneStart]?.close
  const zEndClose   = +candles[zoneEnd]?.close

  return (
    <div className="relative w-full select-none" style={{ height: VH }}>
      <svg
        ref={svgRef}
        width="100%" height="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH}
          fill={dark ? '#0f172a' : '#fafafa'} rx="2" />

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + chartW} y2={t.y}
              stroke={dark ? '#1e293b' : '#e5e7eb'} strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize="11" fontFamily="monospace"
              fill={dark ? '#475569' : '#94a3b8'}>
              {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
        ))}

        <rect x={cx(zoneStart)} y={PAD.top}
          width={Math.max(0, cx(zoneEnd) - cx(zoneStart))} height={chartH}
          fill={zoneBg} />
        <line x1={cx(zoneStart)} y1={PAD.top} x2={cx(zoneStart)} y2={PAD.top + chartH}
          stroke={zoneColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
        <line x1={cx(zoneEnd)} y1={PAD.top} x2={cx(zoneEnd)} y2={PAD.top + chartH}
          stroke={zoneColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />

        {candles.map((c, i) => {
          const x     = cx(i)
          const open  = +(c.open  ?? c.close)
          const close = +c.close
          const high  = hasWicks ? +c.high  : Math.max(open, close)
          const low   = hasWicks ? +c.low   : Math.min(open, close)
          const isUp  = close >= open
          const inZone = i >= zoneStart && i <= zoneEnd

          let bodyColor, wickColor
          if (inZone) {
            bodyColor = isUp ? '#10b981' : '#ef4444'
            wickColor = bodyColor
          } else {
            bodyColor = isUp ? (dark ? '#1d4a34' : '#bbf7d0') : (dark ? '#4a1d1d' : '#fecaca')
            wickColor = isUp ? (dark ? '#22c55e' : '#16a34a') : (dark ? '#ef4444' : '#dc2626')
          }
          const bodyTop = cy(Math.max(open, close))
          const bodyBot = cy(Math.min(open, close))
          const bodyH   = Math.max(1, bodyBot - bodyTop)

          return (
            <g key={i} opacity={hover === i ? 1 : 0.92}>
              <line x1={x} y1={cy(high)} x2={x} y2={cy(low)}
                stroke={wickColor} strokeWidth={hover === i ? 1.5 : 1} />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                fill={bodyColor}
                stroke={hover === i ? (dark ? '#fff' : '#1e293b') : 'none'}
                strokeWidth={0.5} rx="0.5" />
            </g>
          )
        })}

        {/* Zone price labels */}
        {!isNaN(zStartClose) && (
          <text x={cx(zoneStart)} y={PAD.top - 8} textAnchor="middle"
            fontSize="11" fontWeight="700" fill={zoneColor}>
            {zStartClose.toFixed(0)}
          </text>
        )}
        {!isNaN(zEndClose) && (
          <text x={cx(zoneEnd)} y={PAD.top - 8} textAnchor="middle"
            fontSize="11" fontWeight="700" fill={zoneColor}>
            {zEndClose.toFixed(0)}
          </text>
        )}

        {/* % annotation */}
        {zoneEnd > zoneStart + 6 && !isNaN(zStartClose) && !isNaN(zEndClose) && (() => {
          const midX = (cx(zoneStart) + cx(zoneEnd)) / 2
          const midY = (cy(zStartClose) + cy(zEndClose)) / 2
          const pct  = (zEndClose - zStartClose) / zStartClose * 100
          return (
            <>
              <rect x={midX - 28} y={midY - 11} width={56} height={20}
                rx="6" fill={dark ? '#0f172a' : 'white'} opacity="0.92"
                stroke={zoneColor} strokeWidth="1" />
              <text x={midX} y={midY + 4} textAnchor="middle"
                fontSize="11" fontWeight="800" fill={zoneColor}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
              </text>
            </>
          )
        })()}

        {/* Date axis */}
        <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
          stroke={dark ? '#1e293b' : '#e5e7eb'} strokeWidth="1" />
        {dateTick.map(idx => (
          <g key={idx}>
            <line x1={cx(idx)} y1={PAD.top + chartH} x2={cx(idx)} y2={PAD.top + chartH + 4}
              stroke={dark ? '#475569' : '#94a3b8'} strokeWidth="1" />
            <text x={cx(idx)} y={VH - 4} textAnchor="middle" fontSize="10"
              fill={dark ? '#64748b' : '#94a3b8'}>
              {candles[idx]?.date?.slice(2, 10)}
            </text>
          </g>
        ))}

        {/* Crosshair */}
        {hover !== null && hoverCandle && (
          <g>
            <line x1={hoverX} y1={PAD.top} x2={hoverX} y2={PAD.top + chartH}
              stroke={dark ? '#64748b' : '#94a3b8'} strokeWidth="1" strokeDasharray="4,3" />
            <line x1={PAD.left} y1={cy(hoverCandle.close)} x2={PAD.left + chartW} y2={cy(hoverCandle.close)}
              stroke={dark ? '#64748b' : '#94a3b8'} strokeWidth="1" strokeDasharray="4,3" />
          </g>
        )}

        {label && (
          <text x={PAD.left + 6} y={PAD.top + 14} fontSize="11" fontWeight="700"
            fill={dark ? '#475569' : '#94a3b8'}>{label}</text>
        )}
      </svg>

      {/* Tooltip */}
      {hover !== null && hoverCandle && (
        <div className="pointer-events-none absolute top-2 z-30 text-[11px] rounded-xl px-3 py-2.5 shadow-xl border whitespace-nowrap"
          style={{
            left:  hoverX > VW * 0.6 ? undefined : `calc(${(hoverX / VW) * 100}% + 10px)`,
            right: hoverX > VW * 0.6 ? `calc(${((VW - hoverX) / VW) * 100}% + 10px)` : undefined,
            background: dark ? '#1e293b' : 'white',
            borderColor: dark ? '#334155' : '#e5e7eb',
            color: dark ? '#f1f5f9' : '#1e293b',
          }}>
          <div className="font-semibold mb-1 text-[10px]" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
            {hoverCandle.date}
          </div>
          {hasWicks && hoverCandle.high != null && (
            <div className="flex gap-3 text-[10px] mb-1">
              <span className="text-gray-400">H <span className="font-semibold">{(+hoverCandle.high).toLocaleString()}</span></span>
              <span className="text-gray-400">L <span className="font-semibold">{(+hoverCandle.low).toLocaleString()}</span></span>
            </div>
          )}
          <div className="flex gap-3 text-[10px]">
            <span className="text-gray-400">O <span className="font-semibold">{(+(hoverCandle.open ?? hoverCandle.close)).toLocaleString()}</span></span>
            <span className="text-gray-400">C <span className="font-bold text-[13px]">{(+hoverCandle.close).toLocaleString()}</span></span>
          </div>
          {(hoverCandle.per_change != null || hoverCandle.diff_pct != null) && (
            <div className={`text-[10px] mt-1 font-semibold ${(+(hoverCandle.per_change ?? hoverCandle.diff_pct)) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {(+(hoverCandle.per_change ?? hoverCandle.diff_pct)) >= 0 ? '+' : ''}
              {(+(hoverCandle.per_change ?? hoverCandle.diff_pct)).toFixed(2)}%
            </div>
          )}
          {hover >= zoneStart && hover <= zoneEnd && (
            <div style={{ color: zoneColor }} className="text-[10px] mt-0.5 font-medium">
              {type === 'bear' ? 'Drop' : 'Run'} day {hover - zoneStart + 1}
            </div>
          )}
          {hover > zoneEnd && (
            <div className="text-[10px] mt-0.5 text-emerald-500">Recovery day {hover - zoneEnd}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW CHART — full NEPSE history with cycle bands
// ─────────────────────────────────────────────────────────────────────────────
function OverviewChart({ candles, cycles, activeCycle, onCycleClick, dark }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const VW = 1000, VH = 240
  const PAD = { top: 18, bottom: 34, left: 54, right: 14 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx  = Math.round(relX / chartW * (candles.length - 1))
    setHover(Math.max(0, Math.min(candles.length - 1, idx)))
  }, [candles, chartW])

  const handleClick = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx  = Math.round(relX / chartW * (candles.length - 1))
    const date = candles[Math.max(0, Math.min(candles.length - 1, idx))]?.date
    if (!date) return
    const hit = cycles.find(c => date >= c.start_date && date <= c.end_date)
    if (hit) onCycleClick(hit)
  }, [candles, cycles, chartW, onCycleClick])

  if (!candles?.length) return null

  const allVals = candles.flatMap(c => [+(c.open ?? c.close), +c.close])
  const minV    = Math.min(...allVals)
  const maxV    = Math.max(...allVals)
  const span    = maxV - minV || 1
  const candleW = Math.max(1, Math.min(3, Math.floor(chartW / Math.max(candles.length, 1)) - 0.5))

  const cx = i => PAD.left + (i / Math.max(1, candles.length - 1)) * chartW
  const cy = v => PAD.top  + (1 - (+v - minV) / span) * chartH

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    v: minV + f * span, y: cy(minV + f * span),
  }))

  return (
    <div className="relative w-full select-none" style={{ height: VH }}>
      <svg
        ref={svgRef}
        width="100%" height="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + chartW} y2={t.y}
              stroke={dark ? '#1e293b' : '#f1f5f9'} strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize="11"
              fontFamily="monospace" fill={dark ? '#475569' : '#94a3b8'}>
              {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
        ))}

        {cycles.map((cyc, i) => {
          const si = candles.findIndex(c => c.date >= cyc.start_date)
          const ei = candles.findIndex(c => c.date >= cyc.end_date)
          if (si < 0 || ei < 0) return null
          const isActive = activeCycle?.start_date === cyc.start_date
          const fill = cyc.type === 'bull'
            ? (isActive ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.1)')
            : (isActive ? 'rgba(239,68,68,0.28)'  : 'rgba(239,68,68,0.1)')
          return (
            <rect key={i} x={cx(si)} y={PAD.top}
              width={Math.max(2, cx(ei) - cx(si))} height={chartH}
              fill={fill} rx="0" />
          )
        })}

        {candles.map((c, i) => {
          const x      = cx(i)
          const open   = +(c.open ?? c.close)
          const close  = +c.close
          const isUp   = close >= open
          const inZone = cycles.some(cyc => c.date >= cyc.start_date && c.date <= cyc.end_date)
          const color  = isUp ? (dark ? '#22c55e' : '#16a34a') : (dark ? '#ef4444' : '#dc2626')
          const muted  = isUp ? (dark ? '#14532d' : '#bbf7d0') : (dark ? '#450a0a' : '#fecaca')
          return (
            <line key={i} x1={x} y1={cy(Math.max(open, close))} x2={x} y2={cy(Math.min(open, close))}
              stroke={inZone ? color : muted} strokeWidth={Math.max(1, candleW)} />
          )
        })}

        {hover !== null && (
          <line x1={cx(hover)} y1={PAD.top} x2={cx(hover)} y2={PAD.top + chartH}
            stroke={dark ? '#64748b' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3,2" />
        )}

        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const idx = Math.round(f * (candles.length - 1))
          return (
            <text key={i} x={cx(idx)} y={VH - 4} textAnchor="middle" fontSize="10"
              fill={dark ? '#64748b' : '#94a3b8'}>
              {candles[idx]?.date?.slice(0, 7)}
            </text>
          )
        })}
      </svg>

      {hover !== null && candles[hover] && (
        <div className="pointer-events-none absolute top-2 z-20 text-[11px] rounded-xl px-3 py-2 shadow-xl border whitespace-nowrap"
          style={{
            left:  cx(hover) / VW * 100 > 60 ? undefined : `calc(${cx(hover) / VW * 100}% + 8px)`,
            right: cx(hover) / VW * 100 > 60 ? `calc(${(VW - cx(hover)) / VW * 100}% + 8px)` : undefined,
            background: dark ? '#1e293b' : 'white',
            borderColor: dark ? '#334155' : '#e5e7eb',
            color: dark ? '#f1f5f9' : '#1e293b',
          }}>
          <div className="font-semibold text-[10px] mb-1" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
            {candles[hover].date}
          </div>
          <div className="flex gap-3 text-[10px]">
            <span className="text-gray-400">O <span className="font-semibold">{(+(candles[hover].open ?? candles[hover].close)).toLocaleString()}</span></span>
            <span className="text-gray-400">C <span className="font-bold text-[13px]">{(+candles[hover].close).toLocaleString()}</span></span>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 right-0 flex items-center gap-3 text-[9px] px-2 pb-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'rgba(239,68,68,0.4)' }} />
          <span className="text-gray-400">Bear/Drop</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'rgba(16,185,129,0.4)' }} />
          <span className="text-gray-400">Bull/Rally</span>
        </span>
        <span className="text-gray-400">Click a shaded zone to analyze</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR HEATMAP — sector × month returns for a specific year
// ─────────────────────────────────────────────────────────────────────────────
function SectorHeatmap({ year, dark }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!year) return
    setLoading(true)
    setError('')
    const token = getToken()
    fetch(`${API}/breakdown/sector-year?year=${year}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [year])

  if (loading) return (
    <div className="flex items-center justify-center py-6 text-[11px] text-gray-400">Loading sector heatmap…</div>
  )
  if (error) return (
    <div className="px-3 py-2 text-[11px] text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg">{error}</div>
  )
  if (!data?.sectors?.length) return (
    <div className="flex items-center justify-center py-6 text-[11px] text-gray-400">No sector data for {year}</div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-400 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-950 z-10">Sector</th>
            {MONTHS.map(m => (
              <th key={m} className="px-1 py-1.5 text-center text-[9px] font-semibold text-gray-400 min-w-[38px]">{m}</th>
            ))}
            <th className="px-2 py-1.5 text-center text-[9px] font-semibold text-gray-400">Annual</th>
          </tr>
        </thead>
        <tbody>
          {data.sectors.map(s => (
            <tr key={s.index_id} className="border-t border-gray-50 dark:border-gray-900">
              <td className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-950 z-10 max-w-[110px] truncate">
                {s.name.replace(' Sub-Index', '').replace(' Index', '')}
              </td>
              {s.months.map((pct, mi) => (
                <td key={mi} className="px-0.5 py-0.5 text-center">
                  <div
                    className="rounded text-[9px] font-semibold tabular-nums py-0.5 mx-0.5"
                    style={{
                      background: heatColor(pct, dark),
                      color: pct == null ? (dark ? '#4b5563' : '#d1d5db') : (dark ? '#f1f5f9' : '#1e293b'),
                      minWidth: 34,
                    }}
                  >
                    {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}` : '—'}
                  </div>
                </td>
              ))}
              <td className="px-2 py-1 text-center">
                <span className={`text-[10px] font-bold tabular-nums ${pctTextCls(s.annual)}`}>
                  {s.annual != null ? `${s.annual >= 0 ? '+' : ''}${s.annual.toFixed(1)}%` : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────
function SectorRow({ sector, isActive, onClick, maxDropAbs, cycleType }) {
  const dropAbs = Math.abs(sector.drop_pct || 0)
  const barW    = maxDropAbs > 0 ? (dropAbs / maxDropAbs) * 100 : 0
  const isBull  = cycleType === 'bull'

  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors
        ${isActive ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pctColor(sector.drop_pct) }} />
          <span className="text-[11px] font-medium text-gray-800 dark:text-gray-100 leading-tight">
            {sector.index_name.replace(' Sub-Index', '').replace(' Index', '')}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${barW}%`, background: pctColor(sector.drop_pct) }} />
          </div>
          <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(sector.drop_pct)}`}>
            {sector.drop_pct != null ? `${sector.drop_pct >= 0 ? '+' : ''}${sector.drop_pct.toFixed(1)}%` : '—'}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {sector.vs_nepse != null && (
          <span className={`text-[10px] font-semibold tabular-nums ${sector.vs_nepse >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {sector.vs_nepse >= 0 ? '+' : ''}{sector.vs_nepse.toFixed(1)}%
          </span>
        )}
      </td>
      {!isBull && (
        <>
          <td className="px-3 py-2.5">
            <span className={`text-[10px] font-semibold tabular-nums ${pctTextCls(sector.recovery_pct)}`}>
              {sector.recovery_pct != null
                ? `${sector.recovery_pct >= 0 ? '+' : ''}${sector.recovery_pct.toFixed(1)}%`
                : '—'}
            </span>
          </td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-14 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${Math.min(100, sector.recovery_progress || 0)}%` }} />
              </div>
              <span className="text-[9px] text-gray-400 tabular-nums">
                {(sector.recovery_progress || 0).toFixed(0)}%
              </span>
            </div>
          </td>
          <td className="px-3 py-2.5">
            {sector.fully_recovered
              ? <span className="text-[10px] text-emerald-500 font-semibold">{sector.recovery_days}d</span>
              : <span className="text-[10px] text-gray-400">—</span>
            }
          </td>
        </>
      )}
      <td className="px-3 py-2.5">
        {sector.stock_count == null
          ? null
          : sector.stock_count === 0
            ? <span className="text-[9px] text-amber-400">—</span>
            : <span className="text-[9px] text-gray-400">{sector.stock_count}</span>
        }
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK LIST
// ─────────────────────────────────────────────────────────────────────────────
function StockList({ stocks, loading, onSelect, selected, dark }) {
  const [sortBy,  setSortBy]  = useState('drop_pct')
  const [sortAsc, setSortAsc] = useState(true)

  const toggleSort = col => {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(true) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8 text-[11px] text-gray-400">Loading stocks…</div>
  )
  if (stocks === undefined) return (
    <div className="flex items-center justify-center py-8 text-[11px] text-gray-400">Click a sector row to load stocks</div>
  )

  const valid = (stocks || []).filter(s => s.drop_pct != null)

  if (!stocks?.length) return (
    <div className="flex flex-col items-center justify-center py-8 gap-1 text-center px-4">
      <span className="text-[11px] text-gray-400">No stocks found for this sector.</span>
      <span className="text-[10px] text-gray-300 dark:text-gray-600">
        The company_master table may not be populated yet.
      </span>
    </div>
  )
  if (!valid.length) return (
    <div className="flex items-center justify-center py-8 text-[11px] text-gray-400">
      {stocks.length} stocks found, but no price data for this period.
    </div>
  )

  const sorted = [...valid].sort((a, b) => {
    const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const SortTh = ({ col, label, right }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`px-2 py-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {label}{sortBy === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 z-10">
          <tr>
            <th className="px-2 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-gray-400 w-6">#</th>
            <SortTh col="symbol" label="Symbol" />
            <SortTh col="drop_pct" label="Move %" right />
            <SortTh col="recovery_pct" label="Recov %" right />
            <SortTh col="recovery_progress" label="Progress" right />
            <SortTh col="recovery_days" label="Days" right />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.symbol}
              onClick={() => onSelect(selected?.symbol === s.symbol ? null : s)}
              className={`border-b border-gray-50 dark:border-gray-900 cursor-pointer transition-colors
                ${selected?.symbol === s.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}
            >
              <td className="px-2 py-2 text-[9px] text-gray-400 tabular-nums">{i + 1}</td>
              <td className="px-2 py-2">
                <div>
                  <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{s.symbol}</span>
                  <div className="text-[9px] text-gray-400 truncate max-w-[90px]">{s.company_name}</div>
                </div>
              </td>
              <td className="px-2 py-2 text-right">
                <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(s.drop_pct)}`}>
                  {s.drop_pct >= 0 ? '+' : ''}{s.drop_pct?.toFixed(1)}%
                </span>
              </td>
              <td className="px-2 py-2 text-right">
                <span className={`text-[10px] font-semibold tabular-nums ${pctTextCls(s.recovery_pct)}`}>
                  {s.recovery_pct != null ? `${s.recovery_pct >= 0 ? '+' : ''}${s.recovery_pct.toFixed(1)}%` : '—'}
                </span>
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-1 justify-end">
                  <div className="w-12 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${Math.min(100, s.recovery_progress || 0)}%` }} />
                  </div>
                  <span className="text-[9px] text-gray-400 tabular-nums w-5 text-right">
                    {(s.recovery_progress || 0).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 text-right">
                {s.fully_recovered
                  ? <span className="text-[9px] text-emerald-500 font-semibold">{s.recovery_days}d</span>
                  : <span className="text-[9px] text-gray-400">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE INSIGHT BAR
// ─────────────────────────────────────────────────────────────────────────────
function CycleInsightBar({ cycle, summary }) {
  if (!cycle) return null
  const isBull = cycle.type === 'bull'

  const stats = [
    { l: isBull ? 'Start (Trough)' : 'Peak', v: cycle.start_date, mono: true },
    { l: isBull ? 'Peak'  : 'Trough', v: cycle.end_date, mono: true },
    { l: 'Duration', v: `${cycle.duration_days} days` },
    { l: isBull ? 'From' : 'From', v: cycle.start_close?.toLocaleString() },
    { l: isBull ? 'To'   : 'To',   v: cycle.end_close?.toLocaleString()   },
  ]

  if (!isBull && summary) {
    stats.push({ l: 'Need to recover', v: `+${cycle.recovery_needed_pct?.toFixed(1)}%`, green: true })
    stats.push({ l: 'Recovered so far', v: `${summary.recovery_pct >= 0 ? '+' : ''}${summary.recovery_pct?.toFixed(1)}%`, green: summary.recovery_pct >= 0 })
    if (cycle.recovery_date) {
      stats.push({ l: 'Full recovery', v: `${cycle.recovery_date} (${cycle.recovery_days}d)`, green: true })
    }
  }

  return (
    <div className={`shrink-0 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 border-b
      ${isBull
        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40'
        : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40'
      }`}
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phaseCls(cycle.phase)}`}>
          {cycle.phase}
        </span>
        <span className={`text-[22px] font-black tabular-nums ${isBull ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {cycle.pct >= 0 ? '+' : ''}{cycle.pct?.toFixed(1)}%
        </span>
      </div>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {stats.map(({ l, v, mono, green }) => (
        <div key={l} className="shrink-0">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">{l}</p>
          <p className={`text-[11px] font-semibold leading-none ${green ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-200'} ${mono ? 'font-mono' : ''}`}>
            {v}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RESILIENT SECTORS — top 3 sectors with fastest recovery in a bear cycle
// ─────────────────────────────────────────────────────────────────────────────
function ResilientSectors({ sectors }) {
  const recovered = sectors.filter(s => s.fully_recovered && s.recovery_days != null)
    .sort((a, b) => a.recovery_days - b.recovery_days)
    .slice(0, 3)
  const hardest = sectors.filter(s => s.drop_pct != null)
    .sort((a, b) => a.drop_pct - b.drop_pct)
    .slice(0, 3)

  if (!recovered.length && !hardest.length) return null

  return (
    <div className="flex gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
      {recovered.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Fastest recovery:</span>
          {recovered.map(s => (
            <span key={s.index_name} className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              {s.index_name.replace(' Sub-Index','').replace(' Index','')} ({s.recovery_days}d)
            </span>
          ))}
        </div>
      )}
      {recovered.length > 0 && hardest.length > 0 && (
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 self-center" />
      )}
      {hardest.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Hardest hit:</span>
          {hardest.map(s => (
            <span key={s.index_name} className="text-[10px] font-semibold text-red-500 whitespace-nowrap">
              {s.index_name.replace(' Sub-Index','').replace(' Index','')} ({s.drop_pct?.toFixed(1)}%)
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR INDEX CHART (fetches its own data)
// ─────────────────────────────────────────────────────────────────────────────
function SectorIndexChart({ sector, cycle, dark }) {
  const [candles, setCandles] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!sector || !cycle) return
    setCandles(null)
    setLoading(true)
    setError('')
    const token = getToken()
    fetch(
      `${API}/breakdown/sector-index-chart?index_name=${encodeURIComponent(sector.index_name)}&peak_date=${cycle.start_date}&trough_date=${cycle.end_date}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setCandles(d.candles || [])
      })
      .catch(e => { setError(e.message); setCandles([]) })
      .finally(() => setLoading(false))
  }, [sector?.index_name, cycle?.start_date, cycle?.end_date])

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
          {sector.index_name}
        </span>
        <span className={`text-[11px] font-bold ml-auto ${pctTextCls(sector.drop_pct)}`}>
          {sector.drop_pct != null ? `${sector.drop_pct >= 0 ? '+' : ''}${sector.drop_pct.toFixed(1)}% during cycle` : ''}
        </span>
      </div>
      {error && (
        <div className="text-[11px] text-red-500 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded mb-1">{error}</div>
      )}
      {loading
        ? <div className="flex items-center justify-center" style={{ height: 240 }}>
            <span className="text-[11px] text-gray-400">Loading…</span>
          </div>
        : <PriceChart candles={candles} startDate={cycle.start_date} endDate={cycle.end_date}
            type={cycle.type} dark={dark} label={sector.index_name} height={240} />
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function BreakdownPage() {
  const { isDark } = useTheme()

  // ── Core state ──────────────────────────────────────────────────────────────
  const [indexId,     setIndexId]     = useState(12)
  const [threshold,   setThreshold]   = useState(10)
  const [cycles,      setCycles]      = useState([])
  const [allCandles,  setAllCandles]  = useState([])
  const [detecting,   setDetecting]   = useState(false)
  const [detectError, setDetectError] = useState('')

  const [activeCycle,  setActiveCycle]  = useState(null)
  const [analysis,     setAnalysis]     = useState(null)
  const [analyzing,    setAnalyzing]    = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  const [activeSector,  setActiveSector]  = useState(null)
  const [sectorStocks,  setSectorStocks]  = useState({})
  const [sectorLoading, setSectorLoading] = useState({})
  const sectorStocksRef = useRef({})

  const [selectedStock, setSelectedStock] = useState(null)
  const [stockCandles,  setStockCandles]  = useState(null)
  const [stockLoading,  setStockLoading]  = useState(false)
  const [stockError,    setStockError]    = useState('')

  const [sortBy,  setSortBy]  = useState('drop_pct')
  const [sortAsc, setSortAsc] = useState(true)

  // Sidebar filter: 'all' | 'bear' | 'bull'
  const [cycleFilter, setCycleFilter] = useState('all')

  // Main view: 'overview' | 'detail' | 'heatmap'
  const [view, setView] = useState('overview')

  // Heatmap year picker
  const currentYear = new Date().getFullYear()
  const [heatYear, setHeatYear] = useState(currentYear)

  // ── Detect cycles ───────────────────────────────────────────────────────────
  const detectCycles = useCallback(async (thresh, idxId) => {
    setDetecting(true)
    setDetectError('')
    try {
      const token = getToken()
      const resp  = await fetch(
        `${API}/breakdown/market-cycles?threshold=${thresh}&index_id=${idxId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setCycles(data.cycles || [])
      setAllCandles(data.candles || [])
      // Reset analysis when index/threshold changes
      setActiveCycle(null)
      setAnalysis(null)
      setActiveSector(null)
      setSelectedStock(null)
      setStockCandles(null)
      sectorStocksRef.current = {}
      setSectorStocks({})
      setSectorLoading({})
      setView('overview')
    } catch (e) {
      setDetectError(e.message || 'Failed to detect cycles')
    }
    setDetecting(false)
  }, [])

  useEffect(() => { detectCycles(threshold, indexId) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run analysis for a selected cycle ───────────────────────────────────────
  const runAnalysis = useCallback(async (cycle) => {
    setActiveCycle(cycle)
    setAnalysis(null)
    setAnalyzeError('')
    setActiveSector(null)
    sectorStocksRef.current = {}
    setSectorStocks({})
    setSectorLoading({})
    setSelectedStock(null)
    setStockCandles(null)
    setView('detail')
    setAnalyzing(true)

    try {
      const token = getToken()
      const resp  = await fetch(`${API}/breakdown/drop-analysis`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ peak_date: cycle.start_date, trough_date: cycle.end_date }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      setAnalysis(data)
    } catch (e) {
      setAnalyzeError(e.message || 'Failed to run analysis')
    }
    setAnalyzing(false)
  }, [])

  // ── Load sector stocks lazily ───────────────────────────────────────────────
  const loadSectorStocks = useCallback(async (indexName, peakDate, troughDate) => {
    if (sectorStocksRef.current[indexName] !== undefined) return
    sectorStocksRef.current[indexName] = null
    setSectorLoading(prev => ({ ...prev, [indexName]: true }))
    try {
      const token = getToken()
      const resp  = await fetch(
        `${API}/breakdown/sector-stocks?sector_index=${encodeURIComponent(indexName)}&peak_date=${peakDate}&trough_date=${troughDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      const stocks = data.stocks || []
      sectorStocksRef.current[indexName] = stocks
      setSectorStocks(prev => ({ ...prev, [indexName]: stocks }))
    } catch {
      sectorStocksRef.current[indexName] = []
      setSectorStocks(prev => ({ ...prev, [indexName]: [] }))
    }
    setSectorLoading(prev => ({ ...prev, [indexName]: false }))
  }, [])

  const handleSectorClick = useCallback((sector) => {
    if (!activeCycle) return
    const isNepse = sector.index_name === 'NEPSE'
    const next    = activeSector?.index_name === sector.index_name ? null : sector
    setActiveSector(next)
    setSelectedStock(null)
    setStockCandles(null)
    setStockError('')
    if (next && !isNepse) {
      loadSectorStocks(next.index_name, activeCycle.start_date, activeCycle.end_date)
    }
  }, [activeCycle, activeSector, loadSectorStocks])

  // ── Load stock chart ────────────────────────────────────────────────────────
  const loadStockChart = useCallback(async (stock) => {
    if (!activeCycle) return
    setSelectedStock(stock)
    setStockCandles(null)
    setStockLoading(true)
    setStockError('')
    try {
      const from  = new Date(activeCycle.start_date); from.setDate(from.getDate() - 20)
      const to    = new Date(activeCycle.end_date);   to.setDate(to.getDate() + 200)
      const today = new Date().toISOString().slice(0, 10)
      const toStr = to.toISOString().slice(0, 10) < today ? to.toISOString().slice(0, 10) : today
      const token = getToken()
      const resp  = await fetch(
        `${API}/breakdown/stock-price-range?symbol=${stock.symbol}&from=${from.toISOString().slice(0, 10)}&to=${toStr}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      setStockCandles(data.candles || [])
    } catch (e) {
      setStockError(e.message || 'Failed to load stock chart')
      setStockCandles([])
    }
    setStockLoading(false)
  }, [activeCycle])

  const handleStockSelect = useCallback((stock) => {
    if (!stock || selectedStock?.symbol === stock.symbol) {
      setSelectedStock(null)
      setStockCandles(null)
      setStockError('')
    } else {
      loadStockChart(stock)
    }
  }, [selectedStock, loadStockChart])

  const toggleSort = useCallback(col => {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(true) }
  }, [sortBy])

  // ── Derived values ──────────────────────────────────────────────────────────
  const sectors    = analysis?.sectors || []
  const summary    = analysis?.summary
  const maxDropAbs = Math.max(...sectors.map(s => Math.abs(s.drop_pct || 0)), 1)

  const nepseRow = summary ? {
    index_name:        'NEPSE',
    drop_pct:          summary.drop_pct,
    drop_pts:          summary.drop_pts,
    vs_nepse:          null,
    recovery_pct:      summary.recovery_pct,
    recovery_progress: summary.recovery_progress,
    recovery_days:     summary.recovery_days,
    fully_recovered:   summary.fully_recovered,
    stock_count:       null,
    trading_days:      summary.duration_days,
  } : null

  const sortedSectors = [...sectors].sort((a, b) => {
    const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const bearCycles    = cycles.filter(c => c.type === 'bear')
  const bullCycles    = cycles.filter(c => c.type === 'bull')
  const filteredCycles = cycleFilter === 'all' ? cycles
    : cycles.filter(c => c.type === cycleFilter)

  const SortTh = ({ col, label }) => (
    <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none whitespace-nowrap"
      onClick={() => toggleSort(col)}>
      {label}{sortBy === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const selectedIndexLabel = INDEX_OPTIONS.find(o => o.id === indexId)?.label || 'NEPSE'

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 overflow-hidden">

      {/* ── TOPBAR ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex-wrap">

        {/* Index selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {INDEX_OPTIONS.map(opt => (
            <button key={opt.id}
              onClick={() => {
                if (opt.id === indexId) return
                setIndexId(opt.id)
                detectCycles(threshold, opt.id)
              }}
              className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                indexId === opt.id
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {opt.short}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Threshold */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Threshold</span>
          <input type="number" value={threshold} min={5} max={50} step={1}
            onChange={e => setThreshold(parseFloat(e.target.value) || 10)}
            className="w-12 text-[11px] font-semibold text-center border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
          <span className="text-[10px] text-gray-400">%</span>
          <button
            onClick={() => detectCycles(threshold, indexId)}
            disabled={detecting}
            className="px-2.5 py-1 rounded text-[10px] font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {detecting ? 'Detecting…' : 'Detect'}
          </button>
        </div>

        {cycles.length > 0 && (
          <span className="text-[10px] text-gray-400 shrink-0">
            {bearCycles.length} bear · {bullCycles.length} bull on {selectedIndexLabel}
          </span>
        )}

        {/* View tabs */}
        <div className="ml-auto flex items-center gap-1">
          {['overview', 'detail', 'heatmap'].map(v => (
            <button key={v}
              onClick={() => setView(v)}
              disabled={v === 'detail' && !activeCycle}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors border capitalize
                ${view === v
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── ERROR BANNER ── */}
      {detectError && (
        <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/40 text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{detectError}</span>
          <button onClick={() => setDetectError('')} className="text-red-400 hover:text-red-600 font-bold ml-4">×</button>
        </div>
      )}

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT SIDEBAR ── */}
        <div className="w-[200px] shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
          {/* Filter tabs */}
          <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
            {[['all','All'], ['bear','Bear'], ['bull','Bull']].map(([v, l]) => (
              <button key={v} onClick={() => setCycleFilter(v)}
                className={`flex-1 py-1.5 text-[9px] font-semibold transition-colors
                  ${cycleFilter === v
                    ? v === 'bear' ? 'text-red-500 border-b-2 border-red-500'
                    : v === 'bull' ? 'text-emerald-500 border-b-2 border-emerald-500'
                    : 'text-gray-700 dark:text-gray-200 border-b-2 border-gray-700 dark:border-gray-200'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                {l} {v === 'bear' ? bearCycles.length : v === 'bull' ? bullCycles.length : cycles.length}
              </button>
            ))}
          </div>

          {detecting && (
            <div className="flex items-center justify-center py-4 text-[10px] text-gray-400">Detecting…</div>
          )}

          <div className="flex-1 overflow-y-auto">
            {filteredCycles.map((c, i) => {
              const isBear   = c.type === 'bear'
              const isActive = activeCycle?.start_date === c.start_date
              return (
                <button key={i} onClick={() => runAnalysis(c)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-gray-800/50 transition-colors
                    ${isActive
                      ? isBear ? 'bg-red-50 dark:bg-red-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
                    }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${isBear ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isBear ? '▼ Bear' : '▲ Bull'}
                    </span>
                    <span className={`text-[11px] font-black tabular-nums ${isBear ? 'text-red-500' : 'text-emerald-500'}`}>
                      {c.pct >= 0 ? '+' : ''}{c.pct?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500 font-mono">
                    {c.start_date?.slice(0, 7)} → {c.end_date?.slice(0, 7)}
                  </div>
                  <div className="text-[9px] text-gray-400">{c.duration_days}d · {c.phase}</div>
                  {isBear && c.recovery_date && (
                    <div className="text-[9px] text-emerald-500 mt-0.5">
                      Recovered in {c.recovery_days}d
                    </div>
                  )}
                  {isBear && !c.recovery_date && (
                    <div className="text-[9px] text-amber-500 mt-0.5">Not yet recovered</div>
                  )}
                </button>
              )
            })}
            {!detecting && filteredCycles.length === 0 && (
              <div className="flex items-center justify-center py-6 text-[10px] text-gray-400">
                No {cycleFilter !== 'all' ? cycleFilter : ''} cycles detected
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT MAIN AREA ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">

          {/* ═══ OVERVIEW VIEW ═══ */}
          {view === 'overview' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {/* Full history chart */}
              <div>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  {selectedIndexLabel} — Full History · Click any shaded zone to analyze
                </p>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <OverviewChart
                    candles={allCandles}
                    cycles={cycles}
                    activeCycle={activeCycle}
                    onCycleClick={runAnalysis}
                    dark={isDark}
                  />
                </div>
              </div>

              {/* Stats cards */}
              {cycles.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Bear stats */}
                  <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-red-400 mb-1">Bear Cycles</p>
                    <p className="text-2xl font-black text-red-500 mb-2">{bearCycles.length}</p>
                    {bearCycles.length > 0 && (() => {
                      const drops    = bearCycles.map(c => c.pct)
                      const avgDrop  = drops.reduce((s, v) => s + v, 0) / drops.length
                      const worst    = Math.min(...drops)
                      const avgDur   = bearCycles.reduce((s, c) => s + c.duration_days, 0) / bearCycles.length
                      const withRecov = bearCycles.filter(c => c.recovery_days)
                      const avgRecov  = withRecov.length
                        ? Math.round(withRecov.reduce((s, c) => s + c.recovery_days, 0) / withRecov.length)
                        : null
                      return (
                        <div className="space-y-1">
                          {[
                            { l: 'Avg drop',      v: `${avgDrop.toFixed(1)}%`, red: true },
                            { l: 'Worst',         v: `${worst.toFixed(1)}%`, red: true },
                            { l: 'Avg duration',  v: `${Math.round(avgDur)}d` },
                            { l: 'Avg recovery',  v: avgRecov ? `${avgRecov}d` : '—', green: true },
                            { l: 'Recovery rate', v: `${Math.round(withRecov.length / bearCycles.length * 100)}%`, green: true },
                          ].map(({ l, v, red, green }) => (
                            <div key={l} className="flex justify-between text-[10px]">
                              <span className="text-gray-400">{l}</span>
                              <span className={`font-semibold ${red ? 'text-red-500' : green ? 'text-emerald-500' : 'text-gray-600 dark:text-gray-300'}`}>{v}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Bull stats */}
                  <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">Bull Cycles</p>
                    <p className="text-2xl font-black text-emerald-500 mb-2">{bullCycles.length}</p>
                    {bullCycles.length > 0 && (() => {
                      const gains   = bullCycles.map(c => c.pct)
                      const avgGain = gains.reduce((s, v) => s + v, 0) / gains.length
                      const best    = Math.max(...gains)
                      const avgDur  = bullCycles.reduce((s, c) => s + c.duration_days, 0) / bullCycles.length
                      return (
                        <div className="space-y-1">
                          {[
                            { l: 'Avg gain',     v: `+${avgGain.toFixed(1)}%`, green: true },
                            { l: 'Best',         v: `+${best.toFixed(1)}%`, green: true },
                            { l: 'Avg duration', v: `${Math.round(avgDur)}d` },
                            { l: 'Corrections',  v: `${bullCycles.filter(c => c.phase === 'Rally').length} rally · ${bullCycles.filter(c => c.phase === 'Bull Run').length} bull run · ${bullCycles.filter(c => c.phase === 'Major Bull').length} major` },
                          ].map(({ l, v, green }) => (
                            <div key={l} className="flex justify-between text-[10px]">
                              <span className="text-gray-400">{l}</span>
                              <span className={`font-semibold ${green ? 'text-emerald-500' : 'text-gray-600 dark:text-gray-300'}`}>{v}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {cycles.length === 0 && !detecting && (
                <div className="flex items-center justify-center py-8 text-[12px] text-gray-400">
                  No cycles detected — try adjusting the threshold or selecting a different index
                </div>
              )}
            </div>
          )}

          {/* ═══ HEATMAP VIEW ═══ */}
          {view === 'heatmap' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {/* Year picker */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">Sector Monthly Returns</span>
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => setHeatYear(y => y - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px]">
                    ←
                  </button>
                  <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200 w-12 text-center tabular-nums">{heatYear}</span>
                  <button onClick={() => setHeatYear(y => Math.min(currentYear, y + 1))}
                    disabled={heatYear >= currentYear}
                    className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-[11px]">
                    →
                  </button>
                </div>
                {/* Quick year buttons */}
                <div className="flex items-center gap-1">
                  {[currentYear, currentYear-1, currentYear-2, currentYear-3].map(y => (
                    <button key={y} onClick={() => setHeatYear(y)}
                      className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                        heatYear === y
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <SectorHeatmap year={heatYear} dark={isDark} />
              </div>

              <p className="text-[9px] text-gray-400">
                Returns are compounded from daily % changes. All sector sub-indices included. Green = positive, Red = negative.
              </p>
            </div>
          )}

          {/* ═══ DETAIL VIEW ═══ */}
          {view === 'detail' && activeCycle && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">

              {/* Cycle summary bar */}
              <CycleInsightBar cycle={activeCycle} summary={summary} />

              {/* Resilient sectors bar (bear only) */}
              {!analyzing && activeCycle.type === 'bear' && sectors.length > 0 && (
                <ResilientSectors sectors={[...(nepseRow ? [nepseRow] : []), ...sectors]} />
              )}

              {/* Analyse error */}
              {analyzeError && (
                <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/40 text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
                  <span>{analyzeError}</span>
                  <button onClick={() => setAnalyzeError('')} className="font-bold ml-4">×</button>
                </div>
              )}

              {/* Chart area */}
              <div className="shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                {selectedStock ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <button
                        onClick={() => { setSelectedStock(null); setStockCandles(null); setStockError('') }}
                        className="text-[9px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      >
                        ← back to sector
                      </button>
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{selectedStock.symbol}</span>
                      <span className="text-[9px] text-gray-500 truncate max-w-[200px]">{selectedStock.company_name}</span>
                      <span className={`text-[11px] font-bold ml-auto ${pctTextCls(selectedStock.drop_pct)}`}>
                        {selectedStock.drop_pct != null ? `${selectedStock.drop_pct >= 0 ? '+' : ''}${selectedStock.drop_pct.toFixed(1)}%` : ''}
                      </span>
                    </div>
                    {stockError && (
                      <div className="text-[11px] text-red-500 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded mb-1">{stockError}</div>
                    )}
                    {stockLoading
                      ? <div className="flex items-center justify-center" style={{ height: 240 }}>
                          <span className="text-[11px] text-gray-400">Loading…</span>
                        </div>
                      : <PriceChart candles={stockCandles} startDate={activeCycle.start_date}
                          endDate={activeCycle.end_date} type={activeCycle.type} dark={isDark}
                          label={selectedStock.symbol} height={240} />
                    }
                  </div>
                ) : activeSector ? (
                  <SectorIndexChart sector={activeSector} cycle={activeCycle} dark={isDark} />
                ) : (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 font-mono">
                      {selectedIndexLabel} — {activeCycle.start_date} to {activeCycle.end_date}
                    </p>
                    <PriceChart
                      candles={allCandles.filter(c => {
                        const from = new Date(activeCycle.start_date); from.setDate(from.getDate() - 30)
                        const to   = new Date(activeCycle.end_date);   to.setDate(to.getDate() + 200)
                        return c.date >= from.toISOString().slice(0, 10) && c.date <= to.toISOString().slice(0, 10)
                      })}
                      startDate={activeCycle.start_date}
                      endDate={activeCycle.end_date}
                      type={activeCycle.type}
                      dark={isDark}
                      label={selectedIndexLabel}
                      height={240}
                    />
                  </div>
                )}
              </div>

              {/* Sector table + stock panel */}
              <div className="flex flex-1 overflow-hidden min-h-0">

                {/* Sector table */}
                <div className={`flex flex-col overflow-hidden border-r border-gray-100 dark:border-gray-800 ${activeSector ? 'w-[55%]' : 'flex-1'}`}>
                  {analyzing ? (
                    <div className="flex items-center justify-center flex-1 text-[11px] text-gray-400">
                      Computing sector returns…
                    </div>
                  ) : sectors.length === 0 && !analyzeError ? (
                    <div className="flex items-center justify-center flex-1 text-[11px] text-gray-400">
                      {activeCycle ? 'No sector data for this cycle' : 'Select a cycle to analyze'}
                    </div>
                  ) : (
                    <div className="overflow-auto flex-1">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 z-10">
                          <tr>
                            <SortTh col="index_name" label="Sector" />
                            <SortTh col="drop_pct" label={activeCycle.type === 'bull' ? 'Gain %' : 'Drop %'} />
                            <SortTh col="vs_nepse" label="vs Index" />
                            {activeCycle.type === 'bear' && (
                              <>
                                <SortTh col="recovery_pct" label="Recovered" />
                                <SortTh col="recovery_progress" label="Progress" />
                                <SortTh col="recovery_days" label="Days" />
                              </>
                            )}
                            <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Stocks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nepseRow && (
                            <SectorRow
                              sector={nepseRow}
                              isActive={activeSector?.index_name === 'NEPSE'}
                              onClick={() => handleSectorClick(nepseRow)}
                              maxDropAbs={maxDropAbs}
                              cycleType={activeCycle.type}
                            />
                          )}
                          {sortedSectors.map(s => (
                            <SectorRow key={s.index_name}
                              sector={s}
                              isActive={activeSector?.index_name === s.index_name}
                              onClick={() => handleSectorClick(s)}
                              maxDropAbs={maxDropAbs}
                              cycleType={activeCycle.type}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Stock panel */}
                {activeSector && (
                  <div className="flex flex-col overflow-hidden" style={{ width: '45%' }}>
                    <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">
                        {activeSector.index_name.replace(' Index', '').replace(' Sub-Index', '')}
                      </span>
                      <span className="text-[9px] text-gray-400 ml-auto">click to chart</span>
                      <button
                        onClick={() => { setActiveSector(null); setSelectedStock(null); setStockCandles(null); setStockError('') }}
                        className="text-gray-300 hover:text-gray-500 text-lg leading-none"
                      >×</button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <StockList
                        stocks={sectorStocks[activeSector.index_name]}
                        loading={!!sectorLoading[activeSector.index_name]}
                        onSelect={handleStockSelect}
                        selected={selectedStock}
                        dark={isDark}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No cycle selected yet (detail tab before any selection) */}
          {view === 'detail' && !activeCycle && (
            <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
              Select a cycle from the left panel or click a zone on the overview chart
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
