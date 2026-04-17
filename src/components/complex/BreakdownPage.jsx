import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'

const getToken = () => localStorage.getItem('token')
const API = 'http://localhost:5000/api'

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct == null) return '#6b7280'
  if (pct >= 0)   return '#10b981'
  if (pct > -12)  return '#f59e0b'
  if (pct > -25)  return '#ef4444'
  return '#b91c1c'
}
function pctTextCls(pct) {
  if (pct == null) return 'text-gray-400'
  if (pct >= 0)   return 'text-emerald-500'
  if (pct > -12)  return 'text-amber-500'
  if (pct > -25)  return 'text-red-500'
  return 'text-red-700 dark:text-red-400'
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
// PRICE CHART — proper SVG with fixed internal coordinate space
// hover tooltip, Y-axis, coloured zones
// ─────────────────────────────────────────────────────────────────────────────
function PriceChart({ candles, startDate, endDate, type = 'bear', dark, label = '' }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const VW = 900, VH = 280
  const PAD = { top: 28, bottom: 36, left: 58, right: 16 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom

  // Candle width — narrower when many candles, min 1px
  const candleW = Math.max(1, Math.min(8, Math.floor(chartW / Math.max(candles?.length || 1, 1)) - 1))

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx = Math.round(relX / chartW * (candles.length - 1))
    setHover(Math.max(0, Math.min(candles.length - 1, idx)))
  }, [candles])

  if (!candles?.length) return (
    <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: VH }}>
      No chart data
    </div>
  )

  // Use high/low for Y range when available, else open/close
  const hasWicks = candles.some(c => c.high != null && c.low != null)
  const allHigh  = candles.map(c => hasWicks ? c.high  : Math.max(c.open ?? c.close, c.close))
  const allLow   = candles.map(c => hasWicks ? c.low   : Math.min(c.open ?? c.close, c.close))
  const maxV = Math.max(...allHigh)
  const minV = Math.min(...allLow)
  const span = maxV - minV || 1

  const cx = i => PAD.left + (i / Math.max(1, candles.length - 1)) * chartW
  const cy = v => PAD.top  + (1 - (v - minV) / span) * chartH

  // Zone indices
  const si = candles.findIndex(c => c.date >= startDate)
  const ei = candles.findIndex(c => c.date >= endDate)
  const zoneStart = si >= 0 ? si : 0
  const zoneEnd   = ei >= 0 ? ei : candles.length - 1

  const zoneColor  = type === 'bull' ? '#10b981' : '#ef4444'
  const zoneBg     = type === 'bull' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = minV + (i / 4) * span
    return { v, y: cy(v) }
  })

  // Date ticks: start, zone start, zone end, last — deduplicated
  const dateTick = [...new Set([0, zoneStart, zoneEnd, candles.length - 1])]
    .filter(i => i >= 0 && i < candles.length)

  const hoverCandle = hover !== null ? candles[hover] : null
  const hoverX      = hover !== null ? cx(hover) : null

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
        {/* Chart background */}
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH}
          fill={dark ? '#0f172a' : '#fafafa'} rx="2" />

        {/* Y-axis grid + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + chartW} y2={t.y}
              stroke={dark ? '#1e293b' : '#e5e7eb'} strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 4}
              textAnchor="end" fontSize="11" fontFamily="monospace"
              fill={dark ? '#475569' : '#94a3b8'}>
              {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Zone background shading */}
        <rect
          x={cx(zoneStart)} y={PAD.top}
          width={Math.max(0, cx(zoneEnd) - cx(zoneStart))} height={chartH}
          fill={zoneBg}
        />

        {/* Zone border lines */}
        <line x1={cx(zoneStart)} y1={PAD.top} x2={cx(zoneStart)} y2={PAD.top + chartH}
          stroke={zoneColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
        <line x1={cx(zoneEnd)} y1={PAD.top} x2={cx(zoneEnd)} y2={PAD.top + chartH}
          stroke={zoneColor} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />

        {/* ── Candlesticks ── */}
        {candles.map((c, i) => {
          const x    = cx(i)
          const open  = c.open  ?? c.close
          const close = c.close
          const high  = hasWicks ? c.high  : Math.max(open, close)
          const low   = hasWicks ? c.low   : Math.min(open, close)

          const isUp     = close >= open
          const inZone   = i >= zoneStart && i <= zoneEnd
          const isHovered = hover === i

          // Candle colours: in-zone use theme colour; outside use muted green/red
          let bodyColor, wickColor
          if (inZone) {
            bodyColor = isUp ? '#10b981' : '#ef4444'
            wickColor = isUp ? '#10b981' : '#ef4444'
          } else {
            bodyColor = isUp
              ? (dark ? '#1d4a34' : '#bbf7d0')
              : (dark ? '#4a1d1d' : '#fecaca')
            wickColor = isUp
              ? (dark ? '#22c55e' : '#16a34a')
              : (dark ? '#ef4444' : '#dc2626')
          }

          const bodyTop    = cy(Math.max(open, close))
          const bodyBot    = cy(Math.min(open, close))
          const bodyH      = Math.max(1, bodyBot - bodyTop)
          const halfW      = candleW / 2

          return (
            <g key={i} opacity={isHovered ? 1 : 0.92}>
              {/* Wick */}
              <line
                x1={x} y1={cy(high)} x2={x} y2={cy(low)}
                stroke={wickColor} strokeWidth={isHovered ? 1.5 : 1}
              />
              {/* Body */}
              <rect
                x={x - halfW} y={bodyTop}
                width={candleW} height={bodyH}
                fill={bodyColor}
                stroke={isHovered ? (dark ? '#fff' : '#1e293b') : 'none'}
                strokeWidth={0.5}
                rx="0.5"
              />
            </g>
          )
        })}

        {/* Zone start/end price labels */}
        <text x={cx(zoneStart)} y={PAD.top - 8} textAnchor="middle" fontSize="11"
          fontWeight="700" fill={zoneColor}>
          {candles[zoneStart].close.toFixed(0)}
        </text>
        <text x={cx(zoneEnd)} y={PAD.top - 8} textAnchor="middle" fontSize="11"
          fontWeight="700" fill={zoneColor}>
          {candles[zoneEnd].close.toFixed(0)}
        </text>

        {/* % annotation pill between zone markers */}
        {zoneEnd > zoneStart + 6 && (() => {
          const midX  = (cx(zoneStart) + cx(zoneEnd)) / 2
          const startY = cy(candles[zoneStart].close)
          const endY   = cy(candles[zoneEnd].close)
          const midY   = (startY + endY) / 2
          const pct    = ((candles[zoneEnd].close - candles[zoneStart].close) / candles[zoneStart].close * 100)
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

        {/* Hover crosshair */}
        {hover !== null && hoverCandle && (
          <g>
            <line x1={hoverX} y1={PAD.top} x2={hoverX} y2={PAD.top + chartH}
              stroke={dark ? '#64748b' : '#94a3b8'} strokeWidth="1" strokeDasharray="4,3" />
            <line x1={PAD.left} y1={cy(hoverCandle.close)} x2={PAD.left + chartW} y2={cy(hoverCandle.close)}
              stroke={dark ? '#64748b' : '#94a3b8'} strokeWidth="1" strokeDasharray="4,3" />
          </g>
        )}

        {/* Label */}
        {label && (
          <text x={PAD.left + 6} y={PAD.top + 16} fontSize="12" fontWeight="700"
            fill={dark ? '#475569' : '#94a3b8'}>
            {label}
          </text>
        )}
      </svg>

      {/* Tooltip */}
      {hover !== null && hoverCandle && (
        <div
          className="pointer-events-none absolute top-2 z-30 text-[11px] rounded-xl px-3 py-2.5 shadow-xl border whitespace-nowrap"
          style={{
            left:  hoverX > VW * 0.6 ? undefined : `calc(${(hoverX / VW) * 100}% + 10px)`,
            right: hoverX > VW * 0.6 ? `calc(${((VW - hoverX) / VW) * 100}% + 10px)` : undefined,
            background: dark ? '#1e293b' : 'white',
            borderColor: dark ? '#334155' : '#e5e7eb',
            color: dark ? '#f1f5f9' : '#1e293b',
          }}
        >
          <div className="font-semibold mb-1 text-[10px]" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
            {hoverCandle.date}
          </div>
          {hasWicks && hoverCandle.high != null && (
            <div className="flex gap-3 text-[10px] mb-1">
              <span className="text-gray-400">H <span className="font-semibold" style={{ color: dark ? '#f1f5f9' : '#1e293b' }}>{hoverCandle.high?.toLocaleString()}</span></span>
              <span className="text-gray-400">L <span className="font-semibold" style={{ color: dark ? '#f1f5f9' : '#1e293b' }}>{hoverCandle.low?.toLocaleString()}</span></span>
            </div>
          )}
          <div className="flex gap-3 text-[10px]">
            <span className="text-gray-400">O <span className="font-semibold" style={{ color: dark ? '#f1f5f9' : '#1e293b' }}>{(hoverCandle.open ?? hoverCandle.close).toLocaleString()}</span></span>
            <span className="text-gray-400">C <span className="font-bold text-[13px]" style={{ color: dark ? '#f1f5f9' : '#1e293b' }}>{hoverCandle.close.toLocaleString()}</span></span>
          </div>
          {(hoverCandle.per_change != null || hoverCandle.diff_pct != null) && (
            <div className={`text-[10px] mt-1 font-semibold ${(hoverCandle.per_change ?? hoverCandle.diff_pct) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {(hoverCandle.per_change ?? hoverCandle.diff_pct) >= 0 ? '+' : ''}
              {(hoverCandle.per_change ?? hoverCandle.diff_pct)?.toFixed(2)}%
            </div>
          )}
          {hover >= zoneStart && hover <= zoneEnd && (
            <div style={{ color: zoneColor }} className="text-[10px] mt-0.5 font-medium">
              {type === 'bear' ? 'Drop' : 'Bull'} day {hover - zoneStart + 1}
            </div>
          )}
          {hover > zoneEnd && (
            <div className="text-[10px] mt-0.5 text-emerald-500">
              Recovery day {hover - zoneEnd}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW CHART — full NEPSE history with cycle bands shaded
// ─────────────────────────────────────────────────────────────────────────────
function OverviewChart({ candles, cycles, activeCycle, onCycleClick, dark }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const VW = 1000, VH = 260
  const PAD = { top: 20, bottom: 36, left: 58, right: 16 }
  const chartW = VW - PAD.left - PAD.right
  const chartH = VH - PAD.top - PAD.bottom

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx = Math.round(relX / chartW * (candles.length - 1))
    setHover(Math.max(0, Math.min(candles.length - 1, idx)))
  }, [candles])

  if (!candles?.length) return null

  // Use open/close for Y range (index_ohlcv has no high/low)
  const allVals  = candles.flatMap(c => [c.open ?? c.close, c.close])
  const minV     = Math.min(...allVals)
  const maxV     = Math.max(...allVals)
  const span     = maxV - minV || 1

  // Candle width — at most 3px for overview (many candles)
  const candleW  = Math.max(1, Math.min(3, Math.floor(chartW / Math.max(candles.length, 1)) - 0.5))

  const cx = i => PAD.left + (i / Math.max(1, candles.length - 1)) * chartW
  const cy = v => PAD.top  + (1 - (v - minV) / span) * chartH

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    v: minV + f * span,
    y: cy(minV + f * span),
  }))

  // Click on a cycle band
  const handleClick = (e) => {
    if (!svgRef.current || !candles?.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (VW / rect.width) - PAD.left
    const idx  = Math.round(relX / chartW * (candles.length - 1))
    const clickedDate = candles[Math.max(0, Math.min(candles.length - 1, idx))]?.date
    if (!clickedDate) return
    const hit = cycles.find(c => clickedDate >= c.start_date && clickedDate <= c.end_date)
    if (hit) onCycleClick(hit)
  }

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
        {/* Y-axis */}
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

        {/* Cycle bands */}
        {cycles.map((cyc, i) => {
          const si = candles.findIndex(c => c.date >= cyc.start_date)
          const ei = candles.findIndex(c => c.date >= cyc.end_date)
          if (si < 0 || ei < 0) return null
          const x1 = cx(si), x2 = cx(ei)
          const isActive = activeCycle?.start_date === cyc.start_date
          const fill = cyc.type === 'bull'
            ? isActive ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.1)'
            : isActive ? 'rgba(239,68,68,0.25)'  : 'rgba(239,68,68,0.1)'
          return (
            <rect key={i} x={x1} y={PAD.top} width={Math.max(1, x2 - x1)} height={chartH}
              fill={fill} rx="0"
            />
          )
        })}

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const x     = cx(i)
          const open  = c.open ?? c.close
          const close = c.close
          const isUp  = close >= open
          const bodyTop = cy(Math.max(open, close))
          const bodyBot = cy(Math.min(open, close))
          const bodyH   = Math.max(1, bodyBot - bodyTop)
          const halfW   = candleW / 2
          const inZone  = cycles.some(cyc =>
            c.date >= cyc.start_date && c.date <= cyc.end_date
          )
          const color = isUp
            ? (dark ? '#22c55e' : '#16a34a')
            : (dark ? '#ef4444' : '#dc2626')
          const mutedColor = isUp
            ? (dark ? '#14532d' : '#bbf7d0')
            : (dark ? '#450a0a' : '#fecaca')

          return (
            <g key={i}>
              <line x1={x} y1={bodyTop} x2={x} y2={bodyBot}
                stroke={inZone ? color : mutedColor} strokeWidth={Math.max(1, candleW)} />
            </g>
          )
        })}

        {/* Hover line */}
        {hover !== null && (
          <line x1={cx(hover)} y1={PAD.top} x2={cx(hover)} y2={PAD.top + chartH}
            stroke={dark ? '#64748b' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3,2" />
        )}

        {/* Date axis */}
        {[0, Math.floor(candles.length * 0.25), Math.floor(candles.length * 0.5), Math.floor(candles.length * 0.75), candles.length - 1].map(idx => (
          <text key={idx} x={cx(idx)} y={VH - 4} textAnchor="middle" fontSize="10"
            fill={dark ? '#64748b' : '#94a3b8'}>
            {candles[idx]?.date?.slice(0, 7)}
          </text>
        ))}
      </svg>

      {/* Hover tooltip */}
      {hover !== null && candles[hover] && (
        <div className="pointer-events-none absolute top-2 z-20 text-[11px] rounded-xl px-3 py-2 shadow-xl border whitespace-nowrap"
          style={{
            left: cx(hover) / VW * 100 > 60 ? undefined : `calc(${cx(hover) / VW * 100}% + 8px)`,
            right: cx(hover) / VW * 100 > 60 ? `calc(${(VW - cx(hover)) / VW * 100}% + 8px)` : undefined,
            background: dark ? '#1e293b' : 'white',
            borderColor: dark ? '#334155' : '#e5e7eb',
            color: dark ? '#f1f5f9' : '#1e293b',
          }}>
          <div className="font-semibold text-[10px] mb-1" style={{ color: dark ? '#94a3b8' : '#64748b' }}>{candles[hover].date}</div>
          <div className="flex gap-3 text-[10px]">
            <span className="text-gray-400">O <span className="font-semibold" style={{ color: dark ? '#f1f5f9' : '#1e293b' }}>{(candles[hover].open ?? candles[hover].close).toLocaleString()}</span></span>
            <span className="text-gray-400">C <span className="font-bold text-[13px]" style={{ color: dark ? '#f1f5f9' : '#1e293b' }}>{candles[hover].close.toLocaleString()}</span></span>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 right-0 flex items-center gap-3 text-[9px] px-2 pb-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'rgba(239,68,68,0.4)' }} />
          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Bear/Drop</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'rgba(16,185,129,0.4)' }} />
          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Bull/Rally</span>
        </span>
        <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Click a zone to analyze</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────
function SectorRow({ sector, isActive, onClick, maxDropAbs, cycleType }) {
  const dropAbs = Math.abs(sector.drop_pct || 0)
  const barW    = maxDropAbs > 0 ? (dropAbs / maxDropAbs) * 100 : 0
  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors
        ${isActive ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: pctColor(sector.drop_pct) }} />
          <span className="text-[11px] font-medium text-gray-800 dark:text-gray-100">
            {sector.index_name.replace(' Sub-Index', '').replace(' Index', '')}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${barW}%`, background: pctColor(sector.drop_pct) }} />
          </div>
          <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(sector.drop_pct)}`}>
            {sector.drop_pct?.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {sector.vs_nepse != null && (
          <span className={`text-[10px] font-semibold tabular-nums ${sector.vs_nepse >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {sector.vs_nepse >= 0 ? '+' : ''}{sector.vs_nepse?.toFixed(1)}%
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[10px] font-semibold tabular-nums ${pctTextCls(sector.recovery_pct)}`}>
          {sector.recovery_pct >= 0 ? '+' : ''}{sector.recovery_pct?.toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
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
      <td className="px-3 py-2.5">
        {sector.stock_count == null
          ? null
          : sector.stock_count === 0
            ? <span className="text-[9px] text-amber-400" title="company_master not populated">—</span>
            : <span className="text-[9px] text-gray-400">{sector.stock_count}</span>
        }
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK LIST — table of all stocks in selected sector
// ─────────────────────────────────────────────────────────────────────────────
function StockList({ stocks, loading, onSelect, selected, peakDate, troughDate, dark }) {
  if (loading) return (
    <div className="flex items-center justify-center py-8 text-[11px] text-gray-400">
      Loading stocks…
    </div>
  )
  if (stocks === undefined) return (
    <div className="flex items-center justify-center py-8 text-[11px] text-gray-400">
      Click a sector row to load stocks
    </div>
  )
  const valid = (stocks || []).filter(s => s.drop_pct != null)
  if (!stocks?.length) return (
    <div className="flex flex-col items-center justify-center py-8 gap-1 text-center px-4">
      <span className="text-[11px] text-gray-400">No stocks found for this sector.</span>
      <span className="text-[10px] text-gray-300 dark:text-gray-600">
        The company_master table may not be populated yet.<br/>
        Run scrape_company_master.py to populate sector mappings.
      </span>
    </div>
  )
  if (!valid.length) return (
    <div className="flex flex-col items-center justify-center py-8 gap-1 text-center px-4">
      <span className="text-[11px] text-gray-400">{stocks.length} stocks found, but none have price data for this period.</span>
    </div>
  )

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
          <tr>
            {['#', 'Symbol', 'Company', 'Drop %', 'Recovery %', 'Progress', 'Days'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valid.map((s, i) => (
            <tr key={s.symbol}
              onClick={() => onSelect(selected?.symbol === s.symbol ? null : s)}
              className={`border-b border-gray-50 dark:border-gray-900 cursor-pointer transition-colors
                ${selected?.symbol === s.symbol
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}
            >
              <td className="px-3 py-2 text-[9px] text-gray-400 tabular-nums w-6">{i + 1}</td>
              <td className="px-3 py-2">
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{s.symbol}</span>
              </td>
              <td className="px-3 py-2 max-w-[160px]">
                <span className="text-[10px] text-gray-500 truncate block">{s.company_name}</span>
              </td>
              <td className="px-3 py-2">
                <span className={`text-[11px] font-bold tabular-nums ${pctTextCls(s.drop_pct)}`}>
                  {s.drop_pct?.toFixed(1)}%
                </span>
              </td>
              <td className="px-3 py-2">
                <span className={`text-[10px] font-semibold tabular-nums ${pctTextCls(s.recovery_pct)}`}>
                  {s.recovery_pct >= 0 ? '+' : ''}{s.recovery_pct?.toFixed(1)}%
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${Math.min(100, s.recovery_progress || 0)}%` }} />
                  </div>
                  <span className="text-[9px] text-gray-400 tabular-nums w-6">
                    {(s.recovery_progress || 0).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">
                {s.fully_recovered
                  ? <span className="text-[9px] text-emerald-500">{s.recovery_days}d ✓</span>
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
// CYCLE INSIGHT PANEL — summary stats for a selected cycle
// ─────────────────────────────────────────────────────────────────────────────
function CycleInsights({ cycle, summary }) {
  if (!cycle) return null
  const isBull = cycle.type === 'bull'
  const color  = isBull ? 'emerald' : 'red'

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-b
      ${isBull
        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40'
        : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40'
      }`}
    >
      {/* Phase badge */}
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phaseCls(cycle.phase)}`}>
        {cycle.phase}
      </span>

      {/* Big pct */}
      <div>
        <span className={`text-2xl font-black tabular-nums text-${color}-600 dark:text-${color}-400`}>
          {cycle.pct >= 0 ? '+' : ''}{cycle.pct?.toFixed(1)}%
        </span>
      </div>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

      {[
        { l: isBull ? 'Start' : 'Peak',   v: cycle.start_date },
        { l: isBull ? 'Peak'  : 'Trough', v: cycle.end_date   },
        { l: 'Duration', v: `${cycle.duration_days} trading days` },
        { l: isBull ? 'From' : 'From',   v: cycle.start_close?.toLocaleString() },
        { l: isBull ? 'To'   : 'To',     v: cycle.end_close?.toLocaleString()   },
      ].map(({ l, v }) => (
        <div key={l}>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">{l}</p>
          <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{v}</p>
        </div>
      ))}

      {!isBull && summary && (
        <>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Need to recover</p>
            <p className="text-[11px] font-semibold text-emerald-600">+{cycle.recovery_needed_pct?.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Recovered so far</p>
            <p className={`text-[11px] font-semibold ${summary.recovery_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {summary.recovery_pct >= 0 ? '+' : ''}{summary.recovery_pct?.toFixed(1)}%
            </p>
          </div>
          {cycle.recovery_date && (
            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wide">Full recovery</p>
              <p className="text-[11px] font-semibold text-emerald-600">
                {cycle.recovery_date} ({cycle.recovery_days}d)
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTOR INDEX CHART — fetches sector index candles then renders PriceChart
// ─────────────────────────────────────────────────────────────────────────────
function SectorIndexChart({ sector, cycle, dark }) {
  const [candles, setCandles] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sector || !cycle) return
    setCandles(null)
    setLoading(true)
    const token = getToken()
    fetch(
      `${API}/breakdown/sector-index-chart?index_name=${encodeURIComponent(sector.index_name)}&peak_date=${cycle.start_date}&trough_date=${cycle.end_date}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(r => r.json())
      .then(d => setCandles(d.candles || []))
      .catch(() => setCandles([]))
      .finally(() => setLoading(false))
  }, [sector?.index_name, cycle?.start_date, cycle?.end_date])

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
          {sector.index_name}
        </span>
        <span className={`text-[11px] font-bold ml-auto ${pctTextCls(sector.drop_pct)}`}>
          {sector.drop_pct?.toFixed(1)}% during drop
        </span>
      </div>
      {loading
        ? <div className="flex items-center justify-center" style={{ height: 280 }}>
            <span className="text-[11px] text-gray-400">Loading…</span>
          </div>
        : <PriceChart candles={candles} startDate={cycle.start_date} endDate={cycle.end_date}
            type="bear" dark={dark} label={sector.index_name} />
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function BreakdownPage() {
  const { isDark } = useTheme()

  const [threshold,   setThreshold]   = useState(10)
  const [cycles,      setCycles]      = useState([])
  const [allCandles,  setAllCandles]  = useState([])
  const [detecting,   setDetecting]   = useState(false)

  const [activeCycle,  setActiveCycle]  = useState(null)
  const [analysis,     setAnalysis]     = useState(null)  // { summary, sectors }
  const [analyzing,    setAnalyzing]    = useState(false)

  const [activeSector,  setActiveSector]  = useState(null)
  const [sectorStocks,  setSectorStocks]  = useState({})
  const [sectorLoading, setSectorLoading] = useState({})
  const sectorStocksRef = useRef({})
  const [selectedStock, setSelectedStock] = useState(null)
  const [stockCandles,  setStockCandles]  = useState(null)
  const [stockLoading,  setStockLoading]  = useState(false)

  const [sortBy,  setSortBy]  = useState('drop_pct')
  const [sortAsc, setSortAsc] = useState(true)

  const [view, setView] = useState('overview') // 'overview' | 'detail'

  // ── Detect cycles ───────────────────────────────────────────────────────────
  const detectCycles = useCallback(async (thresh = threshold) => {
    setDetecting(true)
    try {
      const token = getToken()
      const resp  = await fetch(`${API}/breakdown/market-cycles?threshold=${thresh}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await resp.json()
      setCycles(data.cycles || [])
      setAllCandles(data.candles || [])
    } catch {}
    setDetecting(false)
  }, [threshold])

  useEffect(() => { detectCycles() }, [])

  // ── Run analysis for a selected cycle ───────────────────────────────────────
  const runAnalysis = useCallback(async (cycle) => {
    setActiveCycle(cycle)
    setAnalysis(null)
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
      // For both bear and bull: use drop-analysis with start/end dates
      // For bull cycles start_date = trough, end_date = peak — compounding gives gain not loss
      const resp  = await fetch(`${API}/breakdown/drop-analysis`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ peak_date: cycle.start_date, trough_date: cycle.end_date }),
      })
      if (!resp.ok) throw new Error('Failed')
      const data = await resp.json()
      setAnalysis(data)
    } catch (err) {
      console.error('runAnalysis error:', err)
    }
    setAnalyzing(false)
  }, [])

  // ── Load sector stocks lazily ───────────────────────────────────────────────
  const loadSectorStocks = useCallback(async (indexName, peakDate, troughDate) => {
    // Use ref to avoid stale closure — prevents re-fetch on every render
    if (sectorStocksRef.current[indexName] !== undefined) return
    // Mark as loading immediately in the ref so concurrent calls don't double-fetch
    sectorStocksRef.current[indexName] = null
    setSectorLoading(prev => ({ ...prev, [indexName]: true }))
    try {
      const token = getToken()
      const resp  = await fetch(
        `${API}/breakdown/sector-stocks?sector_index=${encodeURIComponent(indexName)}&peak_date=${peakDate}&trough_date=${troughDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      const stocks = data.stocks || []
      sectorStocksRef.current[indexName] = stocks
      setSectorStocks(prev => ({ ...prev, [indexName]: stocks }))
    } catch (err) {
      console.error('sector-stocks fetch error:', err)
      sectorStocksRef.current[indexName] = []
      setSectorStocks(prev => ({ ...prev, [indexName]: [] }))
    }
    setSectorLoading(prev => ({ ...prev, [indexName]: false }))
  }, [])   // no deps — uses ref for guard

  const handleSectorClick = (sector) => {
    if (!activeCycle) return
    // NEPSE row has no sector_index — clicking it shows the NEPSE chart but no stocks
    const isNepse = sector.index_name === 'NEPSE'
    const next = activeSector?.index_name === sector.index_name ? null : sector
    setActiveSector(next)
    setSelectedStock(null)
    setStockCandles(null)
    if (next && !isNepse) {
      loadSectorStocks(next.index_name, activeCycle.start_date, activeCycle.end_date)
    }
  }

  // ── Load stock chart ────────────────────────────────────────────────────────
  const loadStockChart = useCallback(async (stock) => {
    if (!activeCycle) return
    setSelectedStock(stock)
    setStockCandles(null)
    setStockLoading(true)
    try {
      const from = new Date(activeCycle.start_date); from.setDate(from.getDate() - 20)
      const to   = new Date(activeCycle.end_date);   to.setDate(to.getDate() + 200)
      const today = new Date().toISOString().slice(0, 10)
      const toStr = to.toISOString().slice(0, 10) < today ? to.toISOString().slice(0, 10) : today
      const token = getToken()
      const resp  = await fetch(
        `${API}/breakdown/stock-price-range?symbol=${stock.symbol}&from=${from.toISOString().slice(0, 10)}&to=${toStr}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await resp.json()
      setStockCandles(data.candles || [])
    } catch { setStockCandles([]) }
    setStockLoading(false)
  }, [activeCycle])

  const handleStockSelect = (stock) => {
    if (!stock || selectedStock?.symbol === stock.symbol) {
      setSelectedStock(null); setStockCandles(null)
    } else {
      loadStockChart(stock)
    }
  }

  const toggleSort = col => {
    if (sortBy === col) setSortAsc(a => !a)
    else { setSortBy(col); setSortAsc(true) }
  }

  const sectors   = analysis?.sectors || []
  const summary   = analysis?.summary
  const maxDropAbs = Math.max(...sectors.map(s => Math.abs(s.drop_pct || 0)), 1)

  // Sorted sectors
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

  const SortTh = ({ col, label }) => (
    <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none whitespace-nowrap"
      onClick={() => toggleSort(col)}>
      {label}{sortBy === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  // Cycle sidebar list
  const bearCycles = cycles.filter(c => c.type === 'bear')
  const bullCycles = cycles.filter(c => c.type === 'bull')

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 overflow-hidden">

      {/* ── TOPBAR ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        {/* Threshold */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Threshold</span>
          <input type="number" value={threshold} min={5} max={50} step={1}
            onChange={e => setThreshold(parseFloat(e.target.value) || 10)}
            className="w-14 text-[11px] font-semibold text-center border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
          <span className="text-[10px] text-gray-400">%</span>
        </div>

        <button onClick={() => detectCycles(threshold)} disabled={detecting}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-80 disabled:opacity-40 transition-opacity">
          {detecting ? 'Detecting…' : 'Detect Cycles'}
        </button>

        {cycles.length > 0 && (
          <span className="text-[10px] text-gray-400">
            {bearCycles.length} bear · {bullCycles.length} bull detected
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setView('overview')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors border
              ${view === 'overview'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400'}`}>
            Overview
          </button>
          {activeCycle && (
            <button onClick={() => setView('detail')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors border
                ${view === 'detail'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400'}`}>
              Detail
            </button>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT SIDEBAR: cycle list ── */}
        <div className="w-52 shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
          <div className="shrink-0 px-3 pt-2.5 pb-1">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
              {detecting ? 'Detecting…' : `${cycles.length} Cycles`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {cycles.map((c, i) => {
              const isBear   = c.type === 'bear'
              const isActive = activeCycle?.start_date === c.start_date
              return (
                <button key={i} onClick={() => runAnalysis(c)}
                  className={`w-full text-left px-3 py-2.5 border-b transition-colors
                    border-gray-50 dark:border-gray-800/50
                    ${isActive
                      ? isBear
                        ? 'bg-red-50 dark:bg-red-950/30'
                        : 'bg-emerald-50 dark:bg-emerald-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
                    }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wide
                      ${isBear ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isBear ? '▼ Bear' : '▲ Bull'}
                    </span>
                    <span className={`text-[11px] font-black tabular-nums
                      ${isBear ? 'text-red-500' : 'text-emerald-500'}`}>
                      {c.pct >= 0 ? '+' : ''}{c.pct?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500">
                    {c.start_date?.slice(0, 7)} → {c.end_date?.slice(0, 7)}
                  </div>
                  <div className="text-[9px] text-gray-400">{c.duration_days}d · {c.phase}</div>
                  {isBear && c.recovery_date && (
                    <div className="text-[9px] text-emerald-500 mt-0.5">
                      ✓ Recovered {c.recovery_days}d later
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT MAIN AREA ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">

          {/* OVERVIEW VIEW */}
          {view === 'overview' && (
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  NEPSE Full History — click any shaded zone to analyze
                </p>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden" style={{ minHeight: 260 }}>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-red-400 mb-2">Bear Cycles</p>
                  <p className="text-2xl font-black text-red-500">{bearCycles.length}</p>
                  {bearCycles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Avg drop</span>
                        <span className="font-semibold text-red-500">
                          {(bearCycles.reduce((s, c) => s + c.pct, 0) / bearCycles.length).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Worst</span>
                        <span className="font-semibold text-red-600">
                          {Math.min(...bearCycles.map(c => c.pct)).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Avg duration</span>
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          {Math.round(bearCycles.reduce((s, c) => s + c.duration_days, 0) / bearCycles.length)}d
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Avg recovery</span>
                        <span className="font-semibold text-emerald-500">
                          {Math.round(bearCycles.filter(c => c.recovery_days).reduce((s, c) => s + c.recovery_days, 0) / (bearCycles.filter(c => c.recovery_days).length || 1))}d
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400 mb-2">Bull Cycles</p>
                  <p className="text-2xl font-black text-emerald-500">{bullCycles.length}</p>
                  {bullCycles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Avg gain</span>
                        <span className="font-semibold text-emerald-500">
                          +{(bullCycles.reduce((s, c) => s + c.pct, 0) / bullCycles.length).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Best</span>
                        <span className="font-semibold text-emerald-600">
                          +{Math.max(...bullCycles.map(c => c.pct)).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Avg duration</span>
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          {Math.round(bullCycles.reduce((s, c) => s + c.duration_days, 0) / bullCycles.length)}d
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DETAIL VIEW */}
          {view === 'detail' && activeCycle && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">

              {/* Cycle insight bar */}
              <CycleInsights cycle={activeCycle} summary={summary} />

              {/* Chart section */}
              <div className="shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                {/* Stock chart (if stock selected, show it here) */}
                {selectedStock ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <button onClick={() => { setSelectedStock(null); setStockCandles(null) }}
                        className="text-[9px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        ← back to index
                      </button>
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{selectedStock.symbol}</span>
                      <span className="text-[9px] text-gray-500">{selectedStock.company_name}</span>
                      <span className={`text-[11px] font-bold ml-auto ${pctTextCls(selectedStock.drop_pct)}`}>
                        {selectedStock.drop_pct?.toFixed(1)}%
                      </span>
                    </div>
                    {stockLoading
                      ? <div className="flex items-center justify-center" style={{ height: 280 }}>
                          <span className="text-[11px] text-gray-400">Loading…</span>
                        </div>
                      : <PriceChart candles={stockCandles} startDate={activeCycle.start_date}
                          endDate={activeCycle.end_date} type={activeCycle.type} dark={isDark}
                          label={selectedStock.symbol} />
                    }
                  </div>
                ) : activeSector ? (
                  /* Sector index chart */
                  <SectorIndexChart sector={activeSector} cycle={activeCycle} dark={isDark} />
                ) : (
                  /* NEPSE chart for the cycle */
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                      NEPSE — {activeCycle.start_date} to {activeCycle.end_date}
                    </p>
                    <PriceChart candles={allCandles.filter(c => {
                      const from = new Date(activeCycle.start_date); from.setDate(from.getDate() - 30)
                      const to   = new Date(activeCycle.end_date);   to.setDate(to.getDate() + 200)
                      return c.date >= from.toISOString().slice(0, 10) && c.date <= to.toISOString().slice(0, 10)
                    })} startDate={activeCycle.start_date} endDate={activeCycle.end_date}
                      type={activeCycle.type} dark={isDark} label="NEPSE" />
                  </div>
                )}
              </div>

              {/* Sector table + stock list — shown for both bear AND bull cycles */}
              {(activeCycle.type === 'bear' || activeCycle.type === 'bull') && (
                <div className="flex flex-1 overflow-hidden min-h-0">
                  {/* Sector table */}
                  <div className={`flex flex-col overflow-hidden border-r border-gray-100 dark:border-gray-800 ${activeSector ? 'w-[55%]' : 'flex-1'}`}>
                    {analyzing ? (
                      <div className="flex items-center justify-center flex-1 text-[11px] text-gray-400">
                        Computing sector returns…
                      </div>
                    ) : sectors.length === 0 ? (
                      <div className="flex items-center justify-center flex-1 text-[11px] text-gray-400">
                        No sector data
                      </div>
                    ) : (
                      <div className="overflow-auto flex-1">
                        <table className="w-full border-collapse">
                          <thead className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 z-10">
                            <tr>
                              <SortTh col="index_name"        label="Sector" />
                              <SortTh col="drop_pct"          label={activeCycle.type === 'bull' ? 'Gain' : 'Drop'} />
                              <SortTh col="vs_nepse"          label="vs N" />
                              <SortTh col="recovery_pct"      label={activeCycle.type === 'bull' ? 'After' : 'Recov'} />
                              <SortTh col="recovery_progress" label="Progress" />
                              <SortTh col="recovery_days"     label="Days" />
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
                    <div className="w-[45%] flex flex-col overflow-hidden">
                      <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                          {activeSector.index_name.replace(' Index', '').replace(' Sub-Index', '')}
                        </span>
                        {selectedStock && (
                          <span className="text-[9px] text-gray-400 ml-auto">
                            click again to deselect
                          </span>
                        )}
                        <button onClick={() => { setActiveSector(null); setSelectedStock(null); setStockCandles(null) }}
                          className="ml-auto text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <StockList
                          stocks={sectorStocks[activeSector.index_name]}
                          loading={!!sectorLoading[activeSector.index_name]}
                          onSelect={handleStockSelect}
                          selected={selectedStock}
                          peakDate={activeCycle.start_date}
                          troughDate={activeCycle.end_date}
                          dark={isDark}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* No cycle selected yet */}
          {view === 'detail' && !activeCycle && (
            <div className="flex-1 flex items-center justify-center text-[11px] text-gray-400">
              Select a cycle from the left panel or click a zone on the overview chart
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
