// === PriceActionPage.jsx — Price Action chart tab: swings (HH/HL/LH/LL), S/R, demand/supply zones, volume spikes, patterns ===
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
import AnalysisMobilePanels from './AnalysisMobilePanels'
import { ProfessionalPALeftPanel, ProfessionalPARightPanel } from './ProfessionalAnalysisPanels'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import StockChart from './StockChart'
import { useScreenToolbarSlot } from '../../pages/ScreenPage'
import { getPriceActionScan } from '../../api'
import { getMarketSymbols } from '../../utils/globalCache'
import SymbolSearch from '../common/SymbolSearch'
import {
  ToolbarDivider,
  ToolbarTimeframes,
  ToolbarToggleChip,
  ToolbarConfigButton,
  ToolbarConfigTitle,
  ToolbarConfigSection,
  ToolbarSegment,
  ToolbarMenu,
  ToolbarMenuSection,
  useCompactToolbar,
} from './ScreenToolbarAtoms'

// ── Constants ─────────────────────────────────────────────────────────────────
// All three params are sent to the backend scan (cluster_pct / ds_move_pct /
// vol_multiplier query params) — changing them re-runs the scan.
const DEFAULT_CONFIG = {
  clusterPct: 1.5, // S/R clustering tolerance %
  dsMovePct: 3, // D/S min directional move %
  volMultiplier: 2.0, // volume spike threshold vs 20-bar avg
}

const DEFAULT_TOGGLES = {
  showSwings: true,
  showTrend: true,
  showSR: true,
  showZones: true,
  showVolume: false,
  showPatterns: false,
}

// Timeframe → days mapping (same as SMC — timeframe drives scan period)
const TIMEFRAME_DAYS = { '6M': 180, '1Y': 280, '3Y': 750, ALL: 750 }

// ── Config persistence ────────────────────────────────────────────────────────
function loadConfig() {
  try {
    const s = localStorage.getItem('pa_config')
    if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }
  } catch {}
  return DEFAULT_CONFIG
}
function saveConfig(cfg) {
  try {
    localStorage.setItem('pa_config', JSON.stringify(cfg))
  } catch {}
}

const PA_TIMEFRAMES = ['6M', '1Y', '3Y', 'ALL']

// ── PA overlay toggle definitions ─────────────────────────────────────────────
const PA_TOGGLES = [
  { key: 'showSwings', label: 'Swings', color: '#3b82f6' },
  { key: 'showTrend', label: 'Trend', color: '#22c55e' },
  { key: 'showSR', label: 'S/R', color: '#f97316' },
  { key: 'showZones', label: 'D/S Zones', color: '#8b5cf6' },
  { key: 'showVolume', label: 'Volume', color: '#a855f7' },
  { key: 'showPatterns', label: 'Patterns', color: '#f59e0b' },
]

// ── PA Toolbar ────────────────────────────────────────────────────────────────
function PAToolbar({ toggles, setToggles, config, setConfig, symbols }) {
  const compact = useCompactToolbar()
  const { selectSymbol, selectedSymbol } = useScreen() || {}
  const toggle = (key) => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  const updateConfig = (key, val) => {
    const next = { ...config, [key]: val }
    setConfig(next)
    saveConfig(next)
  }

  // Overlay toggle chips — same control in both inline and menu layouts.
  const toggleChips = PA_TOGGLES.map((t) => (
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
      <ToolbarConfigTitle>Price Action Config</ToolbarConfigTitle>

      <ToolbarConfigSection label="S/R cluster tolerance">
        <ToolbarSegment
          options={[1.0, 1.5, 2.0, 2.5].map((v) => ({ v, label: `${v}%` }))}
          value={config.clusterPct}
          onChange={(v) => updateConfig('clusterPct', v)}
          activeColor="bg-orange-500"
        />
      </ToolbarConfigSection>

      <ToolbarConfigSection label="D/S min move">
        <ToolbarSegment
          options={[2, 3, 5].map((v) => ({ v, label: `${v}%` }))}
          value={config.dsMovePct}
          onChange={(v) => updateConfig('dsMovePct', v)}
          activeColor="bg-purple-500"
        />
      </ToolbarConfigSection>

      <ToolbarConfigSection label="Volume spike threshold">
        <ToolbarSegment
          options={[1.5, 2.0, 2.5, 3.0].map((v) => ({ v, label: `${v}×` }))}
          value={config.volMultiplier}
          onChange={(v) => updateConfig('volMultiplier', v)}
          activeColor="bg-purple-600"
        />
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
  const activeCount = PA_TOGGLES.filter((t) => toggles[t.key]).length

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
            <ToolbarTimeframes frames={PA_TIMEFRAMES} />
          </ToolbarMenuSection>
          <ToolbarMenuSection label="Overlays">
            <div className="flex flex-wrap gap-1">{toggleChips}</div>
          </ToolbarMenuSection>
          <ToolbarMenuSection label="Config">{configBody}</ToolbarMenuSection>
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
        <ToolbarTimeframes frames={PA_TIMEFRAMES} />
        <ToolbarDivider />
        {toggleChips}
        <ToolbarDivider />
        <ToolbarConfigButton>{configBody}</ToolbarConfigButton>
      </div>
    )
  )
}

// ── Computations ──────────────────────────────────────────────────────────────

