import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useScreen } from '../../context/ScreenContext'
import { useAuth } from '../../context/AuthContext'
import { getWatchlist, clearWatchlistCache } from '../../utils/globalCache'
import { addToWatchlist, updateWatchlist } from '../../api'
import TradeModal from './TradeModal'
import {
  TIER_ACCENT,
  getDisplayTier,
  TierAccentOverlay,
  tierRingClass,
} from '../common/TierMaterial'

const MUTED = 'text-[10px] leading-relaxed text-gray-500 dark:text-gray-400'

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    positive:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    negative:
      'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    warning:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    neutral:
      'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function Metric({ label, value, sub, tone = 'neutral' }) {
  const colors = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-500 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    neutral: 'text-gray-800 dark:text-gray-100',
  }
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 p-2">
      <p className="text-[9px] text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`mt-0.5 text-[11px] font-bold tabular-nums ${colors[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[9px] text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  )
}

function ConfluenceBar({ met, total, tone = 'neutral' }) {
  if (!total) return null
  const textColors = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-500 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    neutral: 'text-gray-500 dark:text-gray-400',
  }
  const fillColors = {
    positive: 'bg-emerald-500',
    negative: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-300 dark:bg-gray-600',
  }
  const pct = Math.min(100, Math.max(0, (met / total) * 100))
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-gray-400 dark:text-gray-500">Confluence</span>
        <span className={`text-[9px] font-semibold ${textColors[tone] || textColors.neutral}`}>
          {met}/{total}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColors[tone] || fillColors.neutral}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function RangeGauge({ low, high, current, lowLabel, highLabel, tone = 'neutral' }) {
  if (![low, high, current].every((n) => Number.isFinite(Number(n))) || Number(high) <= Number(low))
    return null
  const dotColors = {
    positive: 'bg-emerald-500',
    negative: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-300 dark:bg-gray-600',
  }
  const pct = Math.min(100, Math.max(0, ((Number(current) - Number(low)) / (Number(high) - Number(low))) * 100))
  return (
    <div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 relative overflow-visible">
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border-2 border-gray-50 dark:border-gray-800 shadow-sm ${dotColors[tone] || dotColors.neutral}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[8px] text-gray-400 dark:text-gray-500">{lowLabel}</span>
        <span className="text-[8px] text-gray-400 dark:text-gray-500">{highLabel}</span>
      </div>
    </div>
  )
}

