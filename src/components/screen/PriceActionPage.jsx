// === PriceActionPage.jsx — Price Action chart tab: swings (HH/HL/LH/LL), S/R, demand/supply zones, volume spikes, patterns ===
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ScreenProvider, useScreen } from '../../context/ScreenContext'
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
  const { selectSymbol } = useScreen() || {}
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
          onSelect={(symbol, indexId, companyName) => selectSymbol(symbol, indexId, null, companyName)}
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
          onSelect={(symbol, indexId, companyName) => selectSymbol(symbol, indexId, null, companyName)}
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

// ── Left Panel ────────────────────────────────────────────────────────────────
function PALeftPanel({ paData, currentPrice }) {
  const LABEL =
    'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const SUB = 'text-[10px] text-gray-500 dark:text-gray-400'
  const VAL = 'text-[11px] font-semibold text-gray-800 dark:text-gray-100'

  if (!paData)
    return (
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
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold flex items-center justify-center">
                {step}
              </span>
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
  const trendColor =
    structure?.trend === 'uptrend'
      ? '#22c55e'
      : structure?.trend === 'downtrend'
        ? '#ef4444'
        : '#f59e0b'
  const trendLabel =
    structure?.trend === 'uptrend'
      ? '▲ Uptrend'
      : structure?.trend === 'downtrend'
        ? '▼ Downtrend'
        : '→ Sideways'

  // Nearest S/R around current price
  const nearestRes = support_resistance
    .filter((z) => z.type === 'resistance' && z.price > currentPrice)
    .sort((a, b) => a.price - b.price)[0]
  const nearestSup = support_resistance
    .filter((z) => z.type === 'support' && z.price < currentPrice)
    .sort((a, b) => b.price - a.price)[0]

  // Nearest demand zone
  const nearestDemand = [...(demand_supply || [])]
    .filter((z) => z.type === 'demand')
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
        <span className="text-[13px] font-bold" style={{ color: trendColor }}>
          {trendLabel}
        </span>
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
              <span className="text-[11px] font-mono font-semibold text-red-500">
                {nearestRes.price.toFixed(2)}
              </span>
              <span className={SUB + ' ml-1'}>
                +{(((nearestRes.price - currentPrice) / currentPrice) * 100).toFixed(1)}%
              </span>
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
              <span className="text-[11px] font-mono font-semibold text-green-600 dark:text-green-400">
                {nearestSup.price.toFixed(2)}
              </span>
              <span className={SUB + ' ml-1'}>
                {(((nearestSup.price - currentPrice) / currentPrice) * 100).toFixed(1)}%
              </span>
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
              {(((nearestDemand.top - currentPrice) / currentPrice) * 100).toFixed(1)}% away
            </p>
          )}
        </div>
      )}

      {/* Section 4 — Recent Swings */}
      <div className="p-3 space-y-1">
        <p className={LABEL}>Recent Swings</p>
        <div className="space-y-1">
          {recentSwings.length ? (
            recentSwings.slice(0, 6).map((sw, i) => (
              <div key={i} className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold ${
                    sw.type === 'HH'
                      ? 'text-blue-500'
                      : sw.type === 'HL'
                        ? 'text-blue-400'
                        : sw.type === 'LH'
                          ? 'text-gray-400'
                          : 'text-red-400'
                  }`}
                >
                  {sw.type}
                </span>
                <span className="text-[10px] font-mono text-gray-700 dark:text-gray-300">
                  {sw.price.toFixed(2)}
                </span>
                <span className={SUB + ' text-[9px]'}>{sw.date?.slice(5)}</span>
              </div>
            ))
          ) : (
            <p className={SUB}>No swings detected</p>
          )}
        </div>
      </div>

      {/* Section 5 — Volume */}
      {lastSpike && (
        <div className="p-3 space-y-1">
          <p className={LABEL}>Volume</p>
          <p className={SUB}>Last spike</p>
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-semibold ${lastSpike.type === 'bull' ? 'text-green-500' : 'text-red-500'}`}
            >
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

  const LABEL =
    'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'
  const VAL = 'text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100'
  const SUB = 'text-[10px] text-gray-500 dark:text-gray-400'

  if (!paData)
    return (
      <div className="flex-1 flex items-center justify-center p-3">
        <p className="text-[10px] text-gray-400 text-center">No data yet</p>
      </div>
    )

  const { patterns, volume_spikes, support_resistance, demand_supply } = paData

  const recentPatterns = [...(patterns || [])].slice(-8).reverse()
  const recentSpikes = [...(volume_spikes || [])].slice(-5).reverse()

  const PATTERN_LABELS = {
    bullish_engulfing: 'Bullish Engulfing',
    bearish_engulfing: 'Bearish Engulfing',
    hammer: 'Hammer',
    shooting_star: 'Shooting Star',
    bullish_pin: 'Bullish Pin Bar',
    bearish_pin: 'Bearish Pin Bar',
    inside_bar: 'Inside Bar',
    doji: 'Doji',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-gray-950">
      {/* Inner tab bar */}
      <div className="shrink-0 flex border-b border-gray-100 dark:border-gray-800">
        {[
          ['signals', 'Signals'],
          ['levels', 'Levels'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${
              tab === id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 animate-scale-in'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        key={tab}
        className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 dark:divide-gray-800 animate-tab-in"
      >
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
                        <span
                          className={`text-[9px] font-bold ${pt.direction === 'bull' ? 'text-green-500' : pt.direction === 'bear' ? 'text-red-500' : 'text-gray-400'}`}
                        >
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
              ) : (
                <p className={SUB + ' mt-1'}>No patterns detected</p>
              )}
            </div>

            {/* Volume spikes */}
            <div className="p-3">
              <p className={LABEL}>Volume Spikes</p>
              {recentSpikes.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {recentSpikes.map((sp, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-semibold ${sp.type === 'bull' ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {sp.ratio}× avg {sp.type === 'bull' ? '▲' : '▼'}
                      </span>
                      <span className={SUB + ' text-[9px]'}>{sp.date?.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={SUB + ' mt-1'}>No spikes in period</p>
              )}
            </div>

            {/* KPIs */}
            <div className="p-3">
              <p className={LABEL}>Stats</p>
              {kpis ? (
                <div className="mt-1.5 space-y-1.5">
                  {[
                    { label: 'Win Rate', value: `${kpis.winRate}%` },
                    { label: 'Trend Streak', value: kpis.trendStreak },
                    { label: 'Vol Spike / 30c', value: kpis.spikeFreq.toFixed(1) },
                    { label: 'Avg S/R Touches', value: kpis.avgTouches.toFixed(1) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className={SUB}>{label}</span>
                      <span className={VAL}>{value}</span>
                    </div>
                  ))}
                  {kpis.totalSignals > 0 && (
                    <p className="text-[9px] text-gray-300 dark:text-gray-700 mt-1">
                      {kpis.wins}W / {kpis.losses}L resolved
                      {kpis.pending > 0 ? ` · ${kpis.pending} pending` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <p className={SUB + ' mt-1'}>Not enough data</p>
              )}
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
                  {[...support_resistance]
                    .sort((a, b) => b.touches - a.touches)
                    .slice(0, 10)
                    .map((z, i) => (
                      <div key={i} className="grid grid-cols-3 gap-1 items-center">
                        <span
                          className={`text-[9px] font-bold uppercase ${z.type === 'resistance' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}
                        >
                          {z.type === 'resistance' ? 'Res' : 'Sup'}
                        </span>
                        <span className="text-[10px] font-mono text-right text-gray-700 dark:text-gray-300">
                          {z.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-right text-gray-500">
                          {'●'.repeat(Math.min(z.touches, 5))}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className={SUB + ' mt-1'}>None detected</p>
              )}
            </div>

            {/* D/S zones */}
            <div className="p-3">
              <p className={LABEL}>Demand Zones</p>
              {demand_supply?.filter((z) => z.type === 'demand').length ? (
                <div className="mt-1.5 space-y-1.5">
                  {demand_supply
                    .filter((z) => z.type === 'demand')
                    .slice(-5)
                    .reverse()
                    .map((z, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-green-600 dark:text-green-400">
                          {z.bottom.toFixed(2)} – {z.top.toFixed(2)}
                        </span>
                        <span className={SUB + ' text-[9px]'}>{z.origin_date?.slice(5)}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className={SUB + ' mt-1'}>None detected</p>
              )}
            </div>

            <div className="p-3">
              <p className={LABEL}>Supply Zones</p>
              {demand_supply?.filter((z) => z.type === 'supply').length ? (
                <div className="mt-1.5 space-y-1.5">
                  {demand_supply
                    .filter((z) => z.type === 'supply')
                    .slice(-5)
                    .reverse()
                    .map((z, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-red-500">
                          {z.bottom.toFixed(2)} – {z.top.toFixed(2)}
                        </span>
                        <span className={SUB + ' text-[9px]'}>{z.origin_date?.slice(5)}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className={SUB + ' mt-1'}>None detected</p>
              )}
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
  const [leftOpen, setLeftOpen] = useState(
    () => localStorage.getItem('tradeo_pa_leftOpen') !== 'false'
  )
  const [rightOpen, setRightOpen] = useState(
    () => localStorage.getItem('tradeo_pa_rightOpen') !== 'false'
  )
  const toggleLeft = () =>
    setLeftOpen((v) => {
      localStorage.setItem('tradeo_pa_leftOpen', String(!v))
      return !v
    })
  const toggleRight = () =>
    setRightOpen((v) => {
      localStorage.setItem('tradeo_pa_rightOpen', String(!v))
      return !v
    })

  const [paData, setPaData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState([])
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
  const days = TIMEFRAME_DAYS[timeframe] ?? 280

  // Fetch PA scan when symbol, timeframe, or config changes. Config params are sent
  // to the backend (they were previously saved but never used — dead knobs).
  // cancelled flag prevents a slow earlier response from overwriting a newer one.
  useEffect(() => {
    if (!selectedSymbol || !isStock) {
      setPaData(null)
      return
    }
    let cancelled = false
    setLoading(true)
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
      .catch(() => {
        if (!cancelled) setPaData(null)
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
            <PALeftPanel paData={isStock ? paData : null} currentPrice={currentPrice} />
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
            <PARightPanel paData={isStock ? paData : null} kpis={kpis} />
          </div>
        </div>
      </div>
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
