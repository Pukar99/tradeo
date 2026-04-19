import { useState, useEffect, useCallback, useRef } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import axios from 'axios'
import { BASE_URL } from '../../api'

const API = axios.create({ baseURL: BASE_URL })
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

const INDEX_LIST = [
  { index_id: 12, name: 'NEPSE All-Share'     },
  { index_id: 16, name: 'Sensitive Index'      },
  { index_id: 17, name: 'NEPSE 20 Index'       },
  { index_id: 18, name: 'Float Index'          },
  { index_id: 1,  name: 'Banking Sub-Index'    },
  { index_id: 5,  name: 'Hydropower Index'     },
  { index_id: 6,  name: 'Life Insurance Index' },
  { index_id: 8,  name: 'Manufacturing Index'  },
  { index_id: 9,  name: 'Microfinance Index'   },
]

const REGIME_CONFIG = {
  UPTREND:   { color: '#22c55e', bg: 'bg-green-500',  label: 'UPTREND',   textColor: 'text-green-600 dark:text-green-400',  borderColor: 'border-green-200 dark:border-green-800',  bgLight: 'bg-green-50 dark:bg-green-900/20'  },
  DOWNTREND: { color: '#ef4444', bg: 'bg-red-500',    label: 'DOWNTREND', textColor: 'text-red-600 dark:text-red-400',      borderColor: 'border-red-200 dark:border-red-800',      bgLight: 'bg-red-50 dark:bg-red-900/20'      },
  RANGING:   { color: '#f59e0b', bg: 'bg-amber-500',  label: 'RANGING',   textColor: 'text-amber-600 dark:text-amber-400',  borderColor: 'border-amber-200 dark:border-amber-800',  bgLight: 'bg-amber-50 dark:bg-amber-900/20'  },
  VOLATILE:  { color: '#8b5cf6', bg: 'bg-violet-500', label: 'VOLATILE',  textColor: 'text-violet-600 dark:text-violet-400',borderColor: 'border-violet-200 dark:border-violet-800',bgLight: 'bg-violet-50 dark:bg-violet-900/20'},
  UNCLEAR:   { color: '#94a3b8', bg: 'bg-gray-400',   label: 'UNCLEAR',   textColor: 'text-gray-500 dark:text-gray-400',    borderColor: 'border-gray-200 dark:border-gray-700',    bgLight: 'bg-gray-50 dark:bg-gray-900'       },
}

const LOOKBACK_OPTIONS = [
  { value: 20,  label: '20d'  },
  { value: 60,  label: '60d'  },
  { value: 120, label: '120d' },
  { value: 252, label: '1Y'   },
]

