// === SMCChartPage.jsx — SMC chart tab: StockChart + SMC overlays (BOS/CHoCH/OB/FVG/Sweeps/Entry), left/right panels, toolbar ===
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
import StockChart from './StockChart'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'
import { getSMCScan } from '../../api'
import { getMarketSymbols } from '../../utils/globalCache'
import {
  ToolbarDivider,
  ToolbarSymbolSearch,
  ToolbarTimeframes,
  ToolbarToggleChip,
  ToolbarConfigButton,
  ToolbarConfigTitle,
  ToolbarConfigSection,
} from './ScreenToolbarAtoms'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  minScore: 3,
  useBOS: true,
  useCHoCH: true,
  useDiscount: true,
  discountPct: 40,
  useOB: true,
  useFVG: true,
  fvgMaxDistPct: 3,
  useSweep: true,
}

const DEFAULT_TOGGLES = {
  showBOS: true,
  showCHoCH: true,
  showOB: false,
  showFVG: false,
  showSweeps: false,
  showEntry: false,
}

// Map chart timeframe to SMC scan days — timeframe drives everything, no separate selector
const TIMEFRAME_DAYS = { '6M': 180, '1Y': 280, '3Y': 750, ALL: 750 }

// ── Config persistence ────────────────────────────────────────────────────────
function loadConfig() {
  try {
    const s = localStorage.getItem('smc_config')
    if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }
  } catch {}
  return DEFAULT_CONFIG
}
function saveConfig(cfg) {
  try {
    localStorage.setItem('smc_config', JSON.stringify(cfg))
  } catch {}
}

const SMC_TIMEFRAMES = ['6M', '1Y', '3Y', 'ALL']

