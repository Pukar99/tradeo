import { useState, useCallback } from 'react'
import { API } from '../../api'

const TRIGGER_COLORS = {
  VOL_SPIKE:       'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  ABOVE_SMA:       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  ATR_COMPRESSION: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  NEAR_52W_HIGH:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
}

function TriggerBadge({ trigger }) {
  const cls = TRIGGER_COLORS[trigger.type] || 'bg-gray-100 dark:bg-gray-800 text-gray-500'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-semibold ${cls}`}>
      {trigger.label}
    </span>
  )
}

const SORT_OPTIONS = [
  { value: 'diff_pct',    label: '% Change'    },
  { value: 'vol_ratio',   label: 'Volume Ratio' },
  { value: 'pct_from_52w',label: '52W Proximity'},
]

export default function SmartScreenerPage() {
  // Filters
  const [volRatioMin,    setVolRatioMin]    = useState('')
  const [priceAboveSMA,  setPriceAboveSMA]  = useState('')
  const [atrPctMax,      setAtrPctMax]      = useState('')
  const [near52wHigh,    setNear52wHigh]    = useState('')
  const [pctChangeMin,   setPctChangeMin]   = useState('')
  const [pctChangeMax,   setPctChangeMax]   = useState('')

  const [sortBy,   setSortBy]   = useState('diff_pct')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState(null)

  const handleScan = useCallback(async () => {
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const params = {}
      if (volRatioMin)   params.vol_ratio_min    = volRatioMin
      if (priceAboveSMA) params.price_above_sma  = priceAboveSMA
      if (atrPctMax)     params.atr_pct_max      = atrPctMax
      if (near52wHigh)   params.near_52w_high_pct = near52wHigh
      if (pctChangeMin)  params.pct_change_min   = pctChangeMin
      if (pctChangeMax)  params.pct_change_max   = pctChangeMax
      params.limit = 100
      const r = await API.get('/api/screener/scan', { params })
      setResult(r.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to scan')
    } finally {
      setLoading(false)
    }
  }, [volRatioMin, priceAboveSMA, atrPctMax, near52wHigh, pctChangeMin, pctChangeMax])

  const handleReset = () => {
    setVolRatioMin(''); setPriceAboveSMA(''); setAtrPctMax('')
    setNear52wHigh(''); setPctChangeMin(''); setPctChangeMax('')
    setResult(null); setError('')
  }

  // Sort results
  const sorted = result?.results
    ? [...result.results].sort((a, b) => {
        if (sortBy === 'diff_pct')    return b.diff_pct - a.diff_pct
        if (sortBy === 'vol_ratio') {
          const ar = a.avg_volume > 0 ? a.volume / a.avg_volume : 0
          const br = b.avg_volume > 0 ? b.volume / b.avg_volume : 0
          return br - ar
        }
        if (sortBy === 'pct_from_52w') return (a.pct_from_52w ?? 999) - (b.pct_from_52w ?? 999)
        return 0
      })
    : []

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="w-[220px] min-w-[200px] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Smart Screener
          </div>

          {/* Volume spike */}
          <FilterRow
            label="Volume > Avg ×"
            placeholder="e.g. 1.5"
            value={volRatioMin}
            onChange={setVolRatioMin}
            hint="Min volume ratio"
          />

          {/* Price above SMA */}
          <FilterRow
            label="Price above N-SMA"
            placeholder="e.g. 20"
            value={priceAboveSMA}
            onChange={setPriceAboveSMA}
            hint="SMA period (20, 50…)"
          />

          {/* ATR compression */}
          <FilterRow
            label="ATR% of price ≤"
            placeholder="e.g. 3"
            value={atrPctMax}
            onChange={setAtrPctMax}
            hint="Compression filter"
          />

          {/* Near 52W high */}
          <FilterRow
            label="Within X% of 52W High"
            placeholder="e.g. 5"
            value={near52wHigh}
            onChange={setNear52wHigh}
            hint="% from 52-week high"
          />

          {/* % Change range */}
          <div>
            <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Daily % Change
            </label>
            <div className="flex gap-1 mt-0.5">
              <input type="number" placeholder="Min" value={pctChangeMin} onChange={e => setPctChangeMin(e.target.value)}
                className="flex-1 px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="number" placeholder="Max" value={pctChangeMax} onChange={e => setPctChangeMax(e.target.value)}
                className="flex-1 px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          {error && <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">{error}</div>}

          <button onClick={handleScan} disabled={loading}
            className="w-full py-2 text-[11px] font-bold rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors">
            {loading ? 'Scanning…' : 'Scan Market'}
          </button>

          <button onClick={handleReset}
            className="w-full py-1.5 text-[10px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Reset Filters
          </button>

          <div className="mt-auto text-[9px] text-gray-400 text-center leading-tight">
            Scans latest EOD data · NEPSE · All listed stocks
          </div>
        </div>
      </div>

      {/* ── CENTER + RIGHT: Results ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Results header */}
        {result && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                {result.total} results
              </span>
              <span className="text-[10px] text-gray-400">
                as of {result.date}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-400">Sort:</span>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSortBy(opt.value)}
                  className={`px-2 py-0.5 text-[9px] font-semibold rounded border transition-colors ${
                    sortBy === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="text-[32px]">🔍</div>
              <div className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">Build your screen</div>
              <div className="text-[11px] text-gray-400 max-w-xs leading-relaxed">
                Set filters on the left and scan to find today's setups matching your criteria.
                All filters are optional — leave blank to skip.
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {[
                  { label: 'Volume breakout',  action: () => { setVolRatioMin('2'); setPriceAboveSMA('20') } },
                  { label: 'Near 52W high',    action: () => { setNear52wHigh('5'); setPriceAboveSMA('50') } },
                  { label: 'Compressed setup', action: () => { setAtrPctMax('2.5'); setNear52wHigh('10') } },
                  { label: 'Top gainers',      action: () => { setPctChangeMin('3') } },
                ].map((preset, i) => (
                  <button key={i} onClick={preset.action}
                    className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-full text-[12px] text-gray-400">
              Scanning market data…
            </div>
          )}

          {result && result.total === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="text-[24px]">🤷</div>
              <div className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">No matches today</div>
              <div className="text-[10px] text-gray-400">Try loosening one filter at a time</div>
            </div>
          )}

          {result && sorted.length > 0 && (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-4 py-2 font-semibold text-gray-500 dark:text-gray-400">#</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Symbol</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Close</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">% Chg</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Vol Ratio</th>
                  <th className="text-right px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">52W Prox</th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Triggers</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const volRatio = row.avg_volume > 0
                    ? (row.volume / row.avg_volume).toFixed(1)
                    : null
                  return (
                    <tr key={row.symbol}
                      className="border-b border-gray-50 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-2 py-2 font-bold text-gray-900 dark:text-white">{row.symbol}</td>
                      <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">
                        Rs. {row.close.toLocaleString()}
                      </td>
                      <td className={`px-2 py-2 text-right font-bold ${row.diff_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {row.diff_pct >= 0 ? '+' : ''}{row.diff_pct}%
                      </td>
                      <td className={`px-2 py-2 text-right font-semibold ${volRatio >= 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {volRatio != null ? `${volRatio}×` : '—'}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500">
                        {row.pct_from_52w != null ? `${row.pct_from_52w}%` : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.triggers.map((t, j) => <TriggerBadge key={j} trigger={t} />)}
                          {row.triggers.length === 0 && <span className="text-[9px] text-gray-400">—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared filter row component ───────────────────────────────────────────────

function FilterRow({ label, placeholder, value, onChange, hint }) {
  return (
    <div>
      <label className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
      />
      {hint && <div className="text-[9px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  )
}