function computePAKPIs(paData, chartData) {
  if (!paData || !chartData?.length) return null

  const { patterns, volume_spikes, support_resistance, swings } = paData

  // Win rate: bullish patterns followed by ≥3% gain within 10 candles
  const WIN_THRESHOLD = 3 // %
  const LOSS_THRESHOLD = 2 // %
  const FORWARD_WINDOW = 10 // candles

  const bullPatterns = (patterns || []).filter((p) => p.direction === 'bull')
  let wins = 0,
    losses = 0,
    total = 0

  for (const pt of bullPatterns) {
    const idx = chartData.findIndex((d) => d.time === pt.date)
    if (idx < 0 || idx >= chartData.length - FORWARD_WINDOW) continue
    total++
    const entry = chartData[idx].close
    let outcome = null
    for (let j = idx + 1; j <= idx + FORWARD_WINDOW; j++) {
      const c = chartData[j]
      if (((c.high - entry) / entry) * 100 >= WIN_THRESHOLD) {
        outcome = 'win'
        break
      }
      if (((entry - c.low) / entry) * 100 >= LOSS_THRESHOLD) {
        outcome = 'loss'
        break
      }
    }
    if (outcome === 'win') wins++
    if (outcome === 'loss') losses++
  }

  // Trend streak: longest current run of same-direction swings
  const recentSwings = (swings || []).slice(-10)
  let streak = 0
  if (recentSwings.length >= 2) {
    const lastType = recentSwings[recentSwings.length - 1]?.type
    const isUp = lastType === 'HH' || lastType === 'HL'
    for (let i = recentSwings.length - 1; i >= 0; i--) {
      const t = recentSwings[i].type
      const matchesUp = t === 'HH' || t === 'HL'
      if ((isUp && matchesUp) || (!isUp && !matchesUp)) streak++
      else break
    }
  }

  // Volume spike frequency per 30 candles
  const spikeFreq =
    chartData.length > 0 ? ((volume_spikes?.length ?? 0) / chartData.length) * 30 : 0

  // Avg touches
  const avgTouches = support_resistance?.length
    ? support_resistance.reduce((s, z) => s + z.touches, 0) / support_resistance.length
    : 0

  // Win rate over RESOLVED outcomes only — patterns that hit neither the win nor
  // loss threshold within the window are pending, not losses
  const resolved = wins + losses

  return {
    winRate: resolved > 0 ? Math.round((wins / resolved) * 100) : 0,
    trendStreak: `${streak} streak`,
    spikeFreq,
    avgTouches,
    wins,
    losses,
    pending: total - resolved,
    totalSignals: resolved,
  }
}

// ── PA Inner ──────────────────────────────────────────────────────────────────
function PAInner() {
  const { selectedSymbol, timeframe, isIndex } = useScreen() || {}
  const [leftOpen, setLeftOpen] = useLocalStorage('tradeo_pa_leftOpen', true)
  const [rightOpen, setRightOpen] = useLocalStorage('tradeo_pa_rightOpen', true)
  const toggleLeft = () => setLeftOpen((v) => !v)
  const toggleRight = () => setRightOpen((v) => !v)

  const [paData, setPaData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState([])
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
  const days = TIMEFRAME_DAYS[timeframe] ?? 280

  // Fetch PA scan when symbol, timeframe, or config changes. Config params are sent
  // to the backend (they were previously saved but never used — dead knobs).
  // cancelled flag prevents a slow earlier response from overwriting a newer one.
  useEffect(() => {
    if (!selectedSymbol || !isStock) {
      setPaData(null)
      setScanError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setScanError('')
    getPriceActionScan({
      symbol: selectedSymbol,
      days,
      cluster_pct: config.clusterPct,
      ds_move_pct: config.dsMovePct,
      vol_multiplier: config.volMultiplier,
    })
      .then((res) => {
        if (!cancelled) setPaData(res.data)
      })
      .catch((err) => {
        if (!cancelled) {
          setPaData(null)
          setScanError(err.response?.data?.error || 'Price Action scan failed. Please retry.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSymbol, days, isStock, config])

  const currentPrice = chartData?.[chartData.length - 1]?.close ?? 0

  // KPIs must run over the same window the backend scanned (paData.candles rows),
  // not the full chart history — see SMC tab for the same fix
  const scanData = useMemo(
    () => (paData?.candles ? chartData.slice(-paData.candles) : chartData),
    [chartData, paData]
  )

  const kpis = useMemo(() => computePAKPIs(paData, scanData), [paData, scanData])

  const paOverlayData = useMemo(
    () => ({
      paData: isStock ? paData : null,
      paToggles: toggles,
    }),
    [paData, toggles, isStock]
  )

  const handleChartDataReady = useCallback((data) => {
    setChartData(data)
  }, [])

  return (
    <>
      <PAToolbar
        toggles={toggles}
        setToggles={setToggles}
        config={config}
        setConfig={setConfig}
        symbols={symbols}
      />

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
            <ProfessionalPALeftPanel
              paData={isStock ? paData : null}
              chartData={chartData}
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
          <StockChart hideToolbar {...paOverlayData} onChartDataReady={handleChartDataReady} />
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
            <ProfessionalPARightPanel
              paData={isStock ? paData : null}
              kpis={kpis}
              chartData={chartData}
              currentPrice={currentPrice}
            />
          </div>
        </div>
      </div>
      <AnalysisMobilePanels
        panel={mobilePanel}
        setPanel={setMobilePanel}
        left={
          <ProfessionalPALeftPanel
            paData={isStock ? paData : null}
            chartData={chartData}
            currentPrice={currentPrice}
          />
        }
        right={
          <ProfessionalPARightPanel
            paData={isStock ? paData : null}
            kpis={kpis}
            chartData={chartData}
            currentPrice={currentPrice}
          />
        }
      />
    </>
  )
}

// ── PriceActionPage — exported default ───────────────────────────────────────
// Default to NABIL so data loads immediately on open (same as SMC tab).
export default function PriceActionPage() {
  return (
    <ScreenProvider
      disablePositions
      initialSymbol="NABIL"
      initialIndexId={null}
      initialIsIndex={false}
    >
      <PAInner />
    </ScreenProvider>
  )
}
