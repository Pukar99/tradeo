// === SMCChartPage.jsx — SMC chart tab: StockChart + SMC overlays (BOS/CHoCH/OB/FVG/Sweeps/Entry), left/right panels, toolbar ===
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
import StockChart from './StockChart'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'
import { getSMCScan } from '../../api'
import { getMarketSymbols } from '../../utils/globalCache'
import {
  ToolbarDivider, ToolbarSymbolSearch, ToolbarTimeframes,
  ToolbarToggleChip, ToolbarConfigButton, ToolbarConfigTitle,
  ToolbarConfigSection,
} from './ScreenToolbarAtoms'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  minScore:      3,
  useBOS:        true,
  useCHoCH:      true,
  useDiscount:   true,
  discountPct:   40,
  useOB:         true,
  useFVG:        true,
  fvgMaxDistPct: 3,
  useSweep:      true,
}

const DEFAULT_TOGGLES = {
  showBOS:    true,
  showCHoCH:  true,
  showOB:     false,
  showFVG:    false,
  showSweeps: false,
  showEntry:  false,
}

// Map chart timeframe to SMC scan days — timeframe drives everything, no separate selector
const TIMEFRAME_DAYS = { '6M': 180, '1Y': 280, '3Y': 750, 'ALL': 750 }

// ── Config persistence ────────────────────────────────────────────────────────
function loadConfig() {
  try { const s = localStorage.getItem('smc_config'); if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) } } catch {}
  return DEFAULT_CONFIG
}
function saveConfig(cfg) {
  try { localStorage.setItem('smc_config', JSON.stringify(cfg)) } catch {}
}

const SMC_TIMEFRAMES = ['6M', '1Y', '3Y', 'ALL']

