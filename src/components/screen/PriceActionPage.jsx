import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
import StockChart from './StockChart'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'
import { getPriceActionScan } from '../../api'
import { getMarketSymbols } from '../../utils/globalCache'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  swingSensitivity: 10,   // pivot lookback window (bars each side) — passed to backend informational only
  clusterPct:       1.5,  // S/R clustering tolerance %
  dsMovePct:        3,    // D/S min directional move %
  volMultiplier:    2.0,  // volume spike threshold vs 20-bar avg
}

const DEFAULT_TOGGLES = {
  showSwings:   true,
  showTrend:    true,
  showSR:       true,
  showZones:    true,
  showVolume:   false,
  showPatterns: false,
}

// Timeframe → days mapping (same as SMC — timeframe drives scan period)
const TIMEFRAME_DAYS = { '1W': 30, '1M': 60, '3M': 125, '6M': 180, '1Y': 280, '3Y': 750, 'ALL': 1500 }

// ── Config persistence ────────────────────────────────────────────────────────
function loadConfig() {
  try { const s = localStorage.getItem('pa_config'); if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) } } catch {}
  return DEFAULT_CONFIG
}
function saveConfig(cfg) {
  try { localStorage.setItem('pa_config', JSON.stringify(cfg)) } catch {}
}

// ── useFixedDropdown ──────────────────────────────────────────────────────────
function useFixedDropdown(align = 'left') {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const triggerRef      = useRef(null)

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!open) return
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [open, updateRect])

  useEffect(() => {
    if (!open) return
    const fn = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const dropStyle = rect ? {
    position: 'fixed',
    top: rect.bottom + 4,
    ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    zIndex: 9999,
  } : {}

  const portal = useCallback((content) => {
    if (!open || !rect) return null
    return createPortal(<div style={dropStyle}>{content}</div>, document.body)
  }, [open, rect, dropStyle]) // eslint-disable-line react-hooks/exhaustive-deps

  return { triggerRef, open, setOpen, portal, updateRect }
}

// ── Toggle chip ───────────────────────────────────────────────────────────────
function ToggleChip({ label, active, onClick, activeColor }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[28px] px-2 py-0.5 rounded text-[10px] font-semibold transition-all border whitespace-nowrap ${
        active
          ? 'text-white border-transparent'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
      }`}
      style={active ? { backgroundColor: activeColor } : {}}
    >
      {label}
    </button>
  )
}

// ── Inline symbol search ──────────────────────────────────────────────────────
function PASymbolSearch() {
  const { selectedSymbol, selectSymbol } = useScreen() || {}
  const [query,  setQuery]  = useState('')
  const [items,  setItems]  = useState([])
  const [cursor, setCursor] = useState(-1)
  const inputRef            = useRef(null)
  const listRef             = useRef(null)
  const mouseDownInList     = useRef(false)
  const { triggerRef, open: ddOpen, setOpen: setDDOpen, portal, updateRect } = useFixedDropdown('left')

  useEffect(() => {
    getMarketSymbols()
      .then(r => { if (r.data?.stocks?.length) setItems(r.data.stocks) })
      .catch(() => {})
  }, [])

  const q        = query.toLowerCase()
  const filtered = query.length < 1
    ? items.slice(0, 20)
    : items.filter(s =>
        s.symbol.toLowerCase().startsWith(q) ||
        s.symbol.toLowerCase().includes(q) ||
        (s.company_name && s.company_name.toLowerCase().includes(q))
      ).slice(0, 30)

  const handleSelect = useCallback((item) => {
    selectSymbol?.(item.symbol, null, null, item.company_name ?? null)
    setQuery(''); setDDOpen(false); setCursor(-1)
  }, [selectSymbol, setDDOpen])

  function handleKey(e) {
    if (!ddOpen) { setDDOpen(true); updateRect(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter')     { const t = cursor >= 0 ? filtered[cursor] : filtered[0]; if (t) handleSelect(t) }
    if (e.key === 'Escape')    { setDDOpen(false); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <div className="shrink-0" ref={triggerRef}
      onClick={() => { setDDOpen(true); updateRect(); setTimeout(() => inputRef.current?.focus(), 30) }}>
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input ref={inputRef} value={query}
          onChange={e => { setQuery(e.target.value.toUpperCase()); setDDOpen(true); updateRect(); setCursor(-1) }}
          onFocus={() => { setDDOpen(true); updateRect() }}
          onBlur={() => { if (!mouseDownInList.current) setDDOpen(false) }}
          onKeyDown={handleKey}
          placeholder={selectedSymbol} autoComplete="off" spellCheck={false}
          className="bg-transparent text-[10px] font-bold text-gray-700 dark:text-gray-200 placeholder-gray-500 outline-none w-[56px] uppercase" />
      </div>
      {portal(
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden" style={{ width: 240, maxHeight: 280, overflowY: 'auto' }}>
          <ul ref={listRef}>
            {filtered.map((item, i) => (
              <li key={item.symbol}
                onMouseDown={() => { mouseDownInList.current = true; handleSelect(item); mouseDownInList.current = false }}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${i === cursor ? 'bg-blue-50 dark:bg-blue-950/60' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">{item.symbol}</span>
                  {item.company_name && <span className="text-[10px] text-gray-400 truncate leading-tight">{item.company_name}</span>}
                </div>
                <span className="shrink-0 ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">Stock</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Inline timeframe chips ────────────────────────────────────────────────────
const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y', '3Y', 'ALL']
function PATimeframes() {
  const { timeframe, setTimeframe } = useScreen() || {}
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
      {TIMEFRAMES.map(tf => (
        <button key={tf} onClick={() => setTimeframe?.(tf)}
          className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors whitespace-nowrap ${
            timeframe === tf
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}>
          {tf}
        </button>
      ))}
    </div>
  )
}

// ── PA Toolbar ────────────────────────────────────────────────────────────────
function PAToolbar({ toggles, setToggles, config, setConfig }) {
  const configDrop = useFixedDropdown('right')
  const toggle     = (key) => setToggles(prev => ({ ...prev, [key]: !prev[key] }))

  const updateConfig = (key, val) => {
    const next = { ...config, [key]: val }
    setConfig(next)
    saveConfig(next)
  }

  return useScreenToolbarSlot(
    <div className="flex items-center gap-1.5 min-w-0">

      <PASymbolSearch />

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      <PATimeframes />

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* Overlay toggles */}
      <ToggleChip label="Swings"    active={toggles.showSwings}   onClick={() => toggle('showSwings')}   activeColor="#3b82f6" />
      <ToggleChip label="Trend"     active={toggles.showTrend}    onClick={() => toggle('showTrend')}    activeColor="#22c55e" />
      <ToggleChip label="S/R"       active={toggles.showSR}       onClick={() => toggle('showSR')}       activeColor="#f97316" />
      <ToggleChip label="D/S Zones" active={toggles.showZones}    onClick={() => toggle('showZones')}    activeColor="#8b5cf6" />
      <ToggleChip label="Volume"    active={toggles.showVolume}   onClick={() => toggle('showVolume')}   activeColor="#a855f7" />
      <ToggleChip label="Patterns"  active={toggles.showPatterns} onClick={() => toggle('showPatterns')} activeColor="#f59e0b" />

      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* Config popover */}
      <div ref={configDrop.triggerRef}>
        <button
          onClick={() => { configDrop.setOpen(v => !v); configDrop.updateRect() }}
          className="px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 transition-all"
        >
          Config
        </button>
        {configDrop.portal(
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 min-w-[220px]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-3">Price Action Config</p>

            <div className="space-y-3">
              {/* S/R clustering */}
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">S/R cluster tolerance</p>
                <div className="flex gap-1">
                  {[1.0, 1.5, 2.0, 2.5].map(v => (
                    <button key={v} onClick={() => updateConfig('clusterPct', v)}
                      className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
                        config.clusterPct === v
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              {/* D/S threshold */}
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">D/S min move</p>
                <div className="flex gap-1">
                  {[2, 3, 5].map(v => (
                    <button key={v} onClick={() => updateConfig('dsMovePct', v)}
                      className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
                        config.dsMovePct === v
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume spike */}
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Volume spike threshold</p>
                <div className="flex gap-1">
                  {[1.5, 2.0, 2.5, 3.0].map(v => (
                    <button key={v} onClick={() => updateConfig('volMultiplier', v)}
                      className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
                        config.volMultiplier === v
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>
                      {v}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => { setConfig(DEFAULT_CONFIG); saveConfig(DEFAULT_CONFIG) }}
              className="mt-3 text-[10px] text-blue-500 hover:underline">
              Reset to defaults
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

// ── Left Panel ────────────────────────────────────────────────────────────────
function PALeftPanel({ paData, chartData, currentPrice }) {
  const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const SUB   = 'text-[10px] text-gray-500 dark:text-gray-400'
  const VAL   = 'text-[11px] font-semibold text-gray-800 dark:text-gray-100'

  if (!paData) return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <p className={LABEL}>How to use</p>
      <div className="space-y-2">
        {[
          { step: '1', text: 'Search a stock in the toolbar above' },
          { step: '2', text: 'Select a timeframe (1M, 3M, 1Y…)' },
          { step: '3', text: 'Swings toggle marks HH/HL/LH/LL on the chart' },
          { step: '4', text: 'S/R toggle shows key support & resistance levels' },
          { step: '5', text: 'D/S Zones toggle shows demand & supply areas' },
        ].map(({ step, text }) => (
          <div key={step} className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold flex items-center justify-center">{step}</span>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className={LABEL + ' mb-1'}>Overlays</p>
        {[
          { color: '#3b82f6', label: 'Swings — HH/HL/LH/LL markers' },
          { color: '#22c55e', label: 'Trend — structure direction' },
          { color: '#f97316', label: 'S/R — horizontal levels' },
          { color: '#8b5cf6', label: 'D/S Zones — demand/supply' },
          { color: '#a855f7', label: 'Volume — spike markers' },
          { color: '#f59e0b', label: 'Patterns — candle signals' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const { structure, support_resistance, demand_supply, volume_spikes, swings } = paData

  // Trend badge
  const trendColor = structure?.trend === 'uptrend' ? '#22c55e'
    : structure?.trend === 'downtrend' ? '#ef4444'
    : '#f59e0b'
  const trendLabel = structure?.trend === 'uptrend' ? '▲ Uptrend'
    : structure?.trend === 'downtrend' ? '▼ Downtrend'
    : '→ Sideways'

  // Nearest S/R around current price
  const nearestRes = support_resistance
    .filter(z => z.type === 'resistance' && z.price > currentPrice)
    .sort((a, b) => a.price - b.price)[0]
  const nearestSup = support_resistance
    .filter(z => z.type === 'support' && z.price < currentPrice)
    .sort((a, b) => b.price - a.price)[0]

  // Nearest demand zone
  const nearestDemand = [...(demand_supply || [])]
    .filter(z => z.type === 'demand')
    .sort((a, b) => b.bottom - a.bottom)[0]

  // Last volume spike
  const lastSpike = volume_spikes?.[volume_spikes.length - 1]

  // Recent swings (last 8)
  const recentSwings = [...(swings || [])].slice(-8).reverse()

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-800">

      {/* Section 1 — Trend Snapshot */}
      <div className="p-3 space-y-2">
        <p className={LABEL}>Trend</p>
        <span className="text-[13px] font-bold" style={{ color: trendColor }}>{trendLabel}</span>
        <div className="space-y-0.5 mt-1">
          {structure?.last_hh_price && (
            <div className="flex justify-between">
              <span className="text-[9px] font-bold text-blue-500">HH</span>
              <span className={VAL}>{structure.last_hh_price.toFixed(2)}</span>
            </div>
          )}
          {structure?.last_hl_price && (
            <div className="flex justify-between">
              <span className="text-[9px] font-bold text-blue-400">HL</span>
              <span className={VAL}>{structure.last_hl_price.toFixed(2)}</span>
            </div>
          )}
          {structure?.last_lh_price && (
            <div className="flex justify-between">
              <span className="text-[9px] font-bold text-gray-400">LH</span>
              <span className={VAL}>{structure.last_lh_price.toFixed(2)}</span>
            </div>
          )}
          {structure?.last_ll_price && (
            <div className="flex justify-between">
              <span className="text-[9px] font-bold text-red-400">LL</span>
              <span className={VAL}>{structure.last_ll_price.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section 2 — Key Levels */}
      <div className="p-3 space-y-1.5">
        <p className={LABEL}>Key Levels</p>
        {nearestRes && (
          <div>
            <p className={SUB}>Nearest Resistance</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-red-500">{nearestRes.price.toFixed(2)}</span>
              <span className={SUB + ' ml-1'}>+{((nearestRes.price - currentPrice) / currentPrice * 100).toFixed(1)}%</span>
            </div>
            <div className="flex gap-0.5 mt-0.5">
              {Array.from({ length: Math.min(nearestRes.touches, 5) }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-400" />
              ))}
              <span className="text-[9px] text-gray-400 ml-0.5">{nearestRes.strength}</span>
            </div>
          </div>
        )}

        {currentPrice > 0 && (
          <div className="py-0.5 text-center">
            <span className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-mono">
              {currentPrice.toFixed(2)}
            </span>
          </div>
        )}

        {nearestSup && (
          <div>
            <p className={SUB}>Nearest Support</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-green-600 dark:text-green-400">{nearestSup.price.toFixed(2)}</span>
              <span className={SUB + ' ml-1'}>{((nearestSup.price - currentPrice) / currentPrice * 100).toFixed(1)}%</span>
            </div>
            <div className="flex gap-0.5 mt-0.5">
              {Array.from({ length: Math.min(nearestSup.touches, 5) }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-500" />
              ))}
              <span className="text-[9px] text-gray-400 ml-0.5">{nearestSup.strength}</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 3 — Nearest Demand Zone */}
      {nearestDemand && (
        <div className="p-3 space-y-1">
          <p className={LABEL}>Nearest Demand Zone</p>
          <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
            {nearestDemand.bottom.toFixed(2)} – {nearestDemand.top.toFixed(2)}
          </p>
          {currentPrice > 0 && (
            <p className={SUB}>
              {((nearestDemand.top - currentPrice) / currentPrice * 100).toFixed(1)}% away
            </p>
          )}
        </div>
      )}

      {/* Section 4 — Recent Swings */}
      <div className="p-3 space-y-1">
        <p className={LABEL}>Recent Swings</p>
        <div className="space-y-1">
          {recentSwings.length
            ? recentSwings.slice(0, 6).map((sw, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${
                    sw.type === 'HH' ? 'text-blue-500'
                    : sw.type === 'HL' ? 'text-blue-400'
                    : sw.type === 'LH' ? 'text-gray-400'
                    : 'text-red-400'
                  }`}>{sw.type}</span>
                  <span className="text-[10px] font-mono text-gray-700 dark:text-gray-300">{sw.price.toFixed(2)}</span>
                  <span className={SUB + ' text-[9px]'}>{sw.date?.slice(5)}</span>
                </div>
              ))
            : <p className={SUB}>No swings detected</p>
          }
        </div>
      </div>

      {/* Section 5 — Volume */}
      {lastSpike && (
        <div className="p-3 space-y-1">
          <p className={LABEL}>Volume</p>
          <p className={SUB}>Last spike</p>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-semibold ${lastSpike.type === 'bull' ? 'text-green-500' : 'text-red-500'}`}>
              {lastSpike.ratio}× avg {lastSpike.type === 'bull' ? '▲' : '▼'}
            </span>
            <span className={SUB + ' text-[9px]'}>{lastSpike.date?.slice(5)}</span>
          </div>
          <p className={SUB}>Spikes in period: {volume_spikes.length}</p>
        </div>
      )}
    </div>
  )
}

// ── Right Panel ───────────────────────────────────────────────────────────────
function PARightPanel({ paData, kpis }) {
  const [tab, setTab] = useState('signals')

  const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const VAL   = 'text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100'
  const SUB   = 'text-[10px] text-gray-500 dark:text-gray-400'

  if (!paData) return (
    <div className="flex-1 flex items-center justify-center p-3">
      <p className="text-[10px] text-gray-400 text-center">No data yet</p>
    </div>
  )

  const { patterns, volume_spikes, support_resistance, demand_supply } = paData

  const recentPatterns = [...(patterns || [])].slice(-8).reverse()
  const recentSpikes   = [...(volume_spikes || [])].slice(-5).reverse()

  const PATTERN_LABELS = {
    bullish_engulfing: 'Bullish Engulfing',
    bearish_engulfing: 'Bearish Engulfing',
    hammer:            'Hammer',
    shooting_star:     'Shooting Star',
    bullish_pin:       'Bullish Pin Bar',
    bearish_pin:       'Bearish Pin Bar',
    inside_bar:        'Inside Bar',
    doji:              'Doji',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-gray-950">

      {/* Inner tab bar */}
      <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
        {[['signals', 'Signals'], ['levels', 'Levels']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${
              tab === id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 dark:divide-gray-800">

        {tab === 'signals' && (
          <>
            {/* Candle patterns */}
            <div className="p-3">
              <p className={LABEL}>Candle Patterns</p>
              {recentPatterns.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {recentPatterns.map((pt, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <span className={`text-[9px] font-bold ${pt.direction === 'bull' ? 'text-green-500' : pt.direction === 'bear' ? 'text-red-500' : 'text-gray-400'}`}>
                          {pt.direction === 'bull' ? '▲' : pt.direction === 'bear' ? '▼' : '→'}
                        </span>
                        <span className="text-[10px] text-gray-700 dark:text-gray-300 ml-1">
                          {PATTERN_LABELS[pt.type] ?? pt.type}
                        </span>
                      </div>
                      <span className={SUB + ' text-[9px]'}>{pt.date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>No patterns detected</p>}
            </div>

            {/* Volume spikes */}
            <div className="p-3">
              <p className={LABEL}>Volume Spikes</p>
              {recentSpikes.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {recentSpikes.map((sp, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold ${sp.type === 'bull' ? 'text-green-500' : 'text-red-500'}`}>
                        {sp.ratio}× avg {sp.type === 'bull' ? '▲' : '▼'}
                      </span>
                      <span className={SUB + ' text-[9px]'}>{sp.date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>No spikes in period</p>}
            </div>

            {/* KPIs */}
            <div className="p-3">
              <p className={LABEL}>Stats</p>
              {kpis ? (
                <div className="mt-1.5 space-y-1.5">
                  {[
                    { label: 'Win Rate',         value: `${kpis.winRate}%` },
                    { label: 'Avg Gain',         value: `+${kpis.avgGainPct.toFixed(1)}%` },
                    { label: 'Trend Streak',     value: kpis.trendStreak },
                    { label: 'Vol Spike / 30c',  value: kpis.spikeFreq.toFixed(1) },
                    { label: 'Avg S/R Touches',  value: kpis.avgTouches.toFixed(1) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className={SUB}>{label}</span>
                      <span className={VAL}>{value}</span>
                    </div>
                  ))}
                  {kpis.totalSignals > 0 && (
                    <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-1">
                      {kpis.wins}W / {kpis.losses}L of {kpis.totalSignals} closed
                    </p>
                  )}
                </div>
              ) : <p className={SUB + ' mt-1'}>Not enough data</p>}
            </div>
          </>
        )}

        {tab === 'levels' && (
          <>
            {/* S/R table */}
            <div className="p-3">
              <p className={LABEL}>Support & Resistance</p>
              {support_resistance?.length ? (
                <div className="mt-1.5 space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-3 gap-1 pb-1 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-[9px] text-gray-400 font-bold">TYPE</span>
                    <span className="text-[9px] text-gray-400 font-bold text-right">PRICE</span>
                    <span className="text-[9px] text-gray-400 font-bold text-right">TOUCHES</span>
                  </div>
                  {support_resistance.map((z, i) => (
                    <div key={i} className="grid grid-cols-3 gap-1 items-center">
                      <span className={`text-[9px] font-bold uppercase ${z.type === 'resistance' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                        {z.type === 'resistance' ? 'Res' : 'Sup'}
                      </span>
                      <span className="text-[10px] font-mono text-right text-gray-700 dark:text-gray-300">{z.price.toFixed(2)}</span>
                      <span className="text-[10px] text-right text-gray-500">{'●'.repeat(Math.min(z.touches, 5))}</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>None detected</p>}
            </div>

            {/* D/S zones */}
            <div className="p-3">
              <p className={LABEL}>Demand Zones</p>
              {demand_supply?.filter(z => z.type === 'demand').length ? (
                <div className="mt-1.5 space-y-1.5">
                  {demand_supply.filter(z => z.type === 'demand').slice(-5).reverse().map((z, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-green-600 dark:text-green-400">
                        {z.bottom.toFixed(2)} – {z.top.toFixed(2)}
                      </span>
                      <span className={SUB + ' text-[9px]'}>{z.origin_date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>None detected</p>}
            </div>

            <div className="p-3">
              <p className={LABEL}>Supply Zones</p>
              {demand_supply?.filter(z => z.type === 'supply').length ? (
                <div className="mt-1.5 space-y-1.5">
                  {demand_supply.filter(z => z.type === 'supply').slice(-5).reverse().map((z, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-red-500">
                        {z.bottom.toFixed(2)} – {z.top.toFixed(2)}
                      </span>
                      <span className={SUB + ' text-[9px]'}>{z.origin_date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>None detected</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Computations ──────────────────────────────────────────────────────────────

function computePAKPIs(paData, chartData) {
  if (!paData || !chartData?.length) return null

  const { patterns, volume_spikes, support_resistance, swings } = paData

  // Win rate: bullish patterns followed by ≥3% gain within 10 candles
  const WIN_THRESHOLD    = 3     // %
  const LOSS_THRESHOLD   = 2     // %
  const FORWARD_WINDOW   = 10    // candles

  const bullPatterns = (patterns || []).filter(p => p.direction === 'bull')
  let wins = 0, losses = 0, total = 0

  for (const pt of bullPatterns) {
    const idx = chartData.findIndex(d => d.time === pt.date)
    if (idx < 0 || idx >= chartData.length - FORWARD_WINDOW) continue
    total++
    const entry = chartData[idx].close
    let outcome = null
    for (let j = idx + 1; j <= idx + FORWARD_WINDOW; j++) {
      const c = chartData[j]
      if ((c.high - entry) / entry * 100 >= WIN_THRESHOLD)  { outcome = 'win';  break }
      if ((entry - c.low)  / entry * 100 >= LOSS_THRESHOLD) { outcome = 'loss'; break }
    }
    if (outcome === 'win')  wins++
    if (outcome === 'loss') losses++
  }

  // Trend streak: longest current run of same-direction swings
  const recentSwings = (swings || []).slice(-10)
  let streak = 0
  if (recentSwings.length >= 2) {
    const lastType = recentSwings[recentSwings.length - 1]?.type
    const isUp     = lastType === 'HH' || lastType === 'HL'
    for (let i = recentSwings.length - 1; i >= 0; i--) {
      const t = recentSwings[i].type
      const matchesUp = t === 'HH' || t === 'HL'
      if ((isUp && matchesUp) || (!isUp && !matchesUp)) streak++
      else break
    }
  }

  // Volume spike frequency per 30 candles
  const spikeFreq = chartData.length > 0
    ? ((volume_spikes?.length ?? 0) / chartData.length * 30)
    : 0

  // Avg touches
  const avgTouches = support_resistance?.length
    ? support_resistance.reduce((s, z) => s + z.touches, 0) / support_resistance.length
    : 0

  // Avg gain from closed wins (approximate)
  const avgGainPct = total > 0 ? WIN_THRESHOLD * (wins / Math.max(total, 1)) : 0

  return {
    winRate:      total > 0 ? Math.round(wins / total * 100) : 0,
    avgGainPct:   Math.round(avgGainPct * 10) / 10,
    trendStreak:  `${streak} streak`,
    spikeFreq,
    avgTouches,
    wins,
    losses,
    totalSignals: total,
  }
}

// ── PA Inner ──────────────────────────────────────────────────────────────────
function PAInner() {
  const { selectedSymbol, timeframe, isIndex } = useScreen() || {}

  const [paData,    setPaData]    = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [chartData, setChartData] = useState([])
  const [toggles,   setToggles]   = useState(DEFAULT_TOGGLES)
  const [config,    setConfig]    = useState(() => loadConfig())
  const chartDataRef = useRef([])

  const isStock = !isIndex?.()

  const days = TIMEFRAME_DAYS[timeframe] ?? 280

  const fetchPA = useCallback(async (sym, d) => {
    if (!sym || !isStock) return
    setLoading(true)
    try {
      const res = await getPriceActionScan({ symbol: sym, days: d })
      setPaData(res.data)
    } catch {
      setPaData(null)
    } finally {
      setLoading(false)
    }
  }, [isStock])

  useEffect(() => {
    if (selectedSymbol && isStock) fetchPA(selectedSymbol, days)
    else setPaData(null)
  }, [selectedSymbol, days, fetchPA, isStock])

  const currentPrice = chartData?.[chartData.length - 1]?.close ?? 0

  const kpis = useMemo(() => computePAKPIs(paData, chartData), [paData, chartData])

  const paOverlayData = useMemo(() => ({
    paData:    isStock ? paData : null,
    paToggles: toggles,
  }), [paData, toggles, isStock])

  return (
    <>
      <PAToolbar
        toggles={toggles} setToggles={setToggles}
        config={config}   setConfig={setConfig}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left panel */}
        <div className="w-[10%] min-w-[120px] max-w-[180px] border-r border-gray-100 dark:border-gray-800 overflow-y-auto hidden lg:flex flex-col shrink-0">
          <PALeftPanel
            paData={isStock ? paData : null}
            chartData={chartData}
            currentPrice={currentPrice}
          />
        </div>

        {/* Center chart */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {loading && (
            <div className="absolute top-2 right-3 z-30 pointer-events-none">
              <span className="text-[9px] text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                Scanning...
              </span>
            </div>
          )}
          <StockChart
            hideToolbar
            {...paOverlayData}
            onChartDataReady={(data) => {
              chartDataRef.current = data
              setChartData(data)
            }}
          />
        </div>

        {/* Right panel */}
        <div className="w-[15%] min-w-[160px] max-w-[240px] border-l border-gray-100 dark:border-gray-800 hidden lg:flex flex-col shrink-0">
          <PARightPanel paData={isStock ? paData : null} kpis={kpis} />
        </div>
      </div>
    </>
  )
}

// ── PriceActionPage — exported default ───────────────────────────────────────
// Default to NABIL so data loads immediately on open (same as SMC tab).
export default function PriceActionPage() {
  return (
    <ScreenProvider disablePositions initialSymbol="NABIL" initialIndexId={null} initialIsIndex={false}>
      <PAInner />
    </ScreenProvider>
  )
}
