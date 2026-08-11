// === BacktestSetupPanel.jsx — session setup form (symbol, date, capital, mode, SL) ===
// SCR-15 (2026-08-11): "trade ticket" redesign — replaces the earlier card-per-group
// pass (07a8f04) that reused the same stripe+tinted-icon language as every other panel
// in the app. This form is functionally a ticket (you fill in the terms of a session
// before it runs), so it's built like one: dashed perforations between the three field
// groups instead of separate bordered cards, right-aligned tabular-nums value rows
// instead of boxed inputs, and punch-style checkbox toggles instead of pill toggles.
// Root stays borderless/boundary-less — both call sites in BacktestHome.jsx already
// supply their own outer card border + "New Backtest" header, so no ticket-head row
// or outer border lives in this file.

import { useState, useCallback } from 'react'
import { btGetSymbols, btGetSymbolMeta, btCreateSession } from '../../api/backtest'
import { isNepseWeekend } from '../../utils/nepseCalendar'
import SymbolSearch from '../common/SymbolSearch'

const SPEEDS = ['0.5', '1', '2', '5', '10']
const DEFAULT_CAPITAL = '100000' // Rs. 1 lakh
const DEFAULT_LOOKBACK_YEARS = 2

// Design tokens (copied per-file per pm/docs/design.md — no shared ui.js)
const FIELD_NAME = 'text-[11px] text-gray-600 dark:text-gray-400'
const FIELD_ROW = 'flex items-baseline justify-between gap-2.5'
// Underlined, right-aligned, tabular value field — replaces the old full-box INPUT so
// fields read as ticket line items rather than form boxes.
const VALUE_INPUT =
  'flex-1 min-w-0 bg-transparent border-0 border-b border-gray-100 dark:border-gray-800 focus:border-blue-500 outline-none text-right text-[12.5px] font-semibold tabular-nums text-gray-900 dark:text-white py-1 placeholder-gray-300 dark:placeholder-gray-600'
const GROUP = 'py-3.5 border-b border-dashed border-gray-100 dark:border-gray-800'
const GROUP_LAST = 'py-3.5'

// Punch-toggle active tint — border + light fill (NOT a solid fill; that treatment is
// reserved for the chip presets below, matching the mockup's distinction between the
// two control types).
const PUNCH_ON = {
  blue: 'border-blue-600 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400',
  orange: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400',
}
const PUNCH_OFF =
  'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'

// ── Icons (viewBox 0 0 24 24, stroke currentColor, strokeWidth 2.2 — paths copied
// verbatim from the approved mockup) ─────────────────────────────────────────────
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'w-3.5 h-3.5',
}
const SectionIcon = {
  search: (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  wallet: (
    <svg {...iconProps}>
      <rect x="2.5" y="6" width="19" height="13" rx="1.5" />
      <path d="M2.5 10h19" />
      <circle cx="16.5" cy="14.2" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  play: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none" />
    </svg>
  ),
}
// Start & Run button icon — plain play-triangle, replaces the old "▶" character.
const PlayTriangleIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5 shrink-0"
  >
    <path d="M8 5v14l11-7L8 5Z" fill="currentColor" stroke="none" />
  </svg>
)

// ── Small local components (this file's own tokens, not shared — see comment above) ──
function GroupLabel({ icon, tone = 'blue', children }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span className={tone === 'orange' ? 'text-orange-500 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}>
        {icon}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {children}
      </span>
    </div>
  )
}

// Chip preset — used for the non-exclusive quick-action rows (date-range presets,
// capital quick-amounts, play-speed). Active state is a solid filled blue-600, distinct
// from the punch-toggle's lighter border+tint treatment.
function Chip({ active, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`px-2.5 py-1 text-[10px] font-semibold tabular-nums rounded-md border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'
      } ${className}`}
      {...props}
    />
  )
}