function EvidenceRow({ label, value, state = 'wait', detail }) {
  const states = {
    met: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    conflict: { dot: 'bg-red-500', text: 'text-red-500 dark:text-red-400' },
    wait: { dot: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-500 dark:text-gray-400' },
    caution: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  }
  const style = states[state] || states.wait
  return (
    <div className="flex items-start gap-2 py-0.5 rounded-md transition-colors [@media(hover:hover)]:hover:bg-gray-50/60 dark:[@media(hover:hover)]:hover:bg-gray-800/30">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-600 dark:text-gray-300">{label}</span>
          <span className={`text-[9px] font-semibold text-right ${style.text}`}>{value}</span>
        </div>
        {detail && (
          <p className="text-[9px] leading-relaxed text-gray-400 dark:text-gray-500">{detail}</p>
        )}
      </div>
    </div>
  )
}

// ── Card shell (SMC layout redesign) ────────────────────────────────────────
// PanelShell/Section stay as-is below (still used by Price Action, unchanged
// until its own redesign pass). CardStack/Card are the new SMC-only shell:
// each section becomes its own bordered card instead of one continuous
// divide-y scroll list, matching the Admin panel's HealthTile language
// (colored left edge + tinted icon badge + bold header) — owner-approved
// mockup, 2026-08-11.
// `tiered` — the left panel is the top-level styled surface, so it owns its
// own group/ring/overlay (tiered=true, default). The right panel has a tab
// switcher ABOVE this scroll area, so ITS group/ring/overlay has to live on
// the outer wrapper that contains both the tabs and this stack (otherwise
// the hover accent bar renders below the tabs instead of at the panel's own
// top edge) — pass tiered={false} there; the outer wrapper supplies it instead.
function CardStack({ children, tiered = true }) {
  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
  const base =
    'flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-900 p-2.5 space-y-2.5 animate-fade-up'
  if (!tiered) return <div className={base}>{children}</div>
  return (
    <div className={`group relative ${base} ${accent ? tierRingClass(displayTier) : ''}`}>
      <TierAccentOverlay accent={accent} radius="" />
      {children}
    </div>
  )
}

const CARD_STRIPE = {
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-300 dark:bg-gray-600',
}
const CARD_ICON_TONE = {
  positive: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  negative: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  neutral: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

function Card({ tone = 'neutral', icon, title, aside, index, children }) {
  return (
    <div
      className="hp-card group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-3.5 pr-3 space-y-2 animate-fade-up transition-colors"
      style={index != null ? { animationDelay: `${index * 40}ms` } : undefined}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${CARD_STRIPE[tone] || CARD_STRIPE.neutral}`}
      />
      <div className="flex items-center gap-2">
        <span
          className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center ${CARD_ICON_TONE[tone] || CARD_ICON_TONE.neutral}`}
        >
          {icon}
        </span>
        <p className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{title}</p>
        {aside && (
          <span className="ml-auto text-[9px] font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {aside}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'w-3 h-3',
}
const CardIcon = {
  trend: (
    <svg {...iconProps}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  ),
  location: (
    <svg {...iconProps}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  layers: (
    <svg {...iconProps}>
      <path d="M4 8h12v8H4z" />
      <path d="M8 4h12v8" />
    </svg>
  ),
  scope: (
    <svg {...iconProps}>
      <rect x="4" y="12" width="4" height="8" />
      <rect x="10" y="7" width="4" height="13" />
      <rect x="16" y="3" width="4" height="17" />
    </svg>
  ),
  pulse: (
    <svg {...iconProps}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  checklist: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  ),
  target: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  ),
}

function CardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-3.5 pr-3 space-y-2 animate-pulse">
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gray-200 dark:bg-gray-700" />
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-md bg-gray-200 dark:bg-gray-700" />
        <span className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-2 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-2 w-3/5 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

// Matches CardStack's own layout (padding/gap) so the swap-in to real cards
// once data arrives doesn't shift anything.
function CardStackSkeleton({ count = 4 }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-900 p-2.5 space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

function EmptyPanel({ title }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center">
      <div>
        <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{title}</p>
        <p className="mt-1 text-[10px] text-gray-400">
          Select a stock and wait for the analysis to load.
        </p>
      </div>
    </div>
  )
}

function fmt(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '—'
}

// ── Setup action buttons (Buy + Set Alert) ──────────────────────────────────
// Shared by SMC's "Illustrative plan" and Price Action's "Scenarios" sections —
// both are read-only analysis panels that can now act on the setup they detect.
// Owns its own state so it can be conditionally rendered by its callers (only
// when there's a usable zone/level) without touching the parent panel's hook order.
function SetupActionButtons({ symbol, entry, sl, tp }) {
  const { refreshPositions } = useScreen()
  const [tradeModal, setTradeModal] = useState(false)
  const [alertStatus, setAlertStatus] = useState(null) // { type: 'loading'|'success'|'error', message }

  const handleSetAlert = async () => {
    setAlertStatus({ type: 'loading', message: 'Saving alert…' })
    try {
      const res = await getWatchlist()
      const list = res.data || []
      const existing = list.find((w) => w.symbol?.toUpperCase() === symbol?.toUpperCase())
      if (existing) {
        await updateWatchlist(existing.id, { price_alert: entry })
      } else {
        await addToWatchlist({ symbol, price_alert: entry, category: 'active' })
      }
      clearWatchlistCache()
      setAlertStatus({ type: 'success', message: 'Alert set' })
    } catch {
      setAlertStatus({ type: 'error', message: 'Failed to set alert' })
    } finally {
      setTimeout(() => setAlertStatus(null), 2500)
    }
  }

  return (
    <>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={() => setTradeModal(true)}
          className="flex-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
        >
          Buy
        </button>
        <button
          onClick={handleSetAlert}
          disabled={alertStatus?.type === 'loading'}
          className="flex-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-2 py-1.5 text-[9px] font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
        >
          Set Alert
        </button>
      </div>
      {alertStatus && (
        <p
          className={`mt-1 text-[9px] font-semibold ${
            alertStatus.type === 'error'
              ? 'text-red-500'
              : alertStatus.type === 'success'
                ? 'text-emerald-500'
                : 'text-gray-400'
          }`}
        >
          {alertStatus.message}
        </p>
      )}
      {tradeModal &&
        createPortal(
          <TradeModal
            side="BUY"
            symbol={symbol}
            initialValues={{ entry_price: entry, sl, tp }}
            onClose={() => setTradeModal(false)}
            onSaved={() => refreshPositions()}
          />,
          document.body
        )}
    </>
  )
}

function readableLabel(value, fallback = 'Unclassified pattern') {
  if (typeof value !== 'string' || !value.trim()) return fallback
  return value.replaceAll('_', ' ')
}

function assessmentLabel(value, fallback = 'Not assessed') {
  if (typeof value === 'string') return readableLabel(value, fallback)
  if (!value || typeof value !== 'object') return fallback
  return readableLabel(
    value.classification ||
      value.severity ||
      value.state ||
      value.label ||
      value.regime ||
      value.quality,
    fallback
  )
}

function pctDistance(price, level) {
  if (!(price > 0) || !Number.isFinite(Number(level))) return null
  return ((Number(level) - price) / price) * 100
}

function fmtPct(value, { absolute = false, plus = false } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const display = absolute ? Math.abs(number) : number
  return `${plus && display > 0 ? '+' : ''}${display.toFixed(1)}%`
}

function zoneDistance(price, zone) {
  if (!(price > 0) || !zone) return Infinity
  const top = Number(zone.top ?? zone.high)
  const bottom = Number(zone.bottom ?? zone.low)
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return Infinity
  if (price >= bottom && price <= top) return 0
  const boundary = price < bottom ? bottom : top
  return Math.abs(((boundary - price) / price) * 100)
}

function nearestZone(price, zones) {
  if (!(price > 0)) return null
  return (
    [...(zones || [])].sort((a, b) => zoneDistance(price, a) - zoneDistance(price, b))[0] || null
  )
}

function eventAge(date, chartData) {
  if (!date || !chartData?.length) return null
  const index = chartData.findIndex((c) => c.time === date)
  return index < 0 ? null : chartData.length - 1 - index
}

const SMC_CONFIG_KEYS = {
  bos: 'useBOS',
  choch: 'useCHoCH',
  discount: 'useDiscount',
  ob: 'useOB',
  fvg: 'useFVG',
  sweep: 'useSweep',
}

export function ProfessionalSMCLeftPanel({ smcData, chartData, currentPrice, loading }) {
  if (!smcData) {
    if (loading) return <CardStackSkeleton count={4} />
    return <EmptyPanel title="SMC context unavailable" />
  }

  const lastBOS = smcData.bos?.at(-1)
  const lastChoch = smcData.choch?.at(-1)
  const bullishZones = [
    ...(smcData.order_blocks || [])
      .filter((zone) => zone.type === 'bullish')
      .map((zone) => ({ ...zone, detectedKind: 'Bullish order block' })),
    ...(smcData.fvg || [])
      .filter((zone) => zone.type === 'bullish' && !zone.mitigated)
      .map((zone) => ({ ...zone, detectedKind: 'Bullish FVG' })),
  ]
  const nearest = nearestZone(currentPrice, bullishZones)
  const nearestKind = nearest?.detectedKind
  const rangeHigh = chartData?.length ? Math.max(...chartData.map((c) => Number(c.high))) : 0
  const rangeLow = chartData?.length ? Math.min(...chartData.map((c) => Number(c.low))) : 0
  const rangePct =
    rangeHigh > rangeLow && currentPrice > 0
      ? ((currentPrice - rangeLow) / (rangeHigh - rangeLow)) * 100
      : null
  const rangeLabel =
    rangePct == null
      ? 'Unknown'
      : rangePct <= 35
        ? 'Lower range'
        : rangePct >= 65
          ? 'Upper range'
          : 'Mid range'
  const structureTone =
    lastBOS?.type === 'bullish' ? 'positive' : lastBOS?.type === 'bearish' ? 'negative' : 'neutral'
  const rangeTone =
    rangePct != null && rangePct <= 35
      ? 'positive'
      : rangePct != null && rangePct >= 65
        ? 'warning'
        : 'neutral'

  return (
    <CardStack>
      <Card
        index={0}
        tone={structureTone}
        icon={CardIcon.trend}
        title="Market context"
        aside={lastBOS?.date || undefined}
      >
        <Badge tone={structureTone}>
          {lastBOS
            ? `${lastBOS.type === 'bullish' ? 'Bullish' : 'Bearish'} structure`
            : 'No structure break'}
        </Badge>
        <EvidenceRow
          label="Last BOS"
          value={lastBOS ? `${fmt(lastBOS.level)} · ${lastBOS.type}` : 'Not detected'}
          state={
            lastBOS?.type === 'bullish' ? 'met' : lastBOS?.type === 'bearish' ? 'conflict' : 'wait'
          }
        />
        <EvidenceRow
          label="Last structure shift"
          value={lastChoch ? `${fmt(lastChoch.level)} · ${lastChoch.type}` : 'Not detected'}
          state={
            lastChoch?.type === 'bullish'
              ? 'met'
              : lastChoch?.type === 'bearish'
                ? 'conflict'
                : 'wait'
          }
          detail="CHoCH is treated as a warning, not a confirmed reversal."
        />
      </Card>

      <Card index={1} tone="neutral" icon={CardIcon.location} title="Current location" aside="selected scan range">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric
            label="Range position"
            value={rangePct == null ? '—' : `${rangePct.toFixed(0)}%`}
            sub={rangeLabel}
            tone={rangeTone}
          />
          <Metric
            label="Current price"
            value={fmt(currentPrice)}
            sub={`L ${fmt(rangeLow)} · H ${fmt(rangeHigh)}`}
          />
        </div>
        <RangeGauge
          low={rangeLow}
          high={rangeHigh}
          current={currentPrice}
          lowLabel={fmt(rangeLow)}
          highLabel={fmt(rangeHigh)}
          tone={rangeTone}
        />
        <p className={MUTED}>
          This is position inside the scanned high–low range, not a validated institutional dealing
          range.
        </p>
      </Card>

      <Card
        index={2}
        tone={nearest ? 'info' : 'neutral'}
        icon={CardIcon.layers}
        title="Nearest detected zone"
        aside={
          nearest
            ? `${fmtPct(zoneDistance(currentPrice, nearest), { absolute: true })} away`
            : undefined
        }
      >
        {nearest ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <Badge tone="info">{nearestKind}</Badge>
              <span className="font-mono text-[10px] text-gray-700 dark:text-gray-300">
                {fmt(nearest.bottom ?? nearest.low)}–{fmt(nearest.top ?? nearest.high)}
              </span>
            </div>
            <p className={MUTED}>
              Detected {nearest.date}. Order-block invalidation is not yet tracked, so validate this
              zone before use.
            </p>
          </>
        ) : (
          <p className={MUTED}>
            No bullish order block or unfilled bullish FVG was returned for this scan.
          </p>
        )}
      </Card>

      <Card index={3} tone="neutral" icon={CardIcon.scope} title="Analysis scope">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Candles analyzed" value={smcData.candles ?? 0} />
          <Metric
            label="Confirmation lag"
            value="10 candles"
            sub="for swing pivots"
            tone="warning"
          />
        </div>
        <p className={MUTED}>
          The newest ten candles cannot form a confirmed pivot. Historical markers identify pivot
          dates, not the later date when confirmation became available.
        </p>
      </Card>
    </CardStack>
  )
}

export function SMCShadowEvidence({ data, loading = false, error = '' }) {
  if (loading) {
    return (
      <Card tone="neutral" icon={CardIcon.pulse} title="V2 shadow engine" aside="loading evidence">
        <div aria-label="Loading V2 shadow evidence" className="space-y-2 animate-pulse">
          <div className="h-2 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 w-3/5 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card tone="warning" icon={CardIcon.pulse} title="V2 shadow engine">
        <Badge tone="warning">Shadow unavailable</Badge>
        <p className={MUTED}>{error}</p>
        <p className="text-[9px] text-gray-400 dark:text-gray-500">
          V1 evidence and chart overlays continue normally.
        </p>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card tone="neutral" icon={CardIcon.pulse} title="V2 shadow engine">
        <p className={MUTED}>Waiting for the internal shadow scan.</p>
      </Card>
    )
  }

  const active = data.active || {}
  const counts = {
    structure: active.structureEvents?.length || 0,
    liquidity: active.liquidityEvents?.length || 0,
    pools: active.liquidityPools?.length || 0,
    orderBlocks: active.orderBlocks?.length || 0,
    fairValueGaps: active.fairValueGaps?.length || 0,
  }
  const activeTotal = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const recentEvidence = [
    ...(active.orderBlocks || []),
    ...(active.fairValueGaps || []),
    ...(active.liquidityEvents || []),
  ]
    .sort((a, b) =>
      String(b.confirmedAt || b.detectedAt || b.originTime || '').localeCompare(
        String(a.confirmedAt || a.detectedAt || a.originTime || '')
      )
    )
    .slice(0, 5)
  const decisionState = data.decision?.state || 'SCANNING'
  const decisionTone =
    decisionState === 'AVOID' || decisionState === 'INVALIDATED'
      ? 'negative'
      : decisionState === 'DEVELOPING'
        ? 'info'
        : decisionState === 'ARMED' || decisionState === 'ENTERED' || decisionState === 'LATE'
          ? 'warning'
          : 'neutral'
  const quality = data.dataQuality?.quality || 'UNKNOWN'
  const qualityState =
    quality === 'QUALIFIED' ? 'met' : quality === 'REJECTED' ? 'conflict' : 'caution'
  const qualityDetail =
    quality === 'LIMITED' && data.dataQuality?.summary?.adjustmentVerified === false
      ? 'Coverage is usable, but corporate-action adjustment has not been independently verified.'
      : quality === 'REJECTED'
        ? 'The available history did not pass the mandatory dataset checks.'
        : 'The dataset passed the current qualification checks.'
  const lead = data.decision?.leadSetup
  const qualityTone =
    qualityState === 'met' ? 'positive' : qualityState === 'conflict' ? 'negative' : 'warning'
  const marketTone =
    data.context?.structureBias === 'BULLISH'
      ? 'positive'
      : data.context?.structureBias === 'BEARISH'
        ? 'negative'
        : 'neutral'
  const leadTone =
    lead?.decisionState === 'ENTERED' ? 'positive' : lead?.decisionState === 'ARMED' ? 'warning' : 'neutral'

  return (
    <>
      <Card index={0} tone={decisionTone} icon={CardIcon.pulse} title="V2 shadow engine" aside={data.asOf || undefined}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={decisionTone}>{readableLabel(decisionState, 'Scanning')}</Badge>
          <Badge tone="warning">UNVALIDATED · HOLD</Badge>
        </div>
        <p className={MUTED}>
          {data.decision?.reason || 'No authenticated setup currently satisfies every V2 gate.'}
        </p>
        <EvidenceRow
          label="Next confirmation"
          value={data.decision?.nextConfirmation || lead?.nextConfirmation || 'Not available'}
          state="wait"
        />
        <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
          SHADOW ONLY — internal evidence, not a trade recommendation.
        </p>
      </Card>

      <Card
        index={1}
        tone={qualityTone}
        icon={CardIcon.checklist}
        title="V2 data quality"
        aside={`${data.candles || 0} candles`}
      >
        <EvidenceRow label="Dataset" value={quality} state={qualityState} detail={qualityDetail} />
        <EvidenceRow
          label="Exploratory scan"
          value={data.dataQuality?.canScan ? 'Allowed' : 'Blocked'}
          state={data.dataQuality?.canScan ? 'met' : 'conflict'}
        />
        <EvidenceRow
          label="Reliability"
          value={data.reliability?.label || 'UNVALIDATED'}
          state="caution"
          detail="Engineering correctness is separate from future trading performance."
        />
      </Card>

      <Card index={2} tone={marketTone} icon={CardIcon.trend} title="V2 market context">
        <EvidenceRow
          label="Structure"
          value={readableLabel(data.context?.structureBias, 'Not established')}
          state={
            data.context?.structureBias === 'BULLISH'
              ? 'met'
              : data.context?.structureBias === 'BEARISH'
                ? 'conflict'
                : 'wait'
          }
        />
        <EvidenceRow
          label="Regime"
          value={assessmentLabel(data.context?.regime)}
          state={data.context?.regime ? 'met' : 'wait'}
        />
        <EvidenceRow
          label="Execution"
          value={assessmentLabel(data.context?.execution)}
          state={
            data.context?.execution?.severity === 'BLOCK'
              ? 'conflict'
              : data.context?.execution?.severity === 'CAUTION'
                ? 'caution'
                : data.context?.execution
                  ? 'met'
                  : 'wait'
          }
          detail={data.context?.execution?.explanation}
        />
      </Card>

      <Card
        index={3}
        tone="neutral"
        icon={CardIcon.layers}
        title="V2 evidence window"
        aside={`${activeTotal} bounded`}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Recent structure" value={counts.structure} />
          <Metric label="Recent liquidity" value={counts.liquidity} />
          <Metric label="Tracked pools" value={counts.pools} />
          <Metric label="Active order blocks" value={counts.orderBlocks} tone="positive" />
          <Metric label="Active FVGs" value={counts.fairValueGaps} tone="info" />
          <Metric label="Setup candidates" value={active.setups?.length || 0} tone="warning" />
        </div>
        {recentEvidence.length ? (
          <div className="space-y-0.5 pt-1">
            {recentEvidence.map((event, index) => (
              <EvidenceRow
                key={event.id || `${event.type}-${event.originTime}-${index}`}
                label={readableLabel(event.type, 'Lifecycle event')}
                value={`${readableLabel(event.direction, 'neutral')} · ${
                  event.confirmedAt || event.detectedAt || event.originTime || 'date unavailable'
                }`}
                state={event.status === 'ACTIVE' ? 'met' : 'wait'}
                detail={`Origin ${event.originTime || '—'} · ${readableLabel(event.status, 'tracked')}`}
              />
            ))}
          </div>
        ) : (
          <p className={MUTED}>No active OB, FVG or liquidity lifecycle evidence was returned.</p>
        )}
      </Card>

      {lead && (
        <Card index={4} tone={leadTone} icon={CardIcon.target} title="V2 lead setup">
          <EvidenceRow
            label={readableLabel(lead.family, 'Setup family')}
            value={readableLabel(lead.decisionState || lead.status, 'Developing')}
            state={
              lead.decisionState === 'ENTERED'
                ? 'met'
                : lead.decisionState === 'ARMED'
                  ? 'caution'
                  : 'wait'
            }
            detail={lead.reason}
          />
          <p className={MUTED}>
            {lead.nextConfirmation
              ? `Needs: ${lead.nextConfirmation}`
              : 'No further confirmation is recorded in this shadow snapshot.'}
          </p>
        </Card>
      )}
    </>
  )
}

export function ProfessionalSMCRightPanel({
  smcData,
  signals,
  config,
  chartData,
  currentPrice,
  shadowData,
  shadowLoading,
  shadowError,
  loading,
}) {
  const [tab, setTab] = useState('setup')
  const { user } = useAuth()
  if (!smcData) {
    if (loading) return <CardStackSkeleton count={3} />
    return <EmptyPanel title="SMC setup unavailable" />
  }

  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]

  const lastSignal = signals?.at(-1)
  const signalAge = eventAge(lastSignal?.date, chartData)
  const lastBOS = smcData.bos?.at(-1)
  const lastChoch = smcData.choch?.at(-1)
  const recentSweep = [...(smcData.sweeps || [])]
    .reverse()
    .find((sweep) => sweep.type === 'buy_side' && (eventAge(sweep.date, chartData) ?? 99) <= 15)
  const bullishZones = [
    ...(smcData.order_blocks || []).filter((zone) => zone.type === 'bullish'),
    ...(smcData.fvg || []).filter((zone) => zone.type === 'bullish' && !zone.mitigated),
  ]
  const zone = nearestZone(currentPrice, bullishZones)
  const nearZone = zoneDistance(currentPrice, zone) <= 2
  const enabledConditions = Object.entries(SMC_CONFIG_KEYS).filter(
    ([, configKey]) => config?.[configKey] !== false
  )
  const metConditions = enabledConditions.filter(
    ([condition]) => lastSignal?.conditions?.[condition]
  )
  const bearishConflict =
    lastBOS?.type === 'bearish' ||
    (lastChoch?.type === 'bearish' && (!lastBOS?.date || lastChoch.date >= lastBOS.date))

  let stage = {
    label: 'No qualified setup',
    tone: 'neutral',
    detail: 'Waiting for bullish structure and location.',
  }
  if (lastBOS?.type === 'bullish')
    stage = {
      label: 'Bias established',
      tone: 'info',
      detail: 'Bullish structure exists; price location is next.',
    }
  if (lastBOS?.type === 'bullish' && nearZone)
    stage = {
      label: 'Watching zone',
      tone: 'warning',
      detail: 'Price is at or near a detected bullish zone.',
    }
  if (lastBOS?.type === 'bullish' && nearZone && recentSweep)
    stage = {
      label: 'Setup armed',
      tone: 'positive',
      detail: 'Location and a recent lower-liquidity sweep align.',
    }
  if (lastSignal && signalAge != null && signalAge <= 3)
    stage = {
      label: 'Heuristic candidate',
      tone: 'positive',
      detail: 'The configured conditions recently reached their threshold.',
    }
  if (bearishConflict)
    stage = {
      label: 'Conflicting structure',
      tone: 'negative',
      detail: 'Bearish structure evidence is still present.',
    }

  const zoneBottom = Number(zone?.bottom ?? zone?.low)
  const zoneTop = Number(zone?.top ?? zone?.high)
  const target = (smcData.order_blocks || [])
    .filter((candidate) => candidate.type === 'bearish' && Number(candidate.low) > currentPrice)
    .sort((a, b) => Number(a.low) - Number(b.low))[0]?.low
  const risk = currentPrice > zoneBottom ? currentPrice - zoneBottom : null
  const reward = Number(target) > currentPrice ? Number(target) - currentPrice : null
  const rr = risk > 0 && reward > 0 ? reward / risk : null

  return (
    <div
      className={`group relative flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-900 ${accent ? tierRingClass(displayTier) : ''}`}
    >
      <TierAccentOverlay accent={accent} radius="" />
      <div className="p-2 bg-white dark:bg-gray-900">
        <div className="flex gap-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1">
          {[
            ['setup', 'Setup now'],
            ['history', 'Evidence'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                tab === id
                  ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-400 dark:text-gray-500 [@media(hover:hover)]:hover:text-gray-600 dark:[@media(hover:hover)]:hover:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'setup' ? (
          <CardStack tiered={false}>
            <Card index={0} tone={stage.tone} icon={CardIcon.pulse} title="Setup status" aside="buy-side workflow">
              <Badge tone={stage.tone}>{stage.label}</Badge>
              <ConfluenceBar met={metConditions.length} total={enabledConditions.length} tone={stage.tone} />
              <p className={MUTED}>{stage.detail}</p>
              <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                Decision support only — not an automated trade recommendation.
              </p>
            </Card>

            <Card
              index={1}
              tone="neutral"
              icon={CardIcon.checklist}
              title="Decision evidence"
              aside={`${metConditions.length}/${enabledConditions.length} enabled met`}
            >
              <EvidenceRow
                label="Structure"
                value={
                  lastBOS?.type === 'bullish'
                    ? 'Bullish BOS'
                    : lastBOS?.type === 'bearish'
                      ? 'Bearish BOS'
                      : 'Waiting'
                }
                state={
                  lastBOS?.type === 'bullish'
                    ? 'met'
                    : lastBOS?.type === 'bearish'
                      ? 'conflict'
                      : 'wait'
                }
              />
              <EvidenceRow
                label="Location"
                value={
                  zone
                    ? nearZone
                      ? 'At detected zone'
                      : `${fmtPct(zoneDistance(currentPrice, zone), { absolute: true })} from zone`
                    : 'No zone'
                }
                state={nearZone ? 'met' : zone ? 'wait' : 'caution'}
              />
              <EvidenceRow
                label="Liquidity"
                value={recentSweep ? `Recent sweep · ${recentSweep.date}` : 'No recent sweep'}
                state={recentSweep ? 'met' : 'wait'}
                detail="Current API naming uses buy-side for a sweep below a swing low."
              />
              <EvidenceRow
                label="Configured trigger"
                value={
                  lastSignal
                    ? `${metConditions.length}/${enabledConditions.length} conditions`
                    : 'Not triggered'
                }
                state={lastSignal && signalAge != null && signalAge <= 3 ? 'met' : 'wait'}
              />
            </Card>

            <Card index={2} tone="info" icon={CardIcon.target} title="Illustrative plan" aside="validate manually">
              {zone ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Metric
                      label="Entry area"
                      value={`${fmt(zoneBottom)}–${fmt(zoneTop)}`}
                      tone="info"
                    />
                    <Metric
                      label="Invalidation"
                      value={fmt(zoneBottom)}
                      sub="close below zone"
                      tone="negative"
                    />
                    <Metric
                      label="Next supply"
                      value={fmt(target)}
                      sub={target ? 'detected bearish OB' : 'not available'}
                    />
                    <Metric
                      label="Indicative R:R"
                      value={rr ? `${rr.toFixed(1)}R` : '—'}
                      sub="before fees/slippage"
                      tone={rr >= 2 ? 'positive' : rr ? 'warning' : 'neutral'}
                    />
                  </div>
                  <SetupActionButtons
                    symbol={smcData.symbol}
                    entry={currentPrice}
                    sl={zoneBottom}
                    tp={target}
                  />
                </>
              ) : (
                <p className={MUTED}>
                  No usable bullish zone is available, so an entry and invalidation plan cannot be
                  constructed.
                </p>
              )}
            </Card>
          </CardStack>
        ) : (
          <CardStack tiered={false}>
            <SMCShadowEvidence data={shadowData} loading={shadowLoading} error={shadowError} />
          </CardStack>
        )}
      </div>
    </div>
  )
}

export function ProfessionalPALeftPanel({ paData, currentPrice, loading }) {
  if (!paData) {
    if (loading) return <CardStackSkeleton count={4} />
    return <EmptyPanel title="Price Action context unavailable" />
  }
  const {
    structure,
    support_resistance: levels = [],
    demand_supply: zones = [],
    swings = [],
  } = paData
  const resistance = levels
    .filter((level) => level.type === 'resistance' && Number(level.price) > currentPrice)
    .sort((a, b) => a.price - b.price)[0]
  const support = levels
    .filter((level) => level.type === 'support' && Number(level.price) < currentPrice)
    .sort((a, b) => b.price - a.price)[0]
  const demand = nearestZone(
    currentPrice,
    zones.filter((zone) => zone.type === 'demand')
  )
  const supply = nearestZone(
    currentPrice,
    zones.filter((zone) => zone.type === 'supply')
  )
  const trendTone =
    structure?.trend === 'uptrend'
      ? 'positive'
      : structure?.trend === 'downtrend'
        ? 'negative'
        : 'neutral'

  const zonesTone = demand || supply ? 'info' : 'neutral'

  return (
    <CardStack>
      <Card index={0} tone={trendTone} icon={CardIcon.trend} title="Market map" aside="confirmed pivots">
        <div className="flex items-center justify-between">
          <Badge tone={trendTone}>{structure?.trend || 'Undetermined'}</Badge>
          <span className="text-[9px] text-gray-400">{swings.length} recent swings</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric
            label="Latest confirmed high"
            value={fmt(structure?.last_hh_price ?? structure?.last_lh_price)}
          />
          <Metric
            label="Latest confirmed low"
            value={fmt(structure?.last_hl_price ?? structure?.last_ll_price)}
          />
        </div>
        <p className={MUTED}>
          Pivots require ten later candles to confirm, so the newest market turn may not appear yet.
        </p>
      </Card>

      <Card index={1} tone="neutral" icon={CardIcon.location} title="Nearest levels" aside={`price ${fmt(currentPrice)}`}>
        <EvidenceRow
          label="Resistance"
          value={
            resistance
              ? `${fmt(resistance.price)} · ${fmtPct(pctDistance(currentPrice, resistance.price), { plus: true })}`
              : 'Not detected'
          }
          state={resistance ? 'caution' : 'wait'}
          detail={
            resistance
              ? `${resistance.touches} clustered touches · ${resistance.strength}`
              : undefined
          }
        />
        <EvidenceRow
          label="Support"
          value={
            support
              ? `${fmt(support.price)} · ${fmtPct(pctDistance(currentPrice, support.price))}`
              : 'Not detected'
          }
          state={support ? 'met' : 'wait'}
          detail={
            support ? `${support.touches} clustered touches · ${support.strength}` : undefined
          }
        />
      </Card>

      <Card index={2} tone={zonesTone} icon={CardIcon.layers} title="Detected zones" aside="not trade signals">
        <EvidenceRow
          label="Nearest demand"
          value={demand ? `${fmt(demand.bottom)}–${fmt(demand.top)}` : 'None'}
          state={demand && zoneDistance(currentPrice, demand) <= 2 ? 'met' : 'wait'}
          detail={
            demand
              ? `${fmtPct(zoneDistance(currentPrice, demand), { absolute: true })} away · origin ${demand.origin_date}`
              : undefined
          }
        />
        <EvidenceRow
          label="Nearest supply"
          value={supply ? `${fmt(supply.bottom)}–${fmt(supply.top)}` : 'None'}
          state={supply && zoneDistance(currentPrice, supply) <= 2 ? 'caution' : 'wait'}
          detail={
            supply
              ? `${fmtPct(zoneDistance(currentPrice, supply), { absolute: true })} away · origin ${supply.origin_date}`
              : undefined
          }
        />
        <p className={MUTED}>
          Zone invalidation is currently checked for a limited forward window; older zones should be
          manually verified.
        </p>
      </Card>

      <Card index={3} tone="neutral" icon={CardIcon.scope} title="Analysis scope">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Candles analyzed" value={paData.candles ?? 0} />
          <Metric label="Confirmation lag" value="10 candles" tone="warning" />
        </div>
      </Card>
    </CardStack>
  )
}

export function ProfessionalPARightPanel({ paData, kpis, chartData, currentPrice, loading }) {
  const [tab, setTab] = useState('now')
  const { user } = useAuth()
  const derived = useMemo(() => {
    if (!paData) return null
    const levels = paData.support_resistance || []
    const resistance = levels
      .filter((level) => level.type === 'resistance' && Number(level.price) > currentPrice)
      .sort((a, b) => a.price - b.price)[0]
    const support = levels
      .filter((level) => level.type === 'support' && Number(level.price) < currentPrice)
      .sort((a, b) => b.price - a.price)[0]
    const demand = nearestZone(
      currentPrice,
      (paData.demand_supply || []).filter((zone) => zone.type === 'demand')
    )
    const recentBullPattern = [...(paData.patterns || [])]
      .reverse()
      .find(
        (pattern) =>
          pattern?.direction === 'bull' && (eventAge(pattern?.date, chartData) ?? 99) <= 5
      )
    const recentBearPattern = [...(paData.patterns || [])]
      .reverse()
      .find(
        (pattern) =>
          pattern?.direction === 'bear' && (eventAge(pattern?.date, chartData) ?? 99) <= 5
      )
    const recentVolume = [...(paData.volume_spikes || [])]
      .reverse()
      .find((spike) => (eventAge(spike?.date, chartData) ?? 99) <= 5)
    const atDemand = zoneDistance(currentPrice, demand) <= 2
    return {
      resistance,
      support,
      demand,
      recentBullPattern,
      recentBearPattern,
      recentVolume,
      atDemand,
    }
  }, [paData, chartData, currentPrice])

  if (!paData || !derived) {
    if (loading) return <CardStackSkeleton count={4} />
    return <EmptyPanel title="Price Action decision view unavailable" />
  }

  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]
  const trend = paData.structure?.trend
  const bullishBias = trend === 'uptrend'
  const bearishBias = trend === 'downtrend'
  const confirmation = derived.recentBullPattern
  const bullAge = eventAge(derived.recentBullPattern?.date, chartData) ?? Infinity
  const bearAge = eventAge(derived.recentBearPattern?.date, chartData) ?? Infinity
  const activeBearPattern = derived.recentBearPattern && bearAge <= bullAge
  const conflict = activeBearPattern || bearishBias
  let state = {
    label: 'No immediate setup',
    tone: 'neutral',
    detail: 'Price is not combining trend, location and confirmation.',
  }
  if (bullishBias)
    state = {
      label: 'Bullish context',
      tone: 'info',
      detail: 'Structure is constructive; wait for a useful location.',
    }
  if (bullishBias && derived.atDemand)
    state = {
      label: 'Watching demand',
      tone: 'warning',
      detail: 'Price is near detected demand; confirmation is still required.',
    }
  if (bullishBias && derived.atDemand && confirmation)
    state = {
      label: 'Bullish candidate',
      tone: 'positive',
      detail: 'Trend, location and recent candle confirmation align.',
    }
  if (conflict)
    state = {
      label: 'Conflicting evidence',
      tone: 'negative',
      detail: 'Bearish structure or confirmation weakens the bullish case.',
    }

  const confluenceMet = [
    bullishBias,
    derived.atDemand,
    !!confirmation && !activeBearPattern,
    derived.recentVolume?.type === 'bull',
  ].filter(Boolean).length

  const patternTone = kpis ? (kpis.winRate >= 50 ? 'positive' : 'warning') : 'neutral'

  return (
    <div
      className={`group relative flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-900 ${accent ? tierRingClass(displayTier) : ''}`}
    >
      <TierAccentOverlay accent={accent} radius="" />
      <div className="p-2 bg-white dark:bg-gray-900">
        <div className="flex gap-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1">
          {[
            ['now', 'Decision view'],
            ['research', 'Research'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                tab === id
                  ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-400 dark:text-gray-500 [@media(hover:hover)]:hover:text-gray-600 dark:[@media(hover:hover)]:hover:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'now' ? (
          <CardStack tiered={false}>
            <Card index={0} tone={state.tone} icon={CardIcon.pulse} title="Decision snapshot">
              <Badge tone={state.tone}>{state.label}</Badge>
              <ConfluenceBar met={confluenceMet} total={4} tone={state.tone} />
              <p className={MUTED}>{state.detail}</p>
              <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                Contextual analysis only — not an automated entry signal.
              </p>
            </Card>

            <Card index={1} tone="neutral" icon={CardIcon.checklist} title="Confluence">
              <EvidenceRow
                label="Structure"
                value={trend || 'Undetermined'}
                state={bullishBias ? 'met' : bearishBias ? 'conflict' : 'wait'}
              />
              <EvidenceRow
                label="Location"
                value={
                  derived.demand
                    ? derived.atDemand
                      ? 'Near demand'
                      : `${fmtPct(zoneDistance(currentPrice, derived.demand), { absolute: true })} from demand`
                    : 'No demand zone'
                }
                state={derived.atDemand ? 'met' : 'wait'}
              />
              <EvidenceRow
                label="Candle confirmation"
                value={
                  activeBearPattern
                    ? readableLabel(activeBearPattern.type)
                    : confirmation
                      ? readableLabel(confirmation.type)
                      : 'None in last 5 candles'
                }
                state={activeBearPattern ? 'conflict' : confirmation ? 'met' : 'wait'}
              />
              <EvidenceRow
                label="Relative volume"
                value={
                  derived.recentVolume
                    ? `${derived.recentVolume.ratio}× · ${derived.recentVolume.type}`
                    : 'No recent spike'
                }
                state={
                  derived.recentVolume?.type === 'bull'
                    ? 'met'
                    : derived.recentVolume
                      ? 'caution'
                      : 'wait'
                }
              />
            </Card>

            <Card index={2} tone="info" icon={CardIcon.target} title="Scenarios" aside="close-based">
              <EvidenceRow
                label="Bullish"
                value={
                  derived.resistance ? `Above ${fmt(derived.resistance.price)}` : 'No target level'
                }
                state="met"
                detail={
                  derived.resistance
                    ? 'A close above resistance would support continuation.'
                    : 'The scanner did not return overhead resistance.'
                }
              />
              <EvidenceRow
                label="Invalidation"
                value={
                  derived.demand
                    ? `Below ${fmt(derived.demand.bottom)}`
                    : derived.support
                      ? `Below ${fmt(derived.support.price)}`
                      : 'Not available'
                }
                state="conflict"
                detail="A close below this reference weakens the current bullish thesis."
              />
              <EvidenceRow
                label="Neutral"
                value={
                  derived.support && derived.resistance
                    ? `${fmt(derived.support.price)}–${fmt(derived.resistance.price)}`
                    : 'Wait for structure'
                }
                state="wait"
                detail="Inside the range, avoid treating every candle pattern as a new setup."
              />
              {derived.demand && derived.resistance && (
                <SetupActionButtons
                  symbol={paData.symbol}
                  entry={currentPrice}
                  sl={derived.demand.bottom}
                  tp={derived.resistance.price}
                />
              )}
            </Card>

            <Card index={3} tone="info" icon={CardIcon.location} title="Room and risk">
              <RangeGauge
                low={derived.support?.price}
                high={derived.resistance?.price}
                current={currentPrice}
                lowLabel={derived.support ? fmt(derived.support.price) : ''}
                highLabel={derived.resistance ? fmt(derived.resistance.price) : ''}
                tone="info"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Metric
                  label="Room to resistance"
                  value={
                    derived.resistance
                      ? fmtPct(pctDistance(currentPrice, derived.resistance.price), {
                          absolute: true,
                        })
                      : '—'
                  }
                  tone="positive"
                />
                <Metric
                  label="Distance to support"
                  value={
                    derived.support
                      ? fmtPct(pctDistance(currentPrice, derived.support.price), { absolute: true })
                      : '—'
                  }
                  tone="negative"
                />
              </div>
            </Card>
          </CardStack>
        ) : (
          <CardStack tiered={false}>
            <Card
              index={0}
              tone={patternTone}
              icon={CardIcon.scope}
              title="Bullish pattern study"
              aside="historical heuristic"
            >
              {kpis ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <Metric
                    label="Resolved win rate"
                    value={`${kpis.winRate}%`}
                    sub={`${kpis.wins}W · ${kpis.losses}L`}
                    tone={kpis.winRate >= 50 ? 'positive' : 'warning'}
                  />
                  <Metric
                    label="Resolved sample"
                    value={kpis.totalSignals}
                    sub={`${kpis.pending} unresolved`}
                  />
                  <Metric label="Volume spikes / 30" value={kpis.spikeFreq.toFixed(1)} />
                  <Metric label="Average S/R touches" value={kpis.avgTouches.toFixed(1)} />
                </div>
              ) : (
                <p className={MUTED}>Not enough data for the current outcome study.</p>
              )}
              <p className={MUTED}>
                This is not a page-wide strategy win rate. It studies bullish candle patterns using
                +3% versus −2% thresholds over ten later candles.
              </p>
            </Card>

            <Card index={1} tone="neutral" icon={CardIcon.checklist} title="Recent evidence">
              {[...(paData.patterns || [])]
                .filter(Boolean)
                .reverse()
                .slice(0, 5)
                .map((pattern, index) => (
                  <EvidenceRow
                    key={`${pattern.date}-${index}`}
                    label={readableLabel(pattern.type)}
                    value={pattern.date}
                    state={
                      pattern.direction === 'bull'
                        ? 'met'
                        : pattern.direction === 'bear'
                          ? 'conflict'
                          : 'wait'
                    }
                  />
                ))}
            </Card>

            <Card index={2} tone="neutral" icon={CardIcon.layers} title="Interpretation limits">
              <p className={MUTED}>
                Same-candle target/stop ambiguity, fees, liquidity and out-of-sample validation are
                not included. Treat these statistics as descriptive research only.
              </p>
            </Card>
          </CardStack>
        )}
      </div>
    </div>
  )
}
