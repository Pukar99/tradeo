import { useState, useEffect } from 'react'
import { getSectorStrength } from '../../api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctColor(v) {
  if (v === null) return 'text-gray-400'
  if (v > 2)  return 'text-emerald-500'
  if (v > 0)  return 'text-emerald-400'
  if (v < -2) return 'text-red-500'
  if (v < 0)  return 'text-red-400'
  return 'text-gray-400'
}

function tileBg(v) {
  if (v === null) return 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
  if (v > 3)  return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700/50'
  if (v > 1)  return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
  if (v > 0)  return 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
  if (v < -3) return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700/50'
  if (v < -1) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
  if (v < 0)  return 'bg-red-50/60 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
  return 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
}

function rotationArrow(today, week) {
  if (today === null || week === null) return null
  const diff = today - week
  if (Math.abs(diff) < 0.2) return null
  return diff > 0 ? '↑' : '↓'
}

function fmt(v) {
  if (v === null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

const SORT_OPTIONS = [
  { key: 'today_desc', label: 'Today ↓' },
  { key: 'today_asc',  label: 'Today ↑' },
  { key: 'week_desc',  label: '1W ↓' },
  { key: 'month_desc', label: '1M ↓' },
  { key: 'name',       label: 'Name' },
]

function sortSectors(data, key) {
  return [...data].sort((a, b) => {
    switch (key) {
      case 'today_desc': return (b.today ?? -Infinity) - (a.today ?? -Infinity)
      case 'today_asc':  return (a.today ?? Infinity)  - (b.today ?? Infinity)
      case 'week_desc':  return (b.week  ?? -Infinity) - (a.week  ?? -Infinity)
      case 'month_desc': return (b.month ?? -Infinity) - (a.month ?? -Infinity)
      case 'name':       return a.name.localeCompare(b.name)
      default:           return 0
    }
  })
}

// ── Main Component ────────────────────────────────────────────────────────────
// onSelectSector({ index_id, name }) — called when user clicks a tile; parent
// switches to simple mode and loads that index chart

export default function SectorStrengthPage({ onSelectSector }) {
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [sortKey, setSortKey] = useState('today_desc')
  const [view,    setView]    = useState('tiles')
  const [asOf,    setAsOf]    = useState(null)

  useEffect(() => {
    getSectorStrength()
      .then(res => {
        setSectors(res.data.data || [])
        setAsOf(res.data.data?.[0]?.date || null)
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load sector data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-[11px] text-gray-400">Loading sector data…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center p-6">
      <p className="text-[11px] text-red-400">{error}</p>
    </div>
  )

  const sorted = sortSectors(sectors, sortKey)
  const greens = sectors.filter(s => (s.today ?? 0) > 0).length
  const reds   = sectors.filter(s => (s.today ?? 0) < 0).length
  const best   = [...sectors].sort((a, b) => (b.today ?? -Infinity) - (a.today ?? -Infinity))[0]
  const worst  = [...sectors].sort((a, b) => (a.today ?? Infinity)  - (b.today ?? Infinity))[0]

  return (
    <div className="flex-1 overflow-y-auto p-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white">Sector Strength</h2>
          {asOf && <p className="text-[9px] text-gray-400 mt-0.5">as of {asOf}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {[{ k: 'tiles', icon: '⊞' }, { k: 'table', icon: '☰' }].map(({ k, icon }) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  view === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'
                }`}>
                {icon}
              </button>
            ))}
          </div>
          <select
            value={sortKey} onChange={e => setSortKey(e.target.value)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[10px] text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Advancing', value: greens, color: 'text-emerald-500' },
          { label: 'Declining', value: reds,   color: 'text-red-400' },
          { label: 'Strongest', value: best?.today != null ? `${best.short} ${fmt(best.today)}` : '—', color: 'text-emerald-500' },
          { label: 'Weakest',   value: worst?.today != null ? `${worst.short} ${fmt(worst.today)}` : '—', color: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2 text-center">
            <p className={`text-[12px] font-black tabular-nums truncate ${s.color}`}>{s.value}</p>
            <p className="text-[8px] uppercase tracking-widest text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tile view ── */}
      {view === 'tiles' && (
        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {sorted.map(sector => {
            const arrow = rotationArrow(sector.today, sector.week)
            return (
              <button
                key={sector.index_id}
                onClick={() => onSelectSector?.({ index_id: sector.index_id, name: sector.name })}
                className={`text-left rounded-xl border p-3 transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.99] cursor-pointer ${tileBg(sector.today)}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {sector.short}
                  </span>
                  {arrow && (
                    <span className={`text-[10px] font-bold ${arrow === '↑' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {arrow}
                    </span>
                  )}
                </div>
                <p className={`text-[18px] font-black tracking-tight tabular-nums leading-none ${pctColor(sector.today)}`}>
                  {fmt(sector.today)}
                </p>
                <p className="text-[9px] font-semibold text-gray-700 dark:text-gray-200 mt-1 leading-snug">
                  {sector.name}
                </p>
                <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                  <span className="text-[8px] text-gray-400">
                    1W <span className={`font-semibold ${pctColor(sector.week)}`}>{fmt(sector.week)}</span>
                  </span>
                  <span className="text-[8px] text-gray-400">
                    1M <span className={`font-semibold ${pctColor(sector.month)}`}>{fmt(sector.month)}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Table view ── */}
      {view === 'table' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Sector', 'Close', 'Today', '1 Week', '1 Month', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[8px] uppercase tracking-widest font-semibold text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((sector, i) => {
                const arrow = rotationArrow(sector.today, sector.week)
                return (
                  <tr key={sector.index_id}
                    onClick={() => onSelectSector?.({ index_id: sector.index_id, name: sector.name })}
                    className={`border-b border-gray-50 dark:border-gray-800/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-gray-800/10'}`}
                  >
                    <td className="px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-gray-800 dark:text-white">{sector.name}</p>
                      <p className="text-[8px] text-gray-400 uppercase tracking-wider">{sector.short}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] tabular-nums text-gray-600 dark:text-gray-300 font-medium">
                      {sector.close != null ? sector.close.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[11px] font-bold tabular-nums ${pctColor(sector.today)}`}>{fmt(sector.today)}</span>
                    </td>
                    <td className={`px-3 py-2.5 text-[10px] font-semibold tabular-nums ${pctColor(sector.week)}`}>{fmt(sector.week)}</td>
                    <td className={`px-3 py-2.5 text-[10px] font-semibold tabular-nums ${pctColor(sector.month)}`}>{fmt(sector.month)}</td>
                    <td className="px-3 py-2.5">
                      {arrow
                        ? <span className={`text-[12px] font-bold ${arrow === '↑' ? 'text-emerald-500' : 'text-red-400'}`}>{arrow}</span>
                        : <span className="text-[9px] text-gray-300 dark:text-gray-700">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Scale</p>
        {[
          { color: 'bg-emerald-100 dark:bg-emerald-900/30', label: '>+3%' },
          { color: 'bg-emerald-50 dark:bg-emerald-900/20',  label: '+1–3%' },
          { color: 'bg-red-50 dark:bg-red-900/20',          label: '−1–3%' },
          { color: 'bg-red-100 dark:bg-red-900/30',         label: '<−3%' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${color} border border-gray-200 dark:border-gray-700`} />
            <span className="text-[8px] text-gray-400">{label}</span>
          </div>
        ))}
        {onSelectSector && (
          <p className="ml-auto text-[8px] text-gray-300 dark:text-gray-700">Click tile → open chart</p>
        )}
      </div>

    </div>
  )
}
