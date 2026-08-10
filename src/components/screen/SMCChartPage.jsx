// === SMCChartPage.jsx — SMC chart tab: StockChart + SMC overlays (BOS/CHoCH/OB/FVG/Sweeps/Entry), left/right panels, toolbar ===
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
import AnalysisMobilePanels from './AnalysisMobilePanels'
import { ProfessionalSMCLeftPanel, ProfessionalSMCRightPanel } from './ProfessionalAnalysisPanels'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import StockChart from './StockChart'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'
import { getSMCScan, getSMCV2Shadow } from '../../api'
import { getMarketSymbols } from '../../utils/globalCache'
import SymbolSearch from '../common/SymbolSearch'
import {
  ToolbarDivider,
  ToolbarTimeframes,
  ToolbarToggleChip,
  ToolbarConfigButton,
  ToolbarConfigTitle,
  ToolbarConfigSection,
  ToolbarMenu,
  ToolbarMenuSection,
  useCompactToolbar,
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

// ── SMC overlay toggle definitions ──────────────────────────────────────────────
const SMC_TOGGLES = [
  { key: 'showBOS', label: 'BOS', color: '#22c55e' },
  { key: 'showCHoCH', label: 'CHoCH', color: '#f59e0b' },
  { key: 'showOB', label: 'OB', color: '#22c55e' },
  { key: 'showFVG', label: 'FVG', color: '#3b82f6' },
  { key: 'showSweeps', label: 'Sweeps', color: '#a78bfa' },
  { key: 'showEntry', label: 'Entry', color: '#10b981' },
]

// ── SMC Toolbar ───────────────────────────────────────────────────────────────
function SMCToolbar({ toggles, setToggles, config, setConfig, symbols }) {
  const compact = useCompactToolbar()
  const { selectSymbol, selectedSymbol } = useScreen() || {}
  const toggle = (key) => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  const updateConfig = (key, val) => {
    const next = { ...config, [key]: val }
    setConfig(next)
    saveConfig(next)
  }

  // Overlay toggle chips — same control in both inline and menu layouts.
  const toggleChips = SMC_TOGGLES.map((t) => (
    <ToolbarToggleChip
      key={t.key}
      label={t.label}
      active={toggles[t.key]}
      onClick={() => toggle(t.key)}
      activeColor={t.color}
    />
  ))

  // Config sections — shared between the desktop Config popover and the mobile menu.
  const configBody = (
    <>
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
    </>
  )

  // Count active overlay toggles for the menu badge (mobile).
  const activeCount = SMC_TOGGLES.filter((t) => toggles[t.key]).length

  return useScreenToolbarSlot(
    compact ? (
      // Mobile: search + a single menu holding timeframe, overlay toggles, config.
      <div className="flex items-center gap-1.5 min-w-0">
        <SymbolSearch
          symbols={symbols}
          stocksOnly
          value={selectedSymbol}
          onSelect={(symbol, indexId, companyName) =>
            selectSymbol(symbol, indexId, null, companyName)
          }
        />
        <div className="flex-1 min-w-0" />
        <ToolbarMenu activeCount={activeCount}>
          <ToolbarMenuSection label="Timeframe" divider={false}>
            <ToolbarTimeframes frames={SMC_TIMEFRAMES} />
          </ToolbarMenuSection>
          <ToolbarMenuSection label="Overlays">
            <div className="flex flex-wrap gap-1">{toggleChips}</div>
          </ToolbarMenuSection>
          <ToolbarMenuSection label="Signal config">{configBody}</ToolbarMenuSection>
        </ToolbarMenu>
      </div>
    ) : (
      // Desktop: full inline toolbar.
      <div className="flex items-center gap-1.5 min-w-0">
        <SymbolSearch
          symbols={symbols}
          stocksOnly
          value={selectedSymbol}
          onSelect={(symbol, indexId, companyName) =>
            selectSymbol(symbol, indexId, null, companyName)
          }
        />
        <ToolbarDivider />
        <ToolbarTimeframes frames={SMC_TIMEFRAMES} />
        <ToolbarDivider />
        {toggleChips}
        <ToolbarDivider />
        <ToolbarConfigButton>{configBody}</ToolbarConfigButton>
      </div>
    )
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
  const [leftOpen, setLeftOpen] = useLocalStorage('tradeo_smc_leftOpen', true)
  const [rightOpen, setRightOpen] = useLocalStorage('tradeo_smc_rightOpen', true)
  const toggleLeft = () => setLeftOpen((v) => !v)
  const toggleRight = () => setRightOpen((v) => !v)

  const [smcData, setSmcData] = useState(null)
  const [shadowData, setShadowData] = useState(null)
  const [shadowLoading, setShadowLoading] = useState(false)
  const [shadowError, setShadowError] = useState('')
  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState([]) // state (not ref) so useMemo reacts
  const [toggles, setToggles] = useState(DEFAULT_TOGGLES)
  const [config, setConfig] = useState(() => loadConfig())
  const [symbols, setSymbols] = useState(null)
  const [scanError, setScanError] = useState('')
  const [symbolError, setSymbolError] = useState('')
  const [mobilePanel, setMobilePanel] = useState(null)

  useEffect(() => {
    getMarketSymbols()
      .then((r) => {
        if (r.data?.stocks?.length) setSymbols(r.data)
      })
      .catch(() => setSymbolError('Symbol search is temporarily unavailable.'))
  }, [])

  const isStock = !isIndex?.()

  // Derive scan days from current chart timeframe — no separate selector needed
  const days = TIMEFRAME_DAYS[timeframe] ?? 280

  // Fetch SMC data when symbol or timeframe changes — cancelled flag prevents a slow
  // earlier response from overwriting a newer one on rapid symbol/timeframe switches
  useEffect(() => {
    if (!selectedSymbol || !isStock) {
      setSmcData(null)
      setScanError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setScanError('')
    getSMCScan({ symbol: selectedSymbol, days })
      .then((res) => {
        if (!cancelled) setSmcData(res.data)
      })
      .catch((err) => {
        if (!cancelled) {
          setSmcData(null)
          setScanError(err.response?.data?.error || 'SMC scan failed. Please retry.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSymbol, days, isStock])

  // V2 remains an independent shadow read. Its failure must never remove V1 data or chart overlays.
  useEffect(() => {
    if (!selectedSymbol || !isStock) {
      setShadowData(null)
      setShadowError('')
      setShadowLoading(false)
      return
    }
    let cancelled = false
    setShadowLoading(true)
    setShadowError('')
    getSMCV2Shadow({ symbol: selectedSymbol, days })
      .then((res) => {
        if (!cancelled) setShadowData(res.data)
      })
      .catch(() => {
        if (!cancelled) {
          setShadowData(null)
          setShadowError('V2 shadow evidence is temporarily unavailable.')
        }
      })
      .finally(() => {
        if (!cancelled) setShadowLoading(false)
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
                        ${leftOpen ? 'w-[16%] min-w-[190px] max-w-[240px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'} ${!leftOpen ? 'screen-panel-collapsed' : ''}`}
        >
          <div className="screen-panel-content flex flex-col h-full">
            {/* scanData (not full chartData) — zone position must use the same range as signal scoring */}
            <ProfessionalSMCLeftPanel
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
            aria-label={leftOpen ? 'Hide left panel' : 'Show left panel'}
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
            aria-label={rightOpen ? 'Hide right panel' : 'Show right panel'}
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
          {(scanError || symbolError) && (
            <div className="absolute top-2 left-3 z-30 text-[10px] text-red-600 bg-red-50 dark:bg-red-950/80 px-2 py-1 rounded border border-red-200 dark:border-red-800">
              {scanError || symbolError}
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
                        ${rightOpen ? 'w-[18%] min-w-[220px] max-w-[300px]' : 'w-0 min-w-0 max-w-0 overflow-hidden'} ${!rightOpen ? 'screen-panel-collapsed' : ''}`}
        >
          <div className="screen-panel-content flex flex-col h-full">
            <ProfessionalSMCRightPanel
              smcData={isStock ? smcData : null}
              signals={signals}
              config={config}
              chartData={scanData}
              currentPrice={currentPrice}
              shadowData={shadowData}
              shadowLoading={shadowLoading}
              shadowError={shadowError}
            />
          </div>
        </div>
      </div>
      <AnalysisMobilePanels
        panel={mobilePanel}
        setPanel={setMobilePanel}
        left={
          <ProfessionalSMCLeftPanel
            smcData={isStock ? smcData : null}
            chartData={scanData}
            currentPrice={currentPrice}
          />
        }
        right={
          <ProfessionalSMCRightPanel
            smcData={isStock ? smcData : null}
            signals={signals}
            config={config}
            chartData={scanData}
            currentPrice={currentPrice}
            shadowData={shadowData}
            shadowLoading={shadowLoading}
            shadowError={shadowError}
          />
        }
      />
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
