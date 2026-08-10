// === BacktestSetupPanel.jsx — session setup form (symbol, date, capital, mode, SL) ===

import { useState, useCallback } from 'react'
import { btGetSymbols, btGetSymbolMeta, btCreateSession } from '../../api/backtest'
import { isNepseWeekend } from '../../utils/nepseCalendar'
import SymbolSearch from '../common/SymbolSearch'
import { Card } from '../common/CardShell'

const SPEEDS = ['0.5', '1', '2', '5', '10']
const DEFAULT_CAPITAL = '100000' // Rs. 1 lakh
const DEFAULT_LOOKBACK_YEARS = 2

// Design tokens (copied per-file per pm/docs/design.md — no shared ui.js)
const LABEL =
  'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'
// bg deliberately one shade darker than Card's own bg-gray-50/dark:bg-gray-800 so
// fields read as "recessed" inside the tinted card instead of blending into it.
const INPUT =
  'mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500'
// Pill chip — used for the non-exclusive quick-action rows (date-range presets,
// capital quick-amounts, play-speed) — rounded-full so they read as "shortcuts"
// rather than form controls.
const CHIP =
  'px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-colors'
const CHIP_OFF =
  'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'
const CHIP_ON = 'bg-blue-600 text-white border-blue-600 shadow-sm'
// Segmented toggle — used for the two exclusive-choice fields (Run Mode, SL
// Validation), matching ModeToggle.jsx's pill-container recipe (bg-gray-100
// rounded-lg p-0.5, active segment gets its own filled color + shadow-sm).
const TOGGLE_WRAP =
  'flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800/80 rounded-lg p-0.5'
const TOGGLE_BTN_OFF =
  'flex-1 py-1 text-[10px] font-semibold rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors'

