// === BacktestSetupPanel.jsx — session setup form (symbol, date, capital, mode, SL) ===

import { useState, useEffect, useCallback, useRef } from 'react'
import { btGetSymbols, btGetSymbolMeta, btCreateSession } from '../../api/backtest'
import { isNepseWeekend } from '../../utils/nepseCalendar'

const SPEEDS = ['0.5', '1', '2', '5', '10']
const DEFAULT_CAPITAL = '100000' // Rs. 1 lakh
const DEFAULT_LOOKBACK_YEARS = 2

// Design tokens (copied per-file per pm/docs/design.md — no shared ui.js)
const LABEL =
  'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'
const INPUT =
  'mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500'

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
  const [symbols, setSymbols] = useState([])
  const [symbol, setSymbol] = useState('') // confirmed selection
  const [query, setQuery] = useState('') // live search text
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1) // keyboard-highlighted row
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
  const [symbolsLoading, setSymbolsLoading] = useState(true)
  const [symbolsError, setSymbolsError] = useState('')
  const dropdownRef = useRef(null)
  const listRef = useRef(null)
  // Tracks a list click so input blur doesn't close the list before select fires
  const mouseDownInList = useRef(false)

  useEffect(() => {
    btGetSymbols()
      .then((r) => setSymbols(r.data.symbols || []))
      .catch(() => setSymbolsError('Failed to load symbols — check server'))
      .finally(() => setSymbolsLoading(false))
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Live filter: empty query shows the first 20; otherwise substring match.
  const filteredSymbols =
    query.length < 1
      ? symbols.slice(0, 20)
      : symbols.filter((s) => s.symbol.toLowerCase().includes(query.toLowerCase())).slice(0, 30)

  // Keep the highlighted row scrolled into view
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
    }
  }, [cursor])

  // ── On symbol pick: fetch its date range, auto-fill a sensible 2yr default ──────
  const handleSelectSymbol = useCallback(async (sym) => {
    setSymbol(sym)
    setQuery('')
    setOpen(false)
    setCursor(-1)
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

  // ── Keyboard navigation in the symbol search (matches the Screen page search) ───
  const handleSymbolKey = useCallback(
    (e) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setOpen(true)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, filteredSymbols.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const pick = cursor >= 0 ? filteredSymbols[cursor] : filteredSymbols[0]
        if (pick) handleSelectSymbol(pick.symbol)
      } else if (e.key === 'Escape') {
        setOpen(false)
        setCursor(-1)
      }
    },
    [open, cursor, filteredSymbols, handleSelectSymbol]
  )

  // ── Default-select NABIL once symbols are loaded (if user hasn't picked yet) ─────
  useEffect(() => {
    if (symbol || !symbols.length) return
    const nabil = symbols.find((s) => s.symbol === 'NABIL')
    if (nabil) handleSelectSymbol('NABIL')
  }, [symbols, symbol, handleSelectSymbol])

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
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <div className={LABEL}>Backtest Setup</div>

      {/* Symbol load error */}
      {symbolsError && (
        <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">
          {symbolsError}
        </div>
      )}

      {/* Script — type-ahead search (matches the Screen page symbol search) */}
      <div className="relative" ref={dropdownRef}>
        <label className={LABEL}>Script</label>
        <div className="mt-0.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5">
          <svg
            className="w-3.5 h-3.5 text-gray-400 shrink-0"
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
            value={open ? query : symbol || query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setCursor(-1)
            }}
            onFocus={() => {
              setOpen(true)
              setQuery('')
            }}
            onBlur={() => {
              if (!mouseDownInList.current) setOpen(false)
            }}
            onKeyDown={handleSymbolKey}
            placeholder={symbolsLoading ? 'Loading…' : symbol || 'Search symbol…'}
            className="bg-transparent text-[12px] text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
          />
        </div>

        {open && filteredSymbols.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-56 overflow-y-auto">
            <ul ref={listRef}>
              {filteredSymbols.map((s, i) => (
                <li
                  key={s.symbol}
                  onMouseDown={() => {
                    mouseDownInList.current = true
                    handleSelectSymbol(s.symbol)
                    mouseDownInList.current = false
                  }}
                  className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                    i === cursor
                      ? 'bg-blue-50 dark:bg-blue-950'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                    {s.symbol}
                  </span>
                  <span className="shrink-0 ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                    Stock
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {open && filteredSymbols.length === 0 && query.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg px-3 py-3 text-[11px] text-gray-400">
            {symbolsError ? symbolsError : `No results for "${query}"`}
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
                className="px-2 py-0.5 text-[10px] font-semibold rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleDateChange(meta.earliest_date)}
              className="px-2 py-0.5 text-[10px] font-semibold rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500"
            >
              Max
            </button>
          </div>
        )}
        {metaLoading && (
          <div className="text-[10px] text-gray-400 mt-0.5">Loading date range…</div>
        )}
        {!metaLoading && dateNotice && (
          <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{dateNotice}</div>
        )}
      </div>

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
              className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                capital === p.v
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400'
              }`}
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

      {/* Run Mode */}
      <div>
        <label className={LABEL}>Run Mode</label>
        <div className="mt-0.5 flex gap-2">
          {['PLAY', 'MANUAL'].map((m) => (
            <button
              key={m}
              onClick={() => setRunMode(m)}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
                runMode === m
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400'
              }`}
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
          <div className="mt-0.5 flex gap-1 flex-wrap">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                  speed === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}
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
        <div className="mt-0.5 flex gap-2">
          {['MANUAL', 'AUTO'].map((m) => (
            <button
              key={m}
              onClick={() => setSlMode(m)}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
                slMode === m
                  ? m === 'AUTO'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
          {slMode === 'AUTO'
            ? 'System auto-closes when SL is hit after T+2'
            : 'System asks you before closing on SL breach'}
        </div>
      </div>

      {error && (
        <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className="mt-auto w-full py-2 text-[11px] font-bold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
      >
        {loading ? 'Starting…' : runMode === 'PLAY' ? '▶ Start & Run' : 'Start Backtest'}
      </button>

      <div className="text-[10px] text-gray-400 text-center leading-tight">
        NEPSE · Long only · T+2 settlement · No intraday
      </div>
    </div>
  )
}