// ── SMC Toolbar ───────────────────────────────────────────────────────────────
function SMCToolbar({ toggles, setToggles, config, setConfig, symbols }) {
  const toggle = (key) => setToggles(prev => ({ ...prev, [key]: !prev[key] }))
  const updateConfig = (key, val) => {
    const next = { ...config, [key]: val }
    setConfig(next); saveConfig(next)
  }

  return useScreenToolbarSlot(
    <div className="flex items-center gap-1.5 min-w-0">

      <ToolbarSymbolSearch symbols={symbols} stocksOnly />
      <ToolbarDivider />
      <ToolbarTimeframes frames={SMC_TIMEFRAMES} />
      <ToolbarDivider />

      <ToolbarToggleChip label="BOS"    active={toggles.showBOS}    onClick={() => toggle('showBOS')}    activeColor="#22c55e" />
      <ToolbarToggleChip label="CHoCH"  active={toggles.showCHoCH}  onClick={() => toggle('showCHoCH')}  activeColor="#f59e0b" />
      <ToolbarToggleChip label="OB"     active={toggles.showOB}     onClick={() => toggle('showOB')}     activeColor="#22c55e" />
      <ToolbarToggleChip label="FVG"    active={toggles.showFVG}    onClick={() => toggle('showFVG')}    activeColor="#3b82f6" />
      <ToolbarToggleChip label="Sweeps" active={toggles.showSweeps} onClick={() => toggle('showSweeps')} activeColor="#a78bfa" />
      <ToolbarToggleChip label="Entry"  active={toggles.showEntry}  onClick={() => toggle('showEntry')}  activeColor="#10b981" />

      <ToolbarDivider />

      <ToolbarConfigButton>
        <ToolbarConfigTitle>Signal Configuration</ToolbarConfigTitle>

        <ToolbarConfigSection label="Min confluence score">
          <div className="flex gap-1">
            {[1,2,3,4,5,6].map(n => (
              <button key={n} onClick={() => updateConfig('minScore', n)}
                className={`w-8 h-8 rounded text-[10px] font-bold transition-colors ${
                  config.minScore === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}>{n}</button>
            ))}
          </div>
        </ToolbarConfigSection>

        <ToolbarConfigSection label="Active conditions">
          <div className="space-y-1.5">
            {[
              { key: 'useBOS',   label: 'Bullish BOS' },
              { key: 'useCHoCH', label: 'Bullish CHoCH' },
              { key: 'useOB',    label: 'OB Mitigation' },
              { key: 'useSweep', label: 'Liquidity Sweep' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config[key]} onChange={e => updateConfig(key, e.target.checked)}
                  className="w-3 h-3 rounded accent-blue-600" />
                <span className="text-[11px] text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.useDiscount} onChange={e => updateConfig('useDiscount', e.target.checked)}
                className="w-3 h-3 rounded accent-blue-600" />
              <span className="text-[11px] text-gray-700 dark:text-gray-300">Discount zone ≤</span>
              <input type="number" value={config.discountPct} min={10} max={50} step={5}
                onChange={e => updateConfig('discountPct', parseInt(e.target.value) || 40)}
                className="w-8 text-[10px] text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200" />
              <span className="text-[10px] text-gray-400">%</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.useFVG} onChange={e => updateConfig('useFVG', e.target.checked)}
                className="w-3 h-3 rounded accent-blue-600" />
              <span className="text-[11px] text-gray-700 dark:text-gray-300">FVG fill ≤</span>
              <input type="number" value={config.fvgMaxDistPct} min={1} max={10} step={1}
                onChange={e => updateConfig('fvgMaxDistPct', parseInt(e.target.value) || 3)}
                className="w-8 text-[10px] text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200" />
              <span className="text-[10px] text-gray-400">%</span>
            </label>
          </div>
        </ToolbarConfigSection>

        <button onClick={() => { setConfig(DEFAULT_CONFIG); saveConfig(DEFAULT_CONFIG) }}
          className="text-[10px] text-blue-500 hover:underline">Reset to defaults</button>
      </ToolbarConfigButton>

    </div>
  )
}

// ── SMC Left Panel ────────────────────────────────────────────────────────────
function SMCLeftPanel({ smcData, biasScore, chartData, currentPrice }) {
  if (!smcData) return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">How to use</p>
      <div className="space-y-2">
        {[
          { step: '1', text: 'Search a stock in the toolbar above' },
          { step: '2', text: 'Select a timeframe (1M, 3M, 1Y…)' },
          { step: '3', text: 'Toggle BOS, OB, FVG to show overlays on chart' },
          { step: '4', text: 'Turn on Entry to see buy signal markers' },
          { step: '5', text: 'Use Config to adjust signal sensitivity' },
        ].map(({ step, text }) => (
          <div key={step} className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold flex items-center justify-center">{step}</span>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Overlays</p>
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

  const lastBullBOS  = [...bos].filter(b => b.type === 'bullish').pop()
  const lastChoch    = choch[choch.length - 1]
  const bullBOS      = bos.filter(b => b.type === 'bullish').length
  const bearBOS      = bos.filter(b => b.type === 'bearish').length
  const bullOB       = order_blocks.filter(o => o.type === 'bullish')
  const bearOB       = order_blocks.filter(o => o.type === 'bearish')
  const bullFVG      = fvg.filter(f => f.type === 'bullish' && !f.mitigated)
  const buySweeps    = sweeps.filter(s => s.type === 'buy_side')
  const nearestOB    = bullOB[bullOB.length - 1]
  const nearestFVG   = bullFVG[bullFVG.length - 1]

  const rangeHigh = chartData?.length ? Math.max(...chartData.map(d => d.high)) : 0
  const rangeLow  = chartData?.length ? Math.min(...chartData.map(d => d.low))  : 0

  const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const VAL   = 'text-[11px] font-semibold text-gray-800 dark:text-gray-100'
  const SUB   = 'text-[10px] text-gray-500 dark:text-gray-400'

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-800">

      {/* Section 1 — Bias */}
      <div className="p-3 space-y-2">
        <p className={LABEL}>Bias</p>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: biasScore.color }}>
            {biasScore.label}
          </span>
          <span className="text-[10px] text-gray-400">{biasScore.score}/100</span>
        </div>
        {/* Score bar */}
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${biasScore.score}%`, backgroundColor: biasScore.color }} />
        </div>
      </div>

      {/* Section 2 — Structure */}
      <div className="p-3 space-y-2">
        <p className={LABEL}>Structure</p>
        {lastBullBOS ? (
          <div>
            <p className={SUB}>Last BOS</p>
            <p className="text-[11px] font-semibold text-green-600 dark:text-green-400">▲ Bullish</p>
            <p className={SUB}>{lastBullBOS.date} · {lastBullBOS.level?.toFixed(2)}</p>
          </div>
        ) : <p className={SUB}>No bullish BOS</p>}

        {lastChoch ? (
          <div className="mt-1">
            <p className={SUB}>Last CHoCH</p>
            <p className={`text-[11px] font-semibold ${lastChoch.type === 'bullish' ? 'text-amber-500' : 'text-red-500'}`}>
              {lastChoch.type === 'bullish' ? '▲' : '▼'} {lastChoch.type}
            </p>
            <p className={SUB}>{lastChoch.date}</p>
          </div>
        ) : null}

        <div className="flex gap-2 mt-1">
          <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-semibold">{bullBOS} Bull</span>
          <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">{bearBOS} Bear</span>
        </div>
      </div>

      {/* Section 3 — Zone Position */}
      <div className="p-3 space-y-2">
        <p className={LABEL}>Zone Position</p>
        <div className={`px-2 py-1 rounded-md text-[10px] font-bold inline-block ${
          biasScore.posLabel === 'DISCOUNT'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : biasScore.posLabel === 'PREMIUM'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}>
          {biasScore.posLabel} {biasScore.posPct}%
        </div>
        <div className="space-y-0.5">
          <p className={SUB}>H: {rangeHigh.toFixed(2)}</p>
          <p className={SUB}>L: {rangeLow.toFixed(2)}</p>
        </div>

        <p className={LABEL}>Active Zones</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={SUB}>OB</span>
            <div className="flex gap-1">
              <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">▲{bullOB.length}</span>
              <span className="text-[10px] text-red-500 font-semibold">▼{bearOB.length}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={SUB}>FVG</span>
            <div className="flex gap-1">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">▲{bullFVG.length}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={SUB}>Sweeps</span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">{buySweeps.length}</span>
          </div>
        </div>

        {nearestOB && (
          <div className="mt-1">
            <p className={SUB}>Nearest Bull OB</p>
            <p className="text-[10px] text-green-600 dark:text-green-400 font-mono">{nearestOB.low?.toFixed(2)}–{nearestOB.high?.toFixed(2)}</p>
          </div>
        )}
        {nearestFVG && (
          <div className="mt-1">
            <p className={SUB}>Nearest FVG</p>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">{nearestFVG.bottom?.toFixed(2)}–{nearestFVG.top?.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SMC Right Panel ───────────────────────────────────────────────────────────
function SMCRightPanel({ smcData, signals, kpis, config }) {
  const [tab, setTab] = useState('signals')

  const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const VAL   = 'text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100'
  const SUB   = 'text-[10px] text-gray-500 dark:text-gray-400'

  if (!smcData) return (
    <div className="flex-1 flex items-center justify-center p-3">
      <p className="text-[10px] text-gray-400 text-center">No data</p>
    </div>
  )

  const lastSignal = signals?.[signals.length - 1]
  const recentSignals = signals?.slice(-5).reverse() || []

  const CONDITIONS = [
    { key: 'bos',      label: 'BOS' },
    { key: 'choch',    label: 'CHoCH' },
    { key: 'discount', label: 'Discount' },
    { key: 'ob',       label: 'OB' },
    { key: 'fvg',      label: 'FVG' },
    { key: 'sweep',    label: 'Sweep' },
  ]

  const bullOBs  = smcData.order_blocks.filter(o => o.type === 'bullish').slice(-5).reverse()
  const bullFVGs = smcData.fvg.filter(f => f.type === 'bullish' && !f.mitigated).slice(-5).reverse()

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-gray-950">

      {/* Inner tabs */}
      <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
        {[['signals', 'Signals'], ['zones', 'Zones']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${
              tab === id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 animate-scale-in'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 dark:divide-gray-800 animate-tab-in">

        {tab === 'signals' && (
          <>
            {/* Last Signal */}
            <div className="p-3">
              <p className={LABEL}>Last Signal</p>
              {lastSignal ? (
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-green-600 dark:text-green-400">▲ BUY</span>
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 px-1.5 py-0.5 rounded-full font-bold">{lastSignal.score}/6</span>
                  </div>
                  <p className={SUB}>{lastSignal.date}</p>
                  <p className="text-[10px] font-mono text-gray-600 dark:text-gray-400">Entry: {lastSignal.entryPrice?.toFixed(2)}</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1">
                    {CONDITIONS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-1">
                        <span className={`text-[9px] ${lastSignal.conditions[key] ? 'text-green-500' : 'text-gray-300 dark:text-gray-700'}`}>
                          {lastSignal.conditions[key] ? '✓' : '✗'}
                        </span>
                        <span className={`text-[9px] ${lastSignal.conditions[key] ? 'text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-700'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className={SUB + ' mt-1'}>No signals yet</p>}
            </div>

            {/* Signal History */}
            <div className="p-3">
              <p className={LABEL}>History</p>
              {recentSignals.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {recentSignals.map((sig, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <div>
                        <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">▲</span>
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 ml-1">{sig.date}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{sig.score}/6</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>No signals in period</p>}
            </div>

            {/* KPIs */}
            <div className="p-3">
              <p className={LABEL}>Performance</p>
              {kpis ? (
                <div className="mt-1.5 space-y-1.5">
                  {[
                    { label: 'Win Rate',       value: `${kpis.winRate.toFixed(1)}%` },
                    { label: 'Avg R:R',        value: kpis.avgRR.toFixed(2) },
                    { label: 'Profit Factor',  value: kpis.profitFactor.toFixed(2) },
                    { label: 'Avg Win',        value: `+${kpis.avgWinPct.toFixed(1)}%` },
                    { label: 'Max Con. Loss',  value: kpis.maxConsLosses },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className={SUB}>{label}</span>
                      <span className={VAL}>{value}</span>
                    </div>
                  ))}
                  <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-1">
                    {kpis.wins}W / {kpis.losses}L of {kpis.totalSignals} closed
                  </p>
                </div>
              ) : (
                <p className={SUB + ' mt-1'}>Not enough closed signals</p>
              )}
            </div>
          </>
        )}

        {tab === 'zones' && (
          <>
            {/* Bullish Order Blocks */}
            <div className="p-3">
              <p className={LABEL}>Order Blocks (Bull)</p>
              {bullOBs.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {bullOBs.map((ob, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-green-600 dark:text-green-400">{ob.low?.toFixed(2)}–{ob.high?.toFixed(2)}</span>
                      <span className={SUB}>{ob.date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>None detected</p>}
            </div>

            {/* Bullish FVGs */}
            <div className="p-3">
              <p className={LABEL}>Fair Value Gaps (Bull)</p>
              {bullFVGs.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {bullFVGs.map((f, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">{f.bottom?.toFixed(2)}–{f.top?.toFixed(2)}</span>
                      <span className={SUB}>{f.date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className={SUB + ' mt-1'}>None active</p>}
            </div>

            {/* Zone KPIs */}
            <div className="p-3">
              <p className={LABEL}>Zone Stats</p>
              <div className="mt-1.5 space-y-1.5">
                {(() => {
                  const bullOBCount  = smcData.order_blocks.filter(o => o.type === 'bullish').length
                  const bearOBCount  = smcData.order_blocks.filter(o => o.type === 'bearish').length
                  const activeFVGs   = smcData.fvg.filter(f => f.type === 'bullish').length
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className={SUB}>Active Bull OBs</span>
                        <span className={VAL}>{bullOBCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={SUB}>Active Bull FVGs</span>
                        <span className={VAL}>{activeFVGs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={SUB}>Buy Signals</span>
                        <span className={VAL}>{signals?.length ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={SUB}>Closed (W/L)</span>
                        <span className={VAL}>{kpis ? `${kpis.wins}/${kpis.losses}` : '—'}</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Computations ──────────────────────────────────────────────────────────────

function computeSignals(smcData, config, chartData) {
  if (!smcData || !chartData?.length) return []
  const { bos, choch, order_blocks, fvg, sweeps } = smcData
  const signals = []

  // Fixed range for discount zone — full scan period, not rolling
  const rangeHigh = Math.max(...chartData.map(d => d.high))
  const rangeLow  = Math.min(...chartData.map(d => d.low))

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
    const recentBullBOS = bos.some(b =>
      b.type === 'bullish' && b.date > windowStart && b.date <= candle.time
    )
    cond.bos = recentBullBOS
    if (config.useBOS && recentBullBOS) score++

    // 2. Last CHoCH within CHOCH_WINDOW candles was bullish
    const chochWindow = chartData[Math.max(0, i - CHOCH_WINDOW)]?.time ?? ''
    const prevChoch = [...choch]
      .filter(c => c.date > chochWindow && c.date <= candle.time)
      .pop()
    cond.choch = prevChoch?.type === 'bullish'
    if (config.useCHoCH && cond.choch) score++

    // 3. Price in discount zone (fixed range for entire period)
    const posPct = rangeHigh === rangeLow ? 50
      : (candle.close - rangeLow) / (rangeHigh - rangeLow) * 100
    cond.discount = posPct <= config.discountPct
    if (config.useDiscount && cond.discount) score++

    // 4. Price touching a bullish OB (candle low ≤ ob.high AND candle close ≥ ob.low)
    const inOB = order_blocks.some(ob =>
      ob.type === 'bullish' && ob.date < candle.time &&
      candle.low <= parseFloat(ob.high) && candle.close >= parseFloat(ob.low)
    )
    cond.ob = inOB
    if (config.useOB && inOB) score++

    // 5. Price near/touching bullish FVG (within fvgMaxDistPct % above bottom)
    const nearFVG = fvg.some(f =>
      f.type === 'bullish' && f.date < candle.time &&
      candle.low <= parseFloat(f.top) * (1 + config.fvgMaxDistPct / 100) &&
      candle.close >= parseFloat(f.bottom)
    )
    cond.fvg = nearFVG
    if (config.useFVG && nearFVG) score++

    // 6. Buy-side sweep within last 15 candles
    const sweepWindow = chartData[Math.max(0, i - 15)]?.time ?? ''
    const recentSweep = sweeps.some(s =>
      s.type === 'buy_side' && s.date > sweepWindow && s.date <= candle.time
    )
    cond.sweep = recentSweep
    if (config.useSweep && recentSweep) score++

    if (score >= config.minScore) {
      // Suppress consecutive signals on same zone — require 3-candle gap
      const prev = signals[signals.length - 1]
      if (prev) {
        const prevIdx = chartData.findIndex(d => d.time === prev.date)
        if (i - prevIdx < 3) return
      }
      signals.push({ date: candle.time, score, conditions: cond, entryPrice: candle.close })
    }
  })

  return signals
}

function computeKPIs(signals, smcData, chartData) {
  if (!signals?.length || !chartData?.length || !smcData) return null
  const results = []

  signals.forEach(sig => {
    const entryIdx = chartData.findIndex(d => d.time === sig.date)
    if (entryIdx < 0 || entryIdx >= chartData.length - 3) return

    // SL: below the triggering bullish OB zone bottom, or 2% below entry
    const nearOB = smcData.order_blocks
      .filter(o => o.type === 'bullish' && o.date <= sig.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    const sl = nearOB
      ? parseFloat(nearOB.low) * 0.998   // 0.2% below OB bottom as buffer
      : sig.entryPrice * 0.98

    // TP: next bullish BOS level above entry price (the next structural high to break)
    const nextBOS = smcData.bos
      .filter(b => b.type === 'bullish' && b.date > sig.date && parseFloat(b.level) > sig.entryPrice)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    const tp = nextBOS
      ? parseFloat(nextBOS.level)
      : sig.entryPrice + 2 * (sig.entryPrice - sl)  // fallback: 2R target

    // Validate SL/TP make sense
    if (tp <= sig.entryPrice || sl >= sig.entryPrice || (sig.entryPrice - sl) < 0.1) return

    const riskPts   = sig.entryPrice - sl
    const rewardPts = tp - sig.entryPrice
    const rr        = rewardPts / riskPts

    // Walk forward: whichever hits first — SL or TP
    let outcome = null
    for (let j = entryIdx + 1; j < chartData.length; j++) {
      const c = chartData[j]
      if (c.low  <= sl) { outcome = 'loss'; break }
      if (c.high >= tp) { outcome = 'win';  break }
    }
    if (!outcome) return // still open — exclude from closed stats

    const pctGain = outcome === 'win' ? rewardPts / sig.entryPrice * 100 : -(riskPts / sig.entryPrice * 100)
    results.push({ outcome, rr, pctGain })
  })

  if (!results.length) return null

  const wins   = results.filter(r => r.outcome === 'win')
  const losses = results.filter(r => r.outcome === 'loss')

  // Profit factor = gross profit / gross loss (in R units)
  const grossProfit = wins.reduce((s, r) => s + r.rr, 0)
  const grossLoss   = losses.length  // each loss = 1R

  let maxConsLoss = 0, cur = 0
  results.forEach(r => {
    if (r.outcome === 'loss') { cur++; maxConsLoss = Math.max(maxConsLoss, cur) }
    else cur = 0
  })

  return {
    winRate:       Math.round(wins.length / results.length * 100),
    avgRR:         wins.length ? +(grossProfit / wins.length).toFixed(2) : 0,
    profitFactor:  grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 99 : 0,
    avgWinPct:     wins.length ? +(wins.reduce((s, r) => s + r.pctGain, 0) / wins.length).toFixed(2) : 0,
    maxConsLosses: maxConsLoss,
    totalSignals:  results.length,
    wins:          wins.length,
    losses:        losses.length,
  }
}

function computeBiasScore(smcData, currentPrice) {
  if (!smcData) return { score: 0, label: 'NO DATA', color: '#9ca3af', posPct: 50, posLabel: 'EQUILIBRIUM' }

  let score = 0
  const { bos, choch, order_blocks, sweeps, fvg } = smcData

  // BOS ratio — recent structure more important than historical
  const recentBOS  = bos.slice(-20)  // last 20 BOS events
  const bullBOS    = recentBOS.filter(b => b.type === 'bullish').length
  const totalBOS   = recentBOS.length
  if (totalBOS > 0) score += (bullBOS / totalBOS) * 35

  // Last CHoCH direction — high weight, rare signal
  const lastChoch = choch[choch.length - 1]
  if (lastChoch?.type === 'bullish') score += 20

  // Price vs OB/FVG zones — is current price near a bullish zone?
  const bullOBs  = order_blocks.filter(o => o.type === 'bullish')
  const nearBullZone = bullOBs.some(o =>
    currentPrice >= parseFloat(o.low) * 0.97 &&
    currentPrice <= parseFloat(o.high) * 1.03
  ) || fvg.some(f =>
    f.type === 'bullish' &&
    currentPrice >= parseFloat(f.bottom) * 0.97 &&
    currentPrice <= parseFloat(f.top) * 1.03
  )
  if (nearBullZone) score += 25

  // OB ratio — more bullish OBs detected = more bullish bias
  const totalOB = order_blocks.length
  const bullOBcount = bullOBs.length
  if (totalOB > 0) score += (bullOBcount / totalOB) * 10

  // Recent buy-side sweep — last 20 candles (sharp reversal signal)
  if (sweeps.slice(-5).some(s => s.type === 'buy_side')) score += 10

  // Compute price position using all detected swing levels as range proxy
  const allLevels = [
    ...bos.map(b => parseFloat(b.level)),
    ...order_blocks.map(o => parseFloat(o.high)),
    ...order_blocks.map(o => parseFloat(o.low)),
  ].filter(Boolean)

  let posPct = 50
  if (allLevels.length >= 2) {
    const high = Math.max(...allLevels)
    const low  = Math.min(...allLevels)
    posPct = high === low ? 50 : Math.round((currentPrice - low) / (high - low) * 100)
  }

  const s = Math.min(100, Math.round(score))
  return {
    score:    s,
    label:    s >= 70 ? 'STRONG BULL' : s >= 50 ? 'MILD BULL' : s >= 35 ? 'RANGING' : 'BEARISH',
    color:    s >= 70 ? '#22c55e' : s >= 50 ? '#86efac' : s >= 35 ? '#f59e0b' : '#ef4444',
    posPct,
    posLabel: posPct <= 35 ? 'DISCOUNT' : posPct >= 65 ? 'PREMIUM' : 'EQUILIBRIUM',
  }
}

// ── SMC Inner — reads ScreenContext ──────────────────────────────────────────
function SMCInner() {
  const { selectedSymbol, timeframe, isIndex, latestClose } = useScreen() || {}
  const [leftOpen,  setLeftOpen]  = useState(() => localStorage.getItem('tradeo_smc_leftOpen')  !== 'false')
  const [rightOpen, setRightOpen] = useState(() => localStorage.getItem('tradeo_smc_rightOpen') !== 'false')
  const toggleLeft  = () => setLeftOpen(v  => { localStorage.setItem('tradeo_smc_leftOpen',  String(!v)); return !v })
  const toggleRight = () => setRightOpen(v => { localStorage.setItem('tradeo_smc_rightOpen', String(!v)); return !v })

  const [smcData,    setSmcData]   = useState(null)
  const [loading,    setLoading]   = useState(false)
  const [chartData,  setChartData] = useState([])  // state (not ref) so useMemo reacts
  const [toggles,    setToggles]   = useState(DEFAULT_TOGGLES)
  const [config,     setConfig]    = useState(() => loadConfig())
  const [symbols, setSymbols] = useState(null)
  const chartDataRef = useRef([])  // also kept as ref for non-reactive reads

  useEffect(() => {
    getMarketSymbols()
      .then(r => { if (r.data?.stocks?.length) setSymbols(r.data) })
      .catch(() => {})
  }, [])

  const isStock = !isIndex?.()

  // Derive scan days from current chart timeframe — no separate selector needed
  const days = TIMEFRAME_DAYS[timeframe] ?? 280

  // Fetch SMC data when symbol or timeframe changes
  const fetchSMC = useCallback(async (sym, d) => {
    if (!sym || !isStock) return
    setLoading(true)
    try {
      const res = await getSMCScan({ symbol: sym, days: d })
      setSmcData(res.data)
    } catch {
      setSmcData(null)
    } finally {
      setLoading(false)
    }
  }, [isStock])

  useEffect(() => {
    if (selectedSymbol && isStock) fetchSMC(selectedSymbol, days)
    else setSmcData(null)
  }, [selectedSymbol, days, fetchSMC, isStock])

  const currentPrice = latestClose ?? 0

  // chartData state ensures useMemo re-runs when chart loads
  const signals   = useMemo(() => computeSignals(smcData, config, chartData),   [smcData, config, chartData])
  const kpis      = useMemo(() => computeKPIs(signals, smcData, chartData),     [signals, smcData, chartData])
  const biasScore = useMemo(() => computeBiasScore(smcData, currentPrice),       [smcData, currentPrice])

  const smcOverlayData = useMemo(() => ({
    smcData:    isStock ? smcData : null,
    smcToggles: toggles,
    smcSignals: isStock ? signals : [],
  }), [smcData, toggles, signals, isStock])

  const handleChartDataReady = useCallback((data) => {
    chartDataRef.current = data
    setChartData(data)
  }, [])

  return (
    <>
      {/* Toolbar injected into Screen tab bar */}
      <SMCToolbar
        toggles={toggles} setToggles={setToggles}
        config={config} setConfig={setConfig}
        symbols={symbols}
      />

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden min-h-0 animate-fade-up">

        {/* Left panel — collapsible glass */}
        <div className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative
                        bg-white/50 dark:bg-gray-950/60 backdrop-blur-2xl
                        shadow-[1px_0_0_rgba(255,255,255,0.18),2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[1px_0_0_rgba(255,255,255,0.07),2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-200 ease-in-out
                        ${leftOpen ? 'w-[13%] min-w-[150px] max-w-[200px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'} ${!leftOpen ? 'screen-panel-collapsed' : ''}`}>
          <div className="screen-panel-content flex flex-col h-full">
            <SMCLeftPanel smcData={isStock ? smcData : null} biasScore={biasScore} chartData={chartData} currentPrice={currentPrice} />
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
            <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${leftOpen ? '' : 'rotate-180'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round">
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
            <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${rightOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round">
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
          <StockChart
            hideToolbar
            {...smcOverlayData}
            onChartDataReady={handleChartDataReady}
          />
        </div>

        {/* Right panel — collapsible glass */}
        <div className={`hidden lg:flex flex-col shrink-0 overflow-y-auto relative
                        bg-white/50 dark:bg-gray-950/60 backdrop-blur-2xl
                        shadow-[-1px_0_0_rgba(255,255,255,0.18),-2px_0_12px_rgba(0,0,0,0.06)]
                        dark:shadow-[-1px_0_0_rgba(255,255,255,0.07),-2px_0_16px_rgba(0,0,0,0.4)]
                        transition-all duration-200 ease-in-out
                        ${rightOpen ? 'w-[15%] min-w-[160px] max-w-[240px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'} ${!rightOpen ? 'screen-panel-collapsed' : ''}`}>
          <div className="screen-panel-content flex flex-col h-full">
            <SMCRightPanel smcData={isStock ? smcData : null} signals={signals} kpis={kpis} config={config} />
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
    <ScreenProvider disablePositions initialSymbol="NABIL" initialIndexId={null} initialIsIndex={false}>
      <SMCInner />
    </ScreenProvider>
  )
}