// ── Icons (12x12 stroke glyphs — viewBox 0 0 24 24, stroke currentColor,
// strokeWidth 2.4 — same recipe as ProfessionalAnalysisPanels' CardIcon, so the
// section headers read like the same design system) ─────────────────────────
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'w-3 h-3',
}
const SectionIcon = {
  search: (
    <svg {...iconProps}>
      <circle cx="10" cy="10" r="7" />
      <line x1="21" y1="21" x2="15.5" y2="15.5" />
    </svg>
  ),
  wallet: (
    <svg {...iconProps}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <circle cx="17" cy="15" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  play: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5 16 12l-6 3.5Z" fill="currentColor" stroke="none" />
    </svg>
  ),
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
    <div className="flex flex-col gap-2.5 p-2.5 h-full overflow-y-auto">
      {/* ── Market & Range ─────────────────────────────────────────────────── */}
      <Card tone="info" icon={SectionIcon.search} title="Market & Range" index={0}>
        {/* Script — type-ahead search (shared SymbolSearch; stocks-only, backtest API) */}
        <div className="relative">
          <label className={LABEL}>Script</label>
          <SymbolSearch
            value={symbol}
            stocksOnly
            defaultValue="NABIL"
            fetchSymbols={() => btGetSymbols().then((r) => ({ stocks: r.data.symbols || [], indexes: [] }))}
            onSelect={(sym) => handleSelectSymbol(sym)}
            onLoadError={() => setSymbolsError('Failed to load symbols — check server')}
            className="mt-0.5 w-full"
            inputClassName="w-full"
          />
          {symbolsError && (
            <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5 mt-1">
              {symbolsError}
            </div>
          )}
        </div>

        {/* Start Date */}
        <div>
          <label className={LABEL}>Start Date</label>
          <input
            type="date"
            value={startDate}
            min={meta?.earliest_date}
            max={meta?.latest_date}
            disabled={!symbol || metaLoading}
            onChange={(e) => handleDateChange(e.target.value)}
            className={`${INPUT} disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {/* Quick range presets */}
          {meta?.latest_date && (
            <div className="mt-1 flex gap-1 flex-wrap">
              {[
                { label: '1Y', y: 1 },
                { label: '2Y', y: 2 },
                { label: '5Y', y: 5 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleDateChange(computeDefaultStart(meta, p.y))}
                  className={`${CHIP} ${CHIP_OFF}`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleDateChange(meta.earliest_date)}
                className={`${CHIP} ${CHIP_OFF}`}
              >
                Max
              </button>
            </div>
          )}
          {metaLoading && (
            <div className="text-[10px] text-gray-400 mt-1">Loading date range…</div>
          )}
          {!metaLoading && dateNotice && (
            <div className="text-[10px] text-gray-400 mt-1 leading-tight">{dateNotice}</div>
          )}
        </div>
      </Card>

      {/* ── Capital & Strategy ─────────────────────────────────────────────── */}
      <Card tone="neutral" icon={SectionIcon.wallet} title="Capital & Strategy" index={1}>
        {/* Initial Capital */}
        <div>
          <label className={LABEL}>Capital (NPR)</label>
          <input
            type="number"
            value={capital}
            min={10000}
            step={1000}
            autoComplete="off"
            onChange={(e) => setCapital(e.target.value)}
            className={INPUT}
          />
          <div className="mt-1 flex gap-1 flex-wrap">
            {[
              { label: '1L', v: '100000' },
              { label: '5L', v: '500000' },
              { label: '10L', v: '1000000' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setCapital(p.v)}
                className={`${CHIP} ${capital === p.v ? CHIP_ON : CHIP_OFF}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy Name (optional) */}
        <div>
          <label className={LABEL}>Strategy Name</label>
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder="strategy"
            autoComplete="off"
            className={INPUT}
          />
        </div>
      </Card>

      {/* ── Execution ──────────────────────────────────────────────────────── */}
      <Card tone="warning" icon={SectionIcon.play} title="Execution" index={2}>
        {/* Run Mode */}
        <div>
          <label className={LABEL}>Run Mode</label>
          <div className={`mt-0.5 ${TOGGLE_WRAP}`}>
            {['PLAY', 'MANUAL'].map((m) => (
              <button
                key={m}
                onClick={() => setRunMode(m)}
                className={runMode === m ? 'flex-1 py-1 text-[10px] font-semibold rounded-md bg-blue-600 text-white shadow-sm transition-colors' : TOGGLE_BTN_OFF}
              >
                {m === 'PLAY' ? '▶ Play' : '→ Manual'}
              </button>
            ))}
          </div>
        </div>

        {/* Play Speed — only if PLAY */}
        {runMode === 'PLAY' && (
          <div>
            <label className={LABEL}>Play Speed</label>
            <div className="mt-1 flex gap-1 flex-wrap">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`${CHIP} ${speed === s ? CHIP_ON : CHIP_OFF}`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SL Validation Mode */}
        <div>
          <label className={LABEL}>SL Validation</label>
          <div className={`mt-0.5 ${TOGGLE_WRAP}`}>
            {['MANUAL', 'AUTO'].map((m) => (
              <button
                key={m}
                onClick={() => setSlMode(m)}
                className={
                  slMode === m
                    ? `flex-1 py-1 text-[10px] font-semibold rounded-md text-white shadow-sm transition-colors ${
                        m === 'AUTO' ? 'bg-orange-500' : 'bg-blue-600'
                      }`
                    : TOGGLE_BTN_OFF
                }
              >
                {m}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-gray-400 mt-1 leading-tight">
            {slMode === 'AUTO'
              ? 'System auto-closes when SL is hit after T+2'
              : 'System asks you before closing on SL breach'}
          </div>
        </div>
      </Card>

      {error && (
        <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className="mt-auto w-full py-2.5 text-[12px] font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:shadow-sm text-white shadow-sm hover:shadow-md transition-all"
      >
        {loading ? 'Starting…' : runMode === 'PLAY' ? '▶ Start & Run' : 'Start Backtest'}
      </button>

      <div className="text-[10px] text-gray-400 text-center leading-tight">
        NEPSE · Long only · T+2 settlement · No intraday
      </div>
    </div>
  )
}