// Play-speed chip — same active/off language as Chip but flex-1 so the row of five
// spans the full group width evenly, matching the mockup's speed-row.
function SpeedChip({ active, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`flex-1 text-center px-0 py-1 text-[10px] font-semibold tabular-nums rounded-md border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500'
      } ${className}`}
      {...props}
    />
  )
}

// Punch-style checkbox glyph — empty box, gains a checkmark path when active.
function PunchBox({ active }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3 shrink-0"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      {active && <path d="M9 12.5l2 2 4-4.5" />}
    </svg>
  )
}

// Punch-style toggle option — replaces the old segmented-pill toggle for Run Mode / SL
// Validation. `tone` picks the active border+tint color (blue for Run Mode, orange for
// SL Validation, matching the mockup's `.group.warn` treatment).
function PunchOption({ active, tone = 'blue', onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-medium text-left transition-colors ${
        active ? PUNCH_ON[tone] : PUNCH_OFF
      }`}
    >
      <PunchBox active={active} />
      {children}
    </button>
  )
}

// ── Date helpers ───────────────────────────────────────────────────────────────
// Snap a date FORWARD to the next non-weekend day. NEPSE public holidays are
// validated server-side (isTradingDay) — a manual holiday pick is rejected with a
// clear message; this only covers the weekend case client-side so the auto-filled
// default never lands on Sat/Sun.
function snapForwardToTradingDay(iso) {
  if (!iso) return iso
  let d = new Date(iso + 'T00:00:00Z')
  for (let i = 0; i < 7; i++) {
    const s = d.toISOString().slice(0, 10)
    if (!isNepseWeekend(s, d.getUTCDay())) return s
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return iso
}

// Default start = `years` before `latest`, clamped to `earliest`, snapped to a
// trading day. Falls back gracefully when range data is missing.
function computeDefaultStart(meta, years = DEFAULT_LOOKBACK_YEARS) {
  if (!meta) return ''
  const { earliest_date, latest_date } = meta
  if (!latest_date) return earliest_date ? snapForwardToTradingDay(earliest_date) : ''
  const d = new Date(latest_date + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() - years)
  let target = d.toISOString().slice(0, 10)
  // Clamp to listing date (company not listed before earliest_date)
  if (earliest_date && target < earliest_date) target = earliest_date
  return snapForwardToTradingDay(target)
}

export default function BacktestSetupPanel({ onSessionStarted }) {
  const [symbol, setSymbol] = useState('') // confirmed selection
  const [meta, setMeta] = useState(null) // { earliest_date, latest_date, total_days }
  const [metaLoading, setMetaLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [dateNotice, setDateNotice] = useState('') // clamp / snap explanation
  const [capital, setCapital] = useState(DEFAULT_CAPITAL)
  const [strategyName, setStrategyName] = useState('')
  const [runMode, setRunMode] = useState('PLAY')
  const [speed, setSpeed] = useState('1')
  const [slMode, setSlMode] = useState('MANUAL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [symbolsError, setSymbolsError] = useState('') // page-level banner for symbol-load failure

  // ── On symbol pick: fetch its date range, auto-fill a sensible 2yr default ──────
  const handleSelectSymbol = useCallback(async (sym) => {
    setSymbol(sym)
    setError('')
    setDateNotice('')
    setMeta(null)
    setStartDate('')
    setMetaLoading(true)
    try {
      const res = await btGetSymbolMeta(sym)
      const m = res.data
      setMeta(m)
      const def = computeDefaultStart(m)
      setStartDate(def)
      if (m.earliest_date && m.latest_date) {
        setDateNotice(`Data ${m.earliest_date} → ${m.latest_date} · default = last ${DEFAULT_LOOKBACK_YEARS}y`)
      }
    } catch (err) {
      // No range data — let the user pick freely, surface why
      setDateNotice(
        err.response?.status === 404
          ? `No price history found for ${sym}`
          : 'Could not load date range — pick a start date manually'
      )
    } finally {
      setMetaLoading(false)
    }
  }, [])

  // ── Manual date change: validate against the known range + weekends ─────────────
  const handleDateChange = useCallback(
    (val) => {
      setError('')
      if (!val) {
        setStartDate('')
        return
      }
      let next = val
      let note = ''
      if (meta?.earliest_date && next < meta.earliest_date) {
        next = meta.earliest_date
        note = `Company data starts ${meta.earliest_date} — clamped.`
      } else if (meta?.latest_date && next > meta.latest_date) {
        next = meta.latest_date
        note = `Last available date is ${meta.latest_date} — clamped.`
      }
      // Weekend → snap forward (true holidays caught server-side on submit)
      const snapped = snapForwardToTradingDay(next)
      if (snapped !== next) note = `${next} is a weekend — moved to ${snapped}.`
      setStartDate(snapped)
      setDateNotice(note || (meta?.earliest_date ? `Data ${meta.earliest_date} → ${meta.latest_date}` : ''))
    },
    [meta]
  )

  const handleStart = useCallback(async () => {
    setError('')
    if (!symbol) return setError('Select a script (symbol)')
    if (!startDate) return setError('Select a start date')
    const cap = parseFloat(capital)
    if (!cap || cap < 10000) return setError('Minimum capital is Rs. 10,000')

    // Strategy name is optional in the UI — default to "strategy" so a user can
    // one-click start without typing.
    const finalStrategy = strategyName.trim() || 'strategy'

    setLoading(true)
    try {
      const res = await btCreateSession({
        strategy_name: finalStrategy,
        initial_capital: cap,
        sl_mode: slMode,
        scripts: [{ symbol, start_date: startDate }],
      })
      onSessionStarted(res.data, { runMode, speed })
    } catch (err) {
      // Surface the server's trading-day / range rejection verbatim
      setError(
        err.response?.data?.message || err.response?.data?.error || 'Failed to start session'
      )
    } finally {
      setLoading(false)
    }
  }, [symbol, startDate, strategyName, capital, slMode, runMode, speed, onSessionStarted])

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3">
      {/* ── Market & Range ─────────────────────────────────────────────────── */}
      <div className={GROUP}>
        <GroupLabel icon={SectionIcon.search}>Market &amp; Range</GroupLabel>

        {/* Script — type-ahead search (shared SymbolSearch; stocks-only, backtest API).
            SymbolSearch owns its own pill styling internally and isn't forked here —
            only its width/wrapping props are adjusted to sit flush in the ticket. */}
        <div className="mb-3">
          <div className={`${FIELD_NAME} mb-1`}>Script</div>
          <SymbolSearch
            value={symbol}
            stocksOnly
            defaultValue="NABIL"
            fetchSymbols={() => btGetSymbols().then((r) => ({ stocks: r.data.symbols || [], indexes: [] }))}
            onSelect={(sym) => handleSelectSymbol(sym)}
            onLoadError={() => setSymbolsError('Failed to load symbols — check server')}
            className="w-full"
            inputClassName="w-full text-right"
          />
          {symbolsError && (
            <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5 mt-1">
              {symbolsError}
            </div>
          )}
        </div>

        {/* Start Date */}
        <div>
          <div className={FIELD_ROW}>
            <span className={FIELD_NAME}>Start date</span>
            <input
              type="date"
              value={startDate}
              min={meta?.earliest_date}
              max={meta?.latest_date}
              disabled={!symbol || metaLoading}
              onChange={(e) => handleDateChange(e.target.value)}
              className={`${VALUE_INPUT} disabled:opacity-40 disabled:cursor-not-allowed`}
            />
          </div>
          {/* Quick range presets */}
          {meta?.latest_date && (
            <div className="mt-1.5 flex gap-1 flex-wrap justify-end">
              {[
                { label: '1Y', y: 1 },
                { label: '2Y', y: 2 },
                { label: '5Y', y: 5 },
              ].map((p) => (
                <Chip key={p.label} onClick={() => handleDateChange(computeDefaultStart(meta, p.y))}>
                  {p.label}
                </Chip>
              ))}
              <Chip onClick={() => handleDateChange(meta.earliest_date)}>Max</Chip>
            </div>
          )}
          {metaLoading && (
            <div className="text-[10px] text-gray-400 mt-1.5">Loading date range…</div>
          )}
          {!metaLoading && dateNotice && (
            <div className="text-[10px] text-gray-400 mt-1.5 leading-tight">{dateNotice}</div>
          )}
        </div>
      </div>

      {/* ── Capital & Strategy ─────────────────────────────────────────────── */}
      <div className={GROUP}>
        <GroupLabel icon={SectionIcon.wallet}>Capital &amp; Strategy</GroupLabel>

        {/* Initial Capital */}
        <div className="mb-3">
          <div className={FIELD_ROW}>
            <span className={FIELD_NAME}>Capital (NPR)</span>
            <input
              type="number"
              value={capital}
              min={10000}
              step={1000}
              autoComplete="off"
              onChange={(e) => setCapital(e.target.value)}
              className={VALUE_INPUT}
            />
          </div>
          <div className="mt-1.5 flex gap-1 flex-wrap justify-end">
            {[
              { label: '1L', v: '100000' },
              { label: '5L', v: '500000' },
              { label: '10L', v: '1000000' },
            ].map((p) => (
              <Chip key={p.label} active={capital === p.v} onClick={() => setCapital(p.v)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Strategy Name (optional) */}
        <div>
          <div className={FIELD_ROW}>
            <span className={FIELD_NAME}>Strategy name</span>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="strategy"
              autoComplete="off"
              className={VALUE_INPUT}
            />
          </div>
        </div>
      </div>

      {/* ── Execution ──────────────────────────────────────────────────────── */}
      <div className={GROUP_LAST}>
        <GroupLabel icon={SectionIcon.play} tone="orange">Execution</GroupLabel>

        {/* Run Mode */}
        <div className="mb-3">
          <div className={`${FIELD_NAME} mb-1.5`}>Run mode</div>
          <div className="flex gap-1.5">
            <PunchOption active={runMode === 'PLAY'} tone="blue" onClick={() => setRunMode('PLAY')}>
              Play
            </PunchOption>
            <PunchOption active={runMode === 'MANUAL'} tone="blue" onClick={() => setRunMode('MANUAL')}>
              Manual
            </PunchOption>
          </div>

          {/* Play Speed — only if PLAY */}
          {runMode === 'PLAY' && (
            <div className="mt-2 flex gap-1">
              {SPEEDS.map((s) => (
                <SpeedChip key={s} active={speed === s} onClick={() => setSpeed(s)}>
                  {s}×
                </SpeedChip>
              ))}
            </div>
          )}
        </div>

        {/* SL Validation Mode */}
        <div>
          <div className={`${FIELD_NAME} mb-1.5`}>SL validation</div>
          <div className="flex gap-1.5">
            <PunchOption active={slMode === 'MANUAL'} tone="orange" onClick={() => setSlMode('MANUAL')}>
              Manual
            </PunchOption>
            <PunchOption active={slMode === 'AUTO'} tone="orange" onClick={() => setSlMode('AUTO')}>
              Auto
            </PunchOption>
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 leading-tight">
            {slMode === 'AUTO'
              ? 'System auto-closes when SL is hit after T+2'
              : 'System asks you before closing on SL breach'}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5 mb-3">
          {error}
        </div>
      )}

      <div className="mt-auto pb-3.5">
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:shadow-sm text-white shadow-sm hover:shadow-md transition-all"
        >
          {loading ? (
            'Starting…'
          ) : runMode === 'PLAY' ? (
            <>
              {PlayTriangleIcon}
              Start &amp; Run
            </>
          ) : (
            'Start Backtest'
          )}
        </button>

        <div className="text-[10px] text-gray-400 text-center leading-tight mt-2">
          NEPSE · Long only · T+2 settlement · No intraday
        </div>
      </div>
    </div>
  )
}