export default function MarketRegimePage() {
  const [indexId,   setIndexId]   = useState(12)
  const [lookback,  setLookback]  = useState(60)
  const [adxThresh, setAdxThresh] = useState(25)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [data,      setData]      = useState(null)

  const chartContainerRef = useRef(null)
  const chartRef          = useRef(null)
  const priceSeriesRef    = useRef(null)
  const adxSeriesRef      = useRef(null)

  // Init chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width:  chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: { background: { color: 'transparent' }, textColor: '#64748b' },
      grid:   { vertLines: { color: 'rgba(100,116,139,0.1)' }, horzLines: { color: 'rgba(100,116,139,0.1)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(100,116,139,0.2)' },
      timeScale:       { borderColor: 'rgba(100,116,139,0.2)', timeVisible: true },
    })

    priceSeriesRef.current = chart.addAreaSeries({
      lineColor:   '#3b82f6',
      topColor:    'rgba(59,130,246,0.12)',
      bottomColor: 'rgba(59,130,246,0)',
      lineWidth:   2,
    })

    adxSeriesRef.current = chart.addLineSeries({
      color:       '#f59e0b',
      lineWidth:   1,
      priceScaleId: 'adx',
    })
    chart.priceScale('adx').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
      borderVisible: false,
    })

    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    })
    ro.observe(chartContainerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [])

  const fetchRegime = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const r = await API.get('/api/regime/detect', {
        params: { index_id: indexId, lookback, adx_threshold: adxThresh },
      })
      setData(r.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to detect regime')
    } finally {
      setLoading(false)
    }
  }, [indexId, lookback, adxThresh])

  // Auto-fetch on mount and when params change
  useEffect(() => { fetchRegime() }, [indexId, lookback, adxThresh])

  // Paint chart when data arrives
  useEffect(() => {
    if (!data || !priceSeriesRef.current || !adxSeriesRef.current) return

    const series = data.chart_series

    priceSeriesRef.current.setData(
      series.map(c => ({ time: c.date, value: c.close }))
    )

    adxSeriesRef.current.setData(
      series.filter(c => c.adx != null).map(c => ({ time: c.date, value: c.adx }))
    )

    // Regime background bands via markers on price series
    const markers = []
    let prevRegime = null
    for (const c of series) {
      if (c.regime && c.regime !== prevRegime && c.regime !== 'UNCLEAR') {
        const cfg = REGIME_CONFIG[c.regime]
        markers.push({
          time:     c.date,
          position: 'inBar',
          color:    cfg ? cfg.color + '30' : '#94a3b8',
          shape:    'square',
          size:     0,
        })
        prevRegime = c.regime
      }
    }
    priceSeriesRef.current.setMarkers(markers)
  }, [data])

  const cfg = data ? REGIME_CONFIG[data.current_regime] || REGIME_CONFIG.UNCLEAR : null

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="w-[200px] min-w-[180px] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Market Regime
          </div>

          {/* Index selector */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Index</label>
            <select
              value={indexId}
              onChange={e => setIndexId(parseInt(e.target.value))}
              className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            >
              {INDEX_LIST.map(idx => (
                <option key={idx.index_id} value={idx.index_id}>{idx.name}</option>
              ))}
            </select>
          </div>

          {/* Lookback */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lookback</label>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {LOOKBACK_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setLookback(opt.value)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                    lookback === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ADX Threshold */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ADX Threshold</label>
              <span className="text-[10px] font-bold text-amber-600">{adxThresh}</span>
            </div>
            <input
              type="range" min="15" max="40" step="1"
              value={adxThresh}
              onChange={e => setAdxThresh(parseInt(e.target.value))}
              className="w-full mt-1 accent-amber-500"
            />
            <div className="text-[9px] text-gray-400 leading-tight">
              ADX &gt; {adxThresh} = trending. Default 25.
            </div>
          </div>

          {error && (
            <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">{error}</div>
          )}

          <button
            onClick={fetchRegime}
            disabled={loading}
            className="w-full py-2 text-[11px] font-bold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
          >
            {loading ? 'Detecting…' : 'Refresh'}
          </button>

          {/* Legend */}
          <div className="mt-auto">
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Regimes</div>
            <div className="flex flex-col gap-1">
              {Object.entries(REGIME_CONFIG).filter(([k]) => k !== 'UNCLEAR').map(([key, c]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-[9px] text-gray-500 dark:text-gray-400">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[9px] text-gray-400 text-center leading-tight">
            ADX + slope classification · NEPSE index data
          </div>
        </div>
      </div>

      {/* ── CENTER: Chart ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <div ref={chartContainerRef} className="flex-1 min-h-0" />

        {/* ADX label overlay */}
        {data && (
          <div className="absolute top-2 left-3 flex items-center gap-3 pointer-events-none">
            <span className="text-[9px] text-gray-400">
              {data.index_name}
            </span>
            <span className="text-[9px] text-amber-500 font-semibold">
              ADX {data.adx ?? '—'} (amber line)
            </span>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-950/50">
            <span className="text-[12px] text-gray-400">Detecting regime…</span>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div className="w-[260px] min-w-[240px] border-l border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col h-full overflow-y-auto p-3 gap-4">

          {data && cfg ? (
            <>
              {/* Current regime badge */}
              <div className={`rounded-xl border p-4 ${cfg.borderColor} ${cfg.bgLight}`}>
                <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Current Regime</div>
                <div className={`text-[24px] font-black ${cfg.textColor}`}>{cfg.label}</div>
                <div className="text-[9px] text-gray-400 mt-1">{data.index_name} · {data.latest_date}</div>

                {/* Confidence bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-gray-400">Confidence</span>
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{data.confidence}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${data.confidence}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                </div>

                <div className="mt-2 text-[9px] text-gray-500 dark:text-gray-400">
                  In this regime for <span className="font-semibold text-gray-700 dark:text-gray-300">{data.regime_duration} days</span>
                </div>
              </div>

              {/* Indicators */}
              <div className="grid grid-cols-2 gap-2">
                <Metric label="ADX" value={data.adx ?? '—'} sub={`Threshold: ${adxThresh}`} />
                <Metric label="ATR %" value={data.atr_pct != null ? `${data.atr_pct}%` : '—'} sub="14-period" />
                <Metric label="Slope" value={data.slope_pct != null ? `${data.slope_pct > 0 ? '+' : ''}${data.slope_pct}%` : '—'}
                  color={data.slope_pct > 0 ? 'green' : data.slope_pct < 0 ? 'red' : null}
                  sub={`${data.lookback}d trend`}
                />
                <Metric label="Duration" value={`${data.regime_duration}d`} sub="current regime" />
              </div>

              {/* Implication */}
              <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Implication</div>
                <div className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">
                  {data.implication}
                </div>
              </div>

              {/* Historical distribution */}
              {data.distribution?.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Historical Distribution ({data.lookback}d)
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {data.distribution.map(d => {
                      const dc = REGIME_CONFIG[d.regime]
                      return (
                        <div key={d.regime} className="flex items-center gap-2">
                          <div className="w-16 text-[9px] font-semibold text-gray-600 dark:text-gray-400 shrink-0">
                            {d.regime}
                          </div>
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${d.pct}%`, backgroundColor: dc?.color || '#94a3b8' }}
                            />
                          </div>
                          <div className="text-[9px] text-gray-400 w-8 text-right shrink-0">{d.pct}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : !loading ? (
            <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400 text-center px-4">
              Select an index to detect the current market regime
            </div>
          ) : null}
        </div>
      </div>

    </div>
  )
}

function Metric({ label, value, sub, color }) {
  const textColor = color === 'green' ? 'text-green-600 dark:text-green-400'
                  : color === 'red'   ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5">
      <div className="text-[8px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-[14px] font-bold mt-0.5 ${textColor}`}>{value}</div>
      {sub && <div className="text-[8px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
