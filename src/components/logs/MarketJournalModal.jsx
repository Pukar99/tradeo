import { useState, useEffect } from 'react'
import { updateMarketJournal } from '../../api'

const MOODS = [
  { value: 'Bullish',  label: '↑ Bullish',  color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40' },
  { value: 'Bearish',  label: '↓ Bearish',  color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/40' },
  { value: 'Neutral',  label: '→ Neutral',  color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
  { value: 'Confused', label: '? Confused', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40' },
  { value: 'Excited',  label: '⚡ Excited', color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800/40' },
]

const INPUT = 'w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-[12px] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none leading-relaxed'
const LABEL = 'block text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5'

export default function MarketJournalModal({ entry, onClose, onSaved }) {
  const [form, setForm] = useState({
    pre_market:      entry?.pre_market      || '',
    during_market:   entry?.during_market   || '',
    post_market:     entry?.post_market     || '',
    market_surprise: entry?.market_surprise || '',
    mood:            entry?.mood            || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)

  // Escape key closes
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setSaveErr(null)
    try {
      const res = await updateMarketJournal(entry.date, form)
      onSaved(res.data)
      onClose()
    } catch (err) {
      setSaveErr(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const nepseChange = entry?.nepse_change_pct != null ? parseFloat(entry.nepse_change_pct) : null
  const nepseClose  = entry?.nepse_close  != null ? parseFloat(entry.nepse_close)  : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800/80">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Market Journal</p>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                Market
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">{entry?.date}</p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all mt-0.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Auto-populated section */}
        {entry && (
          <div className="px-5 pt-4 pb-3 bg-gray-50/60 dark:bg-gray-800/20 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-3">Market Data (Auto-populated)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              {/* NEPSE */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                <p className="text-[8px] uppercase tracking-widest text-gray-400">NEPSE Close</p>
                <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">
                  {nepseClose != null ? nepseClose.toLocaleString() : '—'}
                </p>
                {nepseChange != null && (
                  <p className={`text-[10px] font-semibold tabular-nums mt-0.5 ${nepseChange >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {nepseChange >= 0 ? '+' : ''}{nepseChange.toFixed(2)}%
                  </p>
                )}
              </div>

              {/* Breadth */}
              {(entry.advancing != null || entry.declining != null) && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                  <p className="text-[8px] uppercase tracking-widest text-gray-400">Breadth</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {entry.advancing != null && (
                      <span className="text-[10px] font-semibold text-emerald-500">{entry.advancing}↑</span>
                    )}
                    {entry.declining != null && (
                      <span className="text-[10px] font-semibold text-red-400">{entry.declining}↓</span>
                    )}
                    {entry.unchanged != null && (
                      <span className="text-[10px] text-gray-400">{entry.unchanged}→</span>
                    )}
                  </div>
                </div>
              )}

              {/* Volume */}
              {entry.total_volume != null && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                  <p className="text-[8px] uppercase tracking-widest text-gray-400">Volume</p>
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mt-1 tabular-nums">
                    Rs.{(parseFloat(entry.total_volume) / 1e7).toFixed(1)}Cr
                  </p>
                </div>
              )}

              {/* Active trades badge */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                <p className="text-[8px] uppercase tracking-widest text-gray-400">Your Trades</p>
                <span className={`text-[10px] font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${
                  entry.has_active_trades
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {entry.has_active_trades ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Gainers / Losers */}
            {(entry.top_gainers?.length > 0 || entry.top_losers?.length > 0) && (
              <div className="grid grid-cols-2 gap-2">
                {entry.top_gainers?.length > 0 && (
                  <div>
                    <p className="text-[8px] uppercase tracking-widest text-gray-400 mb-1.5">Top Gainers</p>
                    <div className="space-y-1">
                      {entry.top_gainers.map(g => (
                        <div key={g.symbol} className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{g.symbol}</span>
                          <span className="text-[10px] font-semibold text-emerald-500">+{parseFloat(g.diff_pct).toFixed(2)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {entry.top_losers?.length > 0 && (
                  <div>
                    <p className="text-[8px] uppercase tracking-widest text-gray-400 mb-1.5">Top Losers</p>
                    <div className="space-y-1">
                      {entry.top_losers.map(l => (
                        <div key={l.symbol} className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{l.symbol}</span>
                          <span className="text-[10px] font-semibold text-red-400">{parseFloat(l.diff_pct).toFixed(2)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sector data */}
            {entry.sector_data?.length > 0 && (
              <div className="mt-3">
                <p className="text-[8px] uppercase tracking-widest text-gray-400 mb-1.5">Sector Performance</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.sector_data.map(s => (
                    <div key={s.index_id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold border ${
                      parseFloat(s.per_change) > 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400'
                        : parseFloat(s.per_change) < 0
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-500 dark:text-red-400'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {s.name}
                      <span className="ml-0.5">{parseFloat(s.per_change) >= 0 ? '+' : ''}{parseFloat(s.per_change).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Editable fields */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Mood */}
          <div>
            <label className={LABEL}>Overall Mood</label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, mood: p.mood === m.value ? '' : m.value }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                    form.mood === m.value
                      ? m.color
                      : 'bg-gray-50 dark:bg-gray-800/80 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL}>Pre-market Expectation</label>
            <textarea
              value={form.pre_market}
              onChange={e => setForm(p => ({ ...p, pre_market: e.target.value }))}
              placeholder="What were you expecting before market opened? Key levels, catalysts, macro context…"
              rows={3}
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>During-market Notes</label>
            <textarea
              value={form.during_market}
              onChange={e => setForm(p => ({ ...p, during_market: e.target.value }))}
              placeholder="What happened intraday? Key price action, sector rotations, order flow…"
              rows={3}
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>Post-market Reflection</label>
            <textarea
              value={form.post_market}
              onChange={e => setForm(p => ({ ...p, post_market: e.target.value }))}
              placeholder="How did the day unfold vs your expectations? What worked, what didn't?"
              rows={3}
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>Market Surprise <span className="normal-case font-normal text-gray-300">— what was unexpected?</span></label>
            <textarea
              value={form.market_surprise}
              onChange={e => setForm(p => ({ ...p, market_surprise: e.target.value }))}
              placeholder="Any unexpected moves, news, or patterns that surprised you today…"
              rows={2}
              className={INPUT}
            />
          </div>

          {saveErr && (
            <p className="text-[11px] text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">
              {saveErr}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-[11px] font-semibold disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Journal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
