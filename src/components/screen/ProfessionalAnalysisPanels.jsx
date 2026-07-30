import { useMemo, useState } from 'react'

const LABEL = 'text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500'
const MUTED = 'text-[10px] leading-relaxed text-gray-500 dark:text-gray-400'

function PanelShell({ children }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-800">
      {children}
    </div>
  )
}

function Section({ title, aside, children }) {
  return (
    <section className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={LABEL}>{title}</p>
        {aside && <span className="text-[9px] text-gray-400 dark:text-gray-500">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

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

function EvidenceRow({ label, value, state = 'wait', detail }) {
  const states = {
    met: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    conflict: { dot: 'bg-red-500', text: 'text-red-500 dark:text-red-400' },
    wait: { dot: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-500 dark:text-gray-400' },
    caution: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  }
  const style = states[state] || states.wait
  return (
    <div className="flex items-start gap-2 py-0.5">
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

export function ProfessionalSMCLeftPanel({ smcData, chartData, currentPrice }) {
  if (!smcData) return <EmptyPanel title="SMC context unavailable" />

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

  return (
    <PanelShell>
      <Section title="Market context" aside="confirmed structure">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={structureTone}>
            {lastBOS
              ? `${lastBOS.type === 'bullish' ? 'Bullish' : 'Bearish'} structure`
              : 'No structure break'}
          </Badge>
          <span className="text-[9px] text-gray-400">{lastBOS?.date || '—'}</span>
        </div>
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
      </Section>

      <Section title="Current location" aside="selected scan range">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric
            label="Range position"
            value={rangePct == null ? '—' : `${rangePct.toFixed(0)}%`}
            sub={rangeLabel}
            tone={
              rangePct != null && rangePct <= 35
                ? 'positive'
                : rangePct != null && rangePct >= 65
                  ? 'warning'
                  : 'neutral'
            }
          />
          <Metric
            label="Current price"
            value={fmt(currentPrice)}
            sub={`L ${fmt(rangeLow)} · H ${fmt(rangeHigh)}`}
          />
        </div>
        <p className={MUTED}>
          This is position inside the scanned high–low range, not a validated institutional dealing
          range.
        </p>
      </Section>

      <Section
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
      </Section>

      <Section title="Analysis scope">
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
      </Section>
    </PanelShell>
  )
}

export function SMCShadowEvidence({ data, loading = false, error = '' }) {
  if (loading) {
    return (
      <Section title="V2 shadow engine" aside="loading evidence">
        <div aria-label="Loading V2 shadow evidence" className="space-y-2 animate-pulse">
          <div className="h-2 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-2 w-4/5 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-2 w-3/5 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </Section>
    )
  }

  if (error) {
    return (
      <Section title="V2 shadow engine">
        <Badge tone="warning">Shadow unavailable</Badge>
        <p className={MUTED}>{error}</p>
        <p className="text-[9px] text-gray-400 dark:text-gray-500">
          V1 evidence and chart overlays continue normally.
        </p>
      </Section>
    )
  }

  if (!data) {
    return (
      <Section title="V2 shadow engine">
        <p className={MUTED}>Waiting for the internal shadow scan.</p>
      </Section>
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

  return (
    <>
      <Section title="V2 shadow engine" aside={data.asOf || undefined}>
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
      </Section>

      <Section title="V2 data quality" aside={`${data.candles || 0} candles`}>
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
      </Section>

      <Section title="V2 market context">
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
      </Section>

      <Section title="V2 evidence window" aside={`${activeTotal} bounded`}>
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
      </Section>

      {lead && (
        <Section title="V2 lead setup">
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
        </Section>
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
}) {
  const [tab, setTab] = useState('setup')
  const [legacyOpen, setLegacyOpen] = useState(false)
  if (!smcData) return <EmptyPanel title="SMC setup unavailable" />

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
    <div className="flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-950">
      <div className="grid grid-cols-2 border-b border-gray-100 dark:border-gray-800">
        {[
          ['setup', 'Setup now'],
          ['history', 'Evidence'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`py-2 text-[10px] font-semibold ${tab === id ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'setup' ? (
          <PanelShell>
            <Section title="Setup status" aside="buy-side workflow">
              <Badge tone={stage.tone}>{stage.label}</Badge>
              <p className={MUTED}>{stage.detail}</p>
              <p className="text-[9px] text-amber-600 dark:text-amber-400">
                Decision support only — not an automated trade recommendation.
              </p>
            </Section>

            <Section
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
            </Section>

            <Section title="Illustrative plan" aside="validate manually">
              {zone ? (
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
              ) : (
                <p className={MUTED}>
                  No usable bullish zone is available, so an entry and invalidation plan cannot be
                  constructed.
                </p>
              )}
            </Section>
          </PanelShell>
        ) : (
          <PanelShell>
            <SMCShadowEvidence data={shadowData} loading={shadowLoading} error={shadowError} />
            <Section title="Legacy V1 reference" aside="heuristic">
              <p className={MUTED}>
                Older V1 candidates are kept only for comparison. They have not passed the V2
                mandatory gates.
              </p>
              <button
                type="button"
                aria-expanded={legacyOpen}
                onClick={() => setLegacyOpen((open) => !open)}
                className="text-[10px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {legacyOpen ? 'Hide legacy diagnostics' : 'Show legacy diagnostics'}
              </button>
            </Section>
            {legacyOpen && (
              <>
                <Section title="V1 latest candidate">
                  {lastSignal ? (
                    <>
                      <div className="flex items-center justify-between">
                        <Badge tone="info">V1 candidate</Badge>
                        <span className="text-[9px] text-gray-400">{lastSignal.date}</span>
                      </div>
                      <p className={MUTED}>
                        Entry reference {fmt(lastSignal.entryPrice)} · {signalAge ?? '—'} candles
                        ago
                      </p>
                    </>
                  ) : (
                    <p className={MUTED}>No configured V1 candidate in the analyzed period.</p>
                  )}
                </Section>
                <Section title="V1 recent structure events">
                  {[...(smcData.bos || []), ...(smcData.choch || [])]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 6)
                    .map((event, index) => (
                      <EvidenceRow
                        key={`${event.date}-${index}`}
                        label={smcData.choch?.includes(event) ? 'V1 structure shift' : 'V1 BOS'}
                        value={`${event.type} · ${event.date}`}
                        state={event.type === 'bullish' ? 'met' : 'conflict'}
                      />
                    ))}
                </Section>
                <Section title="V1 interpretation limits">
                  <p className={MUTED}>
                    V1 signals are heuristic and historical pivot confirmation is delayed.
                    Order-block invalidation and calibrated outcome probability are not available.
                  </p>
                </Section>
              </>
            )}
          </PanelShell>
        )}
      </div>
    </div>
  )
}

export function ProfessionalPALeftPanel({ paData, currentPrice }) {
  if (!paData) return <EmptyPanel title="Price Action context unavailable" />
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

  return (
    <PanelShell>
      <Section title="Market map" aside="confirmed pivots">
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
      </Section>

      <Section title="Nearest levels" aside={`price ${fmt(currentPrice)}`}>
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
      </Section>

      <Section title="Detected zones" aside="not trade signals">
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
      </Section>

      <Section title="Analysis scope">
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Candles analyzed" value={paData.candles ?? 0} />
          <Metric label="Confirmation lag" value="10 candles" tone="warning" />
        </div>
      </Section>
    </PanelShell>
  )
}

export function ProfessionalPARightPanel({ paData, kpis, chartData, currentPrice }) {
  const [tab, setTab] = useState('now')
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

  if (!paData || !derived) return <EmptyPanel title="Price Action decision view unavailable" />
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

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-white dark:bg-gray-950">
      <div className="grid grid-cols-2 border-b border-gray-100 dark:border-gray-800">
        {[
          ['now', 'Decision view'],
          ['research', 'Research'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`py-2 text-[10px] font-semibold ${tab === id ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'now' ? (
          <PanelShell>
            <Section title="Decision snapshot">
              <Badge tone={state.tone}>{state.label}</Badge>
              <p className={MUTED}>{state.detail}</p>
              <p className="text-[9px] text-amber-600 dark:text-amber-400">
                Contextual analysis only — not an automated entry signal.
              </p>
            </Section>

            <Section title="Confluence">
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
            </Section>

            <Section title="Scenarios" aside="close-based">
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
            </Section>

            <Section title="Room and risk">
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
            </Section>
          </PanelShell>
        ) : (
          <PanelShell>
            <Section title="Bullish pattern study" aside="historical heuristic">
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
            </Section>

            <Section title="Recent evidence">
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
            </Section>

            <Section title="Interpretation limits">
              <p className={MUTED}>
                Same-candle target/stop ambiguity, fees, liquidity and out-of-sample validation are
                not included. Treat these statistics as descriptive research only.
              </p>
            </Section>
          </PanelShell>
        )}
      </div>
    </div>
  )
}