// ── SMC Toolbar ───────────────────────────────────────────────────────────────
function SMCToolbar({ toggles, setToggles, config, setConfig, symbols }) {
  const toggle = (key) => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  const updateConfig = (key, val) => {
    const next = { ...config, [key]: val }
    setConfig(next)
    saveConfig(next)
  }

  return useScreenToolbarSlot(
    <div className="flex items-center gap-1.5 min-w-0">
      <ToolbarSymbolSearch symbols={symbols} stocksOnly />
      <ToolbarDivider />
      <ToolbarTimeframes frames={SMC_TIMEFRAMES} />
      <ToolbarDivider />

      <ToolbarToggleChip
        label="BOS"
        active={toggles.showBOS}
        onClick={() => toggle('showBOS')}
        activeColor="#22c55e"
      />
      <ToolbarToggleChip
        label="CHoCH"
        active={toggles.showCHoCH}
        onClick={() => toggle('showCHoCH')}
        activeColor="#f59e0b"
      />
      <ToolbarToggleChip
        label="OB"
        active={toggles.showOB}
        onClick={() => toggle('showOB')}
        activeColor="#22c55e"
      />
      <ToolbarToggleChip
        label="FVG"
        active={toggles.showFVG}
        onClick={() => toggle('showFVG')}
        activeColor="#3b82f6"
      />
      <ToolbarToggleChip
        label="Sweeps"
        active={toggles.showSweeps}
        onClick={() => toggle('showSweeps')}
        activeColor="#a78bfa"
      />
      <ToolbarToggleChip
        label="Entry"
        active={toggles.showEntry}
        onClick={() => toggle('showEntry')}
        activeColor="#10b981"
      />

      <ToolbarDivider />

      <ToolbarConfigButton>
        <ToolbarConfigTitle>Signal Configuration</ToolbarConfigTitle>

        <ToolbarConfigSection label="Min confluence score">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => updateConfig('minScore', n)}
                className={`w-8 h-8 rounded text-[10px] font-bold transition-colors ${
                  config.minScore === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </ToolbarConfigSection>

        <ToolbarConfigSection label="Active conditions">
          <div className="space-y-1.5">
            {[
              { key: 'useBOS', label: 'Bullish BOS' },
              { key: 'useCHoCH', label: 'Bullish CHoCH' },
              { key: 'useOB', label: 'OB Mitigation' },
              { key: 'useSweep', label: 'Liquidity Sweep' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config[key]}
                  onChange={(e) => updateConfig(key, e.target.checked)}
                  className="w-3 h-3 rounded accent-blue-600"
                />
                <span className="text-[11px] text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.useDiscount}
                onChange={(e) => updateConfig('useDiscount', e.target.checked)}
                className="w-3 h-3 rounded accent-blue-600"
              />
              <span className="text-[11px] text-gray-700 dark:text-gray-300">Discount zone ≤</span>
              <input
                type="number"
                value={config.discountPct}
                min={10}
                max={50}
                step={5}
                onChange={(e) => updateConfig('discountPct', parseInt(e.target.value) || 40)}
                className="w-8 text-[10px] text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              />
              <span className="text-[10px] text-gray-400">%</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.useFVG}
                onChange={(e) => updateConfig('useFVG', e.target.checked)}
                className="w-3 h-3 rounded accent-blue-600"
              />
              <span className="text-[11px] text-gray-700 dark:text-gray-300">FVG fill ≤</span>
              <input
                type="number"
                value={config.fvgMaxDistPct}
                min={1}
                max={10}
                step={1}
                onChange={(e) => updateConfig('fvgMaxDistPct', parseInt(e.target.value) || 3)}
                className="w-8 text-[10px] text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              />
              <span className="text-[10px] text-gray-400">%</span>
            </label>
          </div>
        </ToolbarConfigSection>

        <button
          onClick={() => {
            setConfig(DEFAULT_CONFIG)
            saveConfig(DEFAULT_CONFIG)
          }}
          className="text-[10px] text-blue-500 hover:underline"
        >
          Reset to defaults
        </button>
      </ToolbarConfigButton>
    </div>
  )
}

// ── SMC Left Panel ────────────────────────────────────────────────────────────
function SMCLeftPanel({ smcData, chartData, currentPrice }) {
  if (!smcData)
    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          How to use
        </p>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Search a stock in the toolbar above' },
            { step: '2', text: 'Select a timeframe (6M, 1Y, 3Y…)' },
            { step: '3', text: 'Toggle BOS, OB, FVG to see overlays' },
            { step: '4', text: 'Turn on Entry for buy signal markers' },
            { step: '5', text: 'Use Config to tune signal sensitivity' },
          ].map(({ step, text }) => (
            <div key={step} className="flex gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold flex items-center justify-center">
                {step}
              </span>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
            Overlays
          </p>
          {[
            { color: '#22c55e', label: 'BOS — Break of Structure' },
            { color: '#f59e0b', label: 'CHoCH — Trend reversal' },
            { color: '#22c55e', label: 'OB — Order Block zone' },
            { color: '#3b82f6', label: 'FVG — Fair Value Gap' },
            { color: '#a78bfa', label: 'Sweeps — Liquidity' },
            { color: '#10b981', label: 'Entry — Buy signals' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    )

  const { bos, choch, order_blocks, fvg, sweeps } = smcData

  const lastBOS = [...bos].pop()
  const lastChoch = choch[choch.length - 1]
  const bullOB = order_blocks.filter((o) => o.type === 'bullish')
  const bearOB = order_blocks.filter((o) => o.type === 'bearish')
  const bullFVG = fvg.filter((f) => f.type === 'bullish' && !f.mitigated)
  const buySweeps = sweeps.filter((s) => s.type === 'buy_side')

  // Zone position using full chart range — stable, matches signal computation
  const rangeHigh = chartData?.length ? Math.max(...chartData.map((d) => d.high)) : 0
  const rangeLow = chartData?.length ? Math.min(...chartData.map((d) => d.low)) : 0
  const posPct =
    rangeHigh > rangeLow && currentPrice
      ? Math.round(((currentPrice - rangeLow) / (rangeHigh - rangeLow)) * 100)
      : null
  const posLabel =
    posPct === null ? null : posPct <= 35 ? 'DISCOUNT' : posPct >= 65 ? 'PREMIUM' : 'EQUILIBRIUM'

  const LABEL =
    'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const SUB = 'text-[10px] text-gray-500 dark:text-gray-400'
  const ROW = 'flex items-center justify-between py-0.5'

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-800">
      {/* Section 1 — Market Structure */}
      <div className="p-3 space-y-2">
        <p className={LABEL}>Structure</p>

        {/* Last BOS */}
        <div className={ROW}>
          <span className={SUB}>Last BOS</span>
          {lastBOS ? (
            <span
              className={`text-[10px] font-semibold ${lastBOS.type === 'bullish' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
            >
              {lastBOS.type === 'bullish' ? '▲' : '▼'}{' '}
              {lastBOS.type === 'bullish' ? 'Bull' : 'Bear'}
            </span>
          ) : (
            <span className={SUB}>—</span>
          )}
        </div>
        {lastBOS && (
          <p className="text-[9px] text-gray-400 -mt-1.5">
            {lastBOS.date} · {parseFloat(lastBOS.level).toFixed(2)}
          </p>
        )}

        {/* Last CHoCH */}
        <div className={ROW}>
          <span className={SUB}>Last CHoCH</span>
          {lastChoch ? (
            <span
              className={`text-[10px] font-semibold ${lastChoch.type === 'bullish' ? 'text-amber-500' : 'text-red-500'}`}
            >
              {lastChoch.type === 'bullish' ? '▲' : '▼'}{' '}
              {lastChoch.type === 'bullish' ? 'Bull' : 'Bear'}
            </span>
          ) : (
            <span className={SUB}>—</span>
          )}
        </div>
        {lastChoch && <p className="text-[9px] text-gray-400 -mt-1.5">{lastChoch.date}</p>}
      </div>

      {/* Section 2 — Zone Position */}
      <div className="p-3 space-y-2">
        <p className={LABEL}>Zone Position</p>
        {posLabel ? (
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                posLabel === 'DISCOUNT'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : posLabel === 'PREMIUM'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              {posLabel}
            </span>
            <span className="text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
              {posPct}%
            </span>
          </div>
        ) : (
          <span className={SUB}>—</span>
        )}
        <div className="flex justify-between">
          <span className={SUB}>H: {rangeHigh ? rangeHigh.toFixed(2) : '—'}</span>
          <span className={SUB}>L: {rangeLow ? rangeLow.toFixed(2) : '—'}</span>
        </div>
      </div>

      {/* Section 3 — Active Zones */}
      <div className="p-3 space-y-1.5">
        <p className={LABEL}>Active Zones</p>
        <div className={ROW}>
          <span className={SUB}>Bull OB</span>
          <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
            {bullOB.length}
          </span>
        </div>
        <div className={ROW}>
          <span className={SUB}>Bear OB</span>
          <span className="text-[10px] font-semibold text-red-500">{bearOB.length}</span>
        </div>
        <div className={ROW}>
          <span className={SUB}>Bull FVG</span>
          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            {bullFVG.length}
          </span>
        </div>
        <div className={ROW}>
          <span className={SUB}>Buy Sweeps</span>
          <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
            {buySweeps.length}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── SMC Right Panel ───────────────────────────────────────────────────────────
function SMCRightPanel({ smcData, signals }) {
  const LABEL =
    'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const SUB = 'text-[10px] text-gray-500 dark:text-gray-400'
  const VAL = 'text-[11px] font-semibold tabular-nums text-gray-800 dark:text-gray-100'
  const ROW = 'flex items-center justify-between py-0.5'

  const CONDITIONS = [
    { key: 'bos', label: 'BOS', color: '#22c55e' },
    { key: 'choch', label: 'CHoCH', color: '#f59e0b' },
    { key: 'discount', label: 'Discount', color: '#3b82f6' },
    { key: 'ob', label: 'OB', color: '#22c55e' },
    { key: 'fvg', label: 'FVG', color: '#3b82f6' },
    { key: 'sweep', label: 'Sweep', color: '#a78bfa' },
  ]

  if (!smcData)
    return (
      <div className="flex-1 flex items-center justify-center p-3">
        <p className="text-[10px] text-gray-400 text-center">No data</p>
      </div>
    )

  const lastSignal = signals?.[signals.length - 1]
  const recentSignals = signals?.slice(-8).reverse() || []
  const bullOBs = smcData.order_blocks
    .filter((o) => o.type === 'bullish')
    .slice(-5)
    .reverse()
  const bullFVGs = smcData.fvg
    .filter((f) => f.type === 'bullish' && !f.mitigated)
    .slice(-5)
    .reverse()

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-800">
      {/* Last Signal */}
      <div className="p-3 space-y-2">
        <p className={LABEL}>Last Signal</p>
        {lastSignal ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-green-600 dark:text-green-400">
                ▲ BUY
              </span>
              <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                {lastSignal.score}/6
              </span>
            </div>
            <p className={SUB}>{lastSignal.date}</p>
            <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
              @ {lastSignal.entryPrice?.toFixed(2)}
            </p>
            {/* Condition dots — lit = met, dim = not met */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {CONDITIONS.map(({ key, label, color }) => (
                <span
                  key={key}
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border"
                  style={
                    lastSignal.conditions[key]
                      ? { color, borderColor: color + '60', background: color + '18' }
                      : { color: '#9ca3af', borderColor: '#e5e7eb', background: 'transparent' }
                  }
                >
                  {label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className={SUB}>No signals in period</p>
        )}
      </div>

      {/* Signal History */}
      <div className="p-3 space-y-1">
        <p className={LABEL}>History</p>
        {recentSignals.length ? (
          recentSignals.map((sig, i) => (
            <div key={i} className={ROW}>
              <span className={SUB}>{sig.date}</span>
              <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                {sig.score}/6
              </span>
            </div>
          ))
        ) : (
          <p className={SUB}>—</p>
        )}
        {signals?.length > 8 && (
          <p className="text-[9px] text-gray-400 pt-0.5">{signals.length} total in period</p>
        )}
      </div>

      {/* Zone Stats */}
      <div className="p-3 space-y-1.5">
        <p className={LABEL}>Zone Stats</p>
        <div className={ROW}>
          <span className={SUB}>Buy signals</span>
          <span className={VAL}>{signals?.length ?? 0}</span>
        </div>
        <div className={ROW}>
          <span className={SUB}>Active OBs</span>
          <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">
            {bullOBs.length}
          </span>
        </div>
        <div className={ROW}>
          <span className={SUB}>Active FVGs</span>
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            {bullFVGs.length}
          </span>
        </div>
      </div>

      {/* Bullish OB list */}
      {bullOBs.length > 0 && (
        <div className="p-3 space-y-1">
          <p className={LABEL}>Bull Order Blocks</p>
          {bullOBs.map((ob, i) => (
            <div key={i} className={ROW}>
              <span className="text-[10px] font-mono text-green-600 dark:text-green-400">
                {parseFloat(ob.low).toFixed(2)}–{parseFloat(ob.high).toFixed(2)}
              </span>
              <span className={SUB}>{ob.date?.slice(5)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bullish FVG list */}
      {bullFVGs.length > 0 && (
        <div className="p-3 space-y-1">
          <p className={LABEL}>Bull FVGs</p>
          {bullFVGs.map((f, i) => (
            <div key={i} className={ROW}>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                {parseFloat(f.bottom).toFixed(2)}–{parseFloat(f.top).toFixed(2)}
              </span>
              <span className={SUB}>{f.date?.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Computations ──────────────────────────────────────────────────────────────

function computeSignals(smcData, config, chartData) {
  if (!smcData || !chartData?.length) return []
  const { bos, choch, order_blocks, fvg, sweeps } = smcData
  const signals = []

  // Fixed range for discount zone — full scan period, not rolling
  const rangeHigh = Math.max(...chartData.map((d) => d.high))
  const rangeLow = Math.min(...chartData.map((d) => d.low))

  // BOS recency window: signal only if bullish BOS happened within last 60 candles
  const BOS_WINDOW = 60
  // CHoCH recency window: last CHoCH must be bullish and within last 80 candles
  const CHOCH_WINDOW = 80

  chartData.forEach((candle, i) => {
    if (i < 20) return // need enough history

    let score = 0
    const cond = { bos: false, choch: false, discount: false, ob: false, fvg: false, sweep: false }

    // 1. Recent bullish BOS (within last BOS_WINDOW candles before this one)
    const windowStart = chartData[Math.max(0, i - BOS_WINDOW)]?.time ?? ''
    const recentBullBOS = bos.some(
      (b) => b.type === 'bullish' && b.date > windowStart && b.date <= candle.time
    )
    cond.bos = recentBullBOS
    if (config.useBOS && recentBullBOS) score++

    // 2. Last CHoCH within CHOCH_WINDOW candles was bullish
    const chochWindow = chartData[Math.max(0, i - CHOCH_WINDOW)]?.time ?? ''
    const prevChoch = [...choch].filter((c) => c.date > chochWindow && c.date <= candle.time).pop()
    cond.choch = prevChoch?.type === 'bullish'
    if (config.useCHoCH && cond.choch) score++

    // 3. Price in discount zone (fixed range for entire period)
    const posPct =
      rangeHigh === rangeLow ? 50 : ((candle.close - rangeLow) / (rangeHigh - rangeLow)) * 100
    cond.discount = posPct <= config.discountPct
    if (config.useDiscount && cond.discount) score++

    // 4. Price touching a bullish OB (candle low ≤ ob.high AND candle close ≥ ob.low)
    const inOB = order_blocks.some(
      (ob) =>
        ob.type === 'bullish' &&
        ob.date < candle.time &&
        candle.low <= parseFloat(ob.high) &&
        candle.close >= parseFloat(ob.low)
    )
    cond.ob = inOB
    if (config.useOB && inOB) score++

    // 5. Price near/touching bullish FVG (within fvgMaxDistPct % above bottom)
    const nearFVG = fvg.some(
      (f) =>
        f.type === 'bullish' &&
        f.date < candle.time &&
        candle.low <= parseFloat(f.top) * (1 + config.fvgMaxDistPct / 100) &&
        candle.close >= parseFloat(f.bottom)
    )
    cond.fvg = nearFVG
    if (config.useFVG && nearFVG) score++

    // 6. Buy-side sweep within last 15 candles
    const sweepWindow = chartData[Math.max(0, i - 15)]?.time ?? ''
    const recentSweep = sweeps.some(
      (s) => s.type === 'buy_side' && s.date > sweepWindow && s.date <= candle.time
    )
    cond.sweep = recentSweep
    if (config.useSweep && recentSweep) score++

    if (score >= config.minScore) {
      // Suppress consecutive signals on same zone — require 3-candle gap
      const prev = signals[signals.length - 1]
      if (prev) {
        const prevIdx = chartData.findIndex((d) => d.time === prev.date)
        if (i - prevIdx < 3) return
      }
      signals.push({ date: candle.time, score, conditions: cond, entryPrice: candle.close })
    }
  })

  return signals
}

// ── SMC Inner — reads ScreenContext ──────────────────────────────────────────
function SMCInner() {
  const { selectedSymbol, timeframe, isIndex } = useScreen() || {}
  const [leftOpen, setLeftOpen] = useState(
    () => localStorage.getItem('tradeo_smc_leftOpen') !== 'false'
  )
  const [rightOpen, setRightOpen] = useState(
    () => localStorage.getItem('tradeo_smc_rightOpen') !== 'false'
  )
  const toggleLeft = () =>
    setLeftOpen((v) => {
      localStorage.setItem('tradeo_smc_leftOpen', String(!v))
      return !v
    })
  const toggleRight = () =>
    setRightOpen((v) => {
      localStorage.setItem('tradeo_smc_rightOpen', String(!v))
      return !v
    })

  const [smcData, setSmcData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState([]) // state (not ref) so useMemo reacts
  const [toggles, setToggles] = useState(DEFAULT_TOGGLES)
  const [config, setConfig] = useState(() => loadConfig())
  const [symbols, setSymbols] = useState(null)

  useEffect(() => {
    getMarketSymbols()
      .then((r) => {
        if (r.data?.stocks?.length) setSymbols(r.data)
      })
      .catch(() => {})
  }, [])

  const isStock = !isIndex?.()

  // Derive scan days from current chart timeframe — no separate selector needed
  const days = TIMEFRAME_DAYS[timeframe] ?? 280

  // Fetch SMC data when symbol or timeframe changes — cancelled flag prevents a slow
  // earlier response from overwriting a newer one on rapid symbol/timeframe switches
  useEffect(() => {
    if (!selectedSymbol || !isStock) {
      setSmcData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getSMCScan({ symbol: selectedSymbol, days })
      .then((res) => {
        if (!cancelled) setSmcData(res.data)
      })
      .catch(() => {
        if (!cancelled) setSmcData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSymbol, days, isStock])

  const currentPrice = chartData.length ? chartData[chartData.length - 1].close : 0

  // Score only the candles the backend actually scanned. The chart can hold far more
  // history (ALL = full listing) than the scan window (≤750 requested, ≤400 in prod —
  // smcData.candles is the authoritative count), and scoring outside that window
  // produces signals against BOS/OB/FVG events that were never detected.
  const scanData = useMemo(
    () => (smcData?.candles ? chartData.slice(-smcData.candles) : chartData),
    [chartData, smcData]
  )

  const signals = useMemo(
    () => computeSignals(smcData, config, scanData),
    [smcData, config, scanData]
  )

  const smcOverlayData = useMemo(
    () => ({
      smcData: isStock ? smcData : null,
      smcToggles: toggles,
      smcSignals: isStock ? signals : [],
    }),
    [smcData, toggles, signals, isStock]
  )

  const handleChartDataReady = useCallback((data) => {
    setChartData(data)
  }, [])

  return (
    <>
      {/* Toolbar injected into Screen tab bar */}
      <SMCToolbar
        toggles={toggles}
        setToggles={setToggles}
        config={config}
        setConfig={setConfig}
        symbols={symbols}
      />

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden min-h-0 animate-fade-up">
        {/* Left panel — collapsible glass */}
        <div
          className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative
                        bg-white/50 dark:bg-gray-950/60 backdrop-blur-2xl
                        shadow-[1px_0_0_rgba(255,255,255,0.18),2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[1px_0_0_rgba(255,255,255,0.07),2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-200 ease-in-out
                        ${leftOpen ? 'w-[13%] min-w-[150px] max-w-[200px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'} ${!leftOpen ? 'screen-panel-collapsed' : ''}`}
        >
          <div className="screen-panel-content flex flex-col h-full">
            {/* scanData (not full chartData) — zone position must use the same range as signal scoring */}
            <SMCLeftPanel
              smcData={isStock ? smcData : null}
              chartData={scanData}
              currentPrice={currentPrice}
            />
          </div>
        </div>

        {/* Center chart — toggle buttons on both edges */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {/* Left toggle */}
          <button
            onClick={toggleLeft}
            title={leftOpen ? 'Hide left panel' : 'Show left panel'}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-30
                       h-12 w-4 items-center justify-center
                       bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                       border-y border-r border-gray-200/60 dark:border-gray-700/50
                       rounded-r-lg shadow-sm text-gray-400 dark:text-gray-500
                       hover:bg-white dark:hover:bg-gray-700
                       hover:text-blue-500 dark:hover:text-blue-400
                       transition-all duration-150"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-200 ${leftOpen ? '' : 'rotate-180'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Right toggle */}
          <button
            onClick={toggleRight}
            title={rightOpen ? 'Hide right panel' : 'Show right panel'}
            className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-30
                       h-12 w-4 items-center justify-center
                       bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                       border-y border-l border-gray-200/60 dark:border-gray-700/50
                       rounded-l-lg shadow-sm text-gray-400 dark:text-gray-500
                       hover:bg-white dark:hover:bg-gray-700
                       hover:text-blue-500 dark:hover:text-blue-400
                       transition-all duration-150"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-200 ${rightOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {loading && (
            <div className="absolute top-2 right-3 z-30 pointer-events-none">
              <span className="text-[9px] text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                Scanning...
              </span>
            </div>
          )}
          <StockChart hideToolbar {...smcOverlayData} onChartDataReady={handleChartDataReady} />
        </div>

        {/* Right panel — collapsible glass */}
        <div
          className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative
                        bg-white/50 dark:bg-gray-950/60 backdrop-blur-2xl
                        shadow-[-1px_0_0_rgba(255,255,255,0.18),-2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[-1px_0_0_rgba(255,255,255,0.07),-2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-200 ease-in-out
                        ${rightOpen ? 'w-[15%] min-w-[160px] max-w-[240px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'} ${!rightOpen ? 'screen-panel-collapsed' : ''}`}
        >
          <div className="screen-panel-content flex flex-col h-full">
            <SMCRightPanel smcData={isStock ? smcData : null} signals={signals} />
          </div>
        </div>
      </div>
    </>
  )
}

// ── SMCChartPage — exported default ──────────────────────────────────────────
// Default to NABIL so SMC data loads immediately on open.
// NEPSE index has no SMC scan support — starting on a stock is better UX.
export default function SMCChartPage() {
  return (
    <ScreenProvider
      disablePositions
      initialSymbol="NABIL"
      initialIndexId={null}
      initialIsIndex={false}
    >
      <SMCInner />
    </ScreenProvider>
  )
}
