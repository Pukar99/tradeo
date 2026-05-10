import { useState, useMemo } from 'react'
import MarketJournalModal from './MarketJournalModal'

// ── Mood meta ─────────────────────────────────────────────────────────────────
const MOOD_META = {
  Bullish:  { icon: '↑', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40' },
  Bearish:  { icon: '↓', pill: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/40' },
  Neutral:  { icon: '→', pill: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
  Confused: { icon: '?', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40' },
  Excited:  { icon: '⚡', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800/40' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtVol = (v) => {
  const n = parseFloat(v) || 0
  if (n >= 1e9)  return `Rs.${(n / 1e9).toFixed(2)}B`
  if (n >= 1e7)  return `Rs.${(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5)  return `Rs.${(n / 1e5).toFixed(1)}L`
  return `Rs.${Math.round(n).toLocaleString()}`
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-2xl">📰</div>
      <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">No market journal entries yet</p>
      <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
        Entries are auto-created when you open the Logs page. Come back after a trading day.
      </p>
    </div>
  )
}

// ── Single entry card ─────────────────────────────────────────────────────────
function EntryCard({ entry, onOpen }) {
  const change    = entry.nepse_change_pct != null ? parseFloat(entry.nepse_change_pct) : null
  const close     = entry.nepse_close      != null ? parseFloat(entry.nepse_close)      : null
  const mood      = entry.mood ? MOOD_META[entry.mood] : null
  const hasNotes  = entry.pre_market || entry.during_market || entry.post_market || entry.market_surprise
  const isUp      = change == null || change >= 0

  // How many user-written fields are filled
  const filledCount = [entry.pre_market, entry.during_market, entry.post_market, entry.market_surprise]
    .filter(v => v && v.trim().length > 0).length

  return (
    <div
      onClick={() => onOpen(entry)}
      className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3.5 cursor-pointer hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-4">

        {/* Date column */}
        <div className="flex-shrink-0 w-16 text-center">
          <p className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">
            {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
          </p>
          <p className="text-[22px] font-black text-gray-800 dark:text-white leading-none mt-0.5">
            {new Date(entry.date + 'T00:00:00').getDate()}
          </p>
          <p className="text-[9px] text-gray-400 mt-0.5">
            {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
          </p>
        </div>

        {/* Middle: NEPSE + breadth */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {/* NEPSE close */}
            {close != null ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-bold text-gray-900 dark:text-white tabular-nums">
                  {close.toLocaleString()}
                </span>
                <span className={`text-[11px] font-semibold tabular-nums ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
                  {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : ''}
                </span>
              </div>
            ) : (
              <span className="text-[12px] text-gray-400 italic">No market data</span>
            )}

            {/* Mood */}
            {mood && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border ${mood.pill}`}>
                {mood.icon} {entry.mood}
              </span>
            )}

            {/* Active trades badge */}
            {entry.has_active_trades && (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                Active Trades
              </span>
            )}
          </div>

          {/* Breadth row */}
          {(entry.advancing != null || entry.declining != null) && (
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {entry.advancing  != null && <span className="text-[10px] text-emerald-500 font-semibold">{entry.advancing}↑</span>}
              {entry.declining  != null && <span className="text-[10px] text-red-400 font-semibold">{entry.declining}↓</span>}
              {entry.unchanged  != null && <span className="text-[10px] text-gray-400">{entry.unchanged}→</span>}
              {entry.total_volume != null && (
                <span className="text-[10px] text-gray-400">Vol {fmtVol(entry.total_volume)}</span>
              )}
            </div>
          )}

          {/* Sector chips — top 4 visible, rest hidden */}
          {entry.sector_data?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.sector_data.slice(0, 5).map(s => {
                const pc = parseFloat(s.per_change)
                return (
                  <span key={s.index_id} className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${
                    pc > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : pc < 0 ? 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}>
                    {s.name} {pc >= 0 ? '+' : ''}{pc.toFixed(1)}%
                  </span>
                )
              })}
              {entry.sector_data.length > 5 && (
                <span className="text-[8px] text-gray-400 self-center">+{entry.sector_data.length - 5} more</span>
              )}
            </div>
          )}

          {/* User notes preview */}
          {hasNotes && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
              {entry.pre_market || entry.during_market || entry.post_market || entry.market_surprise}
            </p>
          )}
        </div>

        {/* Right: notes fill indicator + chevron */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {/* 4-dot fill indicator */}
          <div className="flex gap-0.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < filledCount ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            ))}
          </div>
          <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>

      </div>
    </div>
  )
}

// ── Main MarketJournalTab ─────────────────────────────────────────────────────
export default function MarketJournalTab({ marketJournals, onMarketJournalSaved }) {
  const [openEntry, setOpenEntry] = useState(null)
  const [filter,    setFilter]    = useState('all')  // 'all' | 'written' | 'unwritten'

  const entries = useMemo(() => {
    if (!marketJournals?.length) return []
    return marketJournals.filter(e => {
      if (filter === 'written')   return e.pre_market || e.during_market || e.post_market || e.market_surprise
      if (filter === 'unwritten') return !e.pre_market && !e.during_market && !e.post_market && !e.market_surprise
      return true
    })
  }, [marketJournals, filter])

  const writtenCount   = (marketJournals || []).filter(e => e.pre_market || e.during_market || e.post_market || e.market_surprise).length
  const unwrittenCount = (marketJournals || []).length - writtenCount

  return (
    <div className="space-y-4">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">

        {/* Summary chips */}
        <div className="flex items-center gap-2">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{(marketJournals || []).length}</span>
            <span className="text-[10px] text-gray-400">entries</span>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-amber-500">{writtenCount}</span>
            <span className="text-[10px] text-gray-400">written</span>
          </div>
          {unwrittenCount > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-gray-500">{unwrittenCount}</span>
              <span className="text-[10px] text-gray-400">blank</span>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl p-1">
          {[
            { id: 'all',       label: 'All' },
            { id: 'written',   label: 'Written' },
            { id: 'unwritten', label: 'Blank' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${filter === f.id ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Entry list ── */}
      {!marketJournals?.length ? (
        <Empty />
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-[12px] text-gray-400">No entries match this filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <EntryCard key={entry.id} entry={entry} onOpen={setOpenEntry} />
          ))}
        </div>
      )}

      {/* ── Edit modal ── */}
      {openEntry && (
        <MarketJournalModal
          entry={openEntry}
          onClose={() => setOpenEntry(null)}
          onSaved={(updated) => {
            onMarketJournalSaved(updated)
            setOpenEntry(null)
          }}
        />
      )}

    </div>
  )
}
