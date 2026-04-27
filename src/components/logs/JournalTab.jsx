import { useState, useMemo, useEffect } from 'react'
import { useContextMenu } from '../ContextMenu'
import MarketJournalModal from './MarketJournalModal'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMOTIONAL_STATES = [
  { value: 'confident', label: '💪 Confident', dot: 'bg-blue-400',    pill: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'calm',      label: '😌 Calm',      dot: 'bg-emerald-400', pill: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'anxious',   label: '😰 Anxious',   dot: 'bg-yellow-400',  pill: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'fearful',   label: '😨 Fearful',   dot: 'bg-orange-400',  pill: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'greedy',    label: '🤑 Greedy',    dot: 'bg-red-400',     pill: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'fomo',      label: '😱 FOMO',      dot: 'bg-purple-400',  pill: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'neutral',   label: '😐 Neutral',   dot: 'bg-gray-400',    pill: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
]

const MOOD_META = {
  Bullish:  { icon: '↑', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  Bearish:  { icon: '↓', color: 'text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20' },
  Neutral:  { icon: '→', color: 'text-gray-500',    bg: 'bg-gray-100 dark:bg-gray-800' },
  Confused: { icon: '?', color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
  Excited:  { icon: '⚡', color: 'text-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/20' },
}

const VIEWS_KEY = 'tradeo_logs_journal_view'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEmotionMeta(val) {
  return EMOTIONAL_STATES.find(e => e.value === val) || null
}

// Merge trade journals + market journals into a unified sorted list
function mergeEntries(tradeJournals, marketJournals) {
  const trade  = (tradeJournals  || []).map(j => ({ ...j, _type: 'trade'  }))
  const market = (marketJournals || []).map(j => ({ ...j, _type: 'market' }))
  return [...trade, ...market].sort((a, b) => {
    const ad = a.date || '', bd = b.date || ''
    return bd.localeCompare(ad)
  })
}

// ── Trade Journal Card (gallery) ──────────────────────────────────────────────

function TradeJournalCard({ journal, trades, onEdit, onDelete, idx }) {
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const emotion = getEmotionMeta(journal.emotional_state)
  const linked  = trades.find(t => t.id === journal.trade_id)
  const symbol  = linked?.symbol || journal.symbol || null

  return (
    <div
      onContextMenu={onContextMenu([
        { label: 'Edit Entry', icon: '✏️', action: () => onEdit(journal) },
        { separator: true },
        { label: 'Delete', icon: '🗑️', danger: true, action: () => onDelete(journal.id) },
      ])}
      className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-default"
      style={{ animationDelay: `${Math.min(idx, 8) * 20}ms` }}
    >
      {emotion && <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${emotion.dot}`} />}
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-semibold text-gray-400 tabular-nums">{journal.date}</span>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500 border border-blue-200 dark:border-blue-800/40">
              Trade
            </span>
            {emotion && (
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${emotion.pill}`}>
                {emotion.label}
              </span>
            )}
          </div>
          {symbol && (
            <span className="flex-shrink-0 text-[11px] font-black tracking-wide text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-lg">
              {symbol}
            </span>
          )}
        </div>
        {(journal.pre_trade_reasoning || journal.post_trade_evaluation || journal.notes) ? (
          <div className="space-y-2">
            {journal.pre_trade_reasoning && (
              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-0.5">Pre-Trade</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
                  {journal.pre_trade_reasoning}
                </p>
              </div>
            )}
            {journal.post_trade_evaluation && (
              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-0.5">Post-Trade</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                  {journal.post_trade_evaluation}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-300 dark:text-gray-700 italic">No content</p>
        )}
      </div>
      <ContextMenuPortal />
    </div>
  )
}

// ── Market Journal Card (gallery) ─────────────────────────────────────────────

function MarketJournalCard({ entry, onClick, idx }) {
  const mood     = MOOD_META[entry.mood] || null
  const nepse    = entry.nepse_change_pct != null ? parseFloat(entry.nepse_change_pct) : null
  const hasUserContent = entry.pre_market || entry.during_market || entry.post_market || entry.market_surprise

  return (
    <div
      onClick={() => onClick(entry)}
      className="relative bg-white dark:bg-gray-900 rounded-xl border border-amber-100 dark:border-amber-800/30 overflow-hidden hover:border-amber-200 dark:hover:border-amber-700/50 transition-all cursor-pointer"
      style={{ animationDelay: `${Math.min(idx, 8) * 20}ms` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400" />
      <div className="p-4 pl-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[9px] font-semibold text-gray-400 tabular-nums">{entry.date}</span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
            Market
          </span>
          {mood && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${mood.bg} ${mood.color}`}>
              {mood.icon} {entry.mood}
            </span>
          )}
          {entry.has_active_trades && (
            <span className="ml-auto text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500">
              Active
            </span>
          )}
        </div>

        {/* NEPSE change large */}
        {nepse != null && (
          <div className="flex items-end gap-2 mb-2">
            <p className={`text-[22px] font-black tabular-nums leading-none ${nepse >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {nepse >= 0 ? '+' : ''}{nepse.toFixed(2)}%
            </p>
            <p className="text-[9px] text-gray-400 mb-0.5">NEPSE</p>
          </div>
        )}

        {/* Top gainer + loser */}
        {(entry.top_gainers?.length > 0 || entry.top_losers?.length > 0) && (
          <div className="flex gap-3 mb-2 flex-wrap">
            {entry.top_gainers?.[0] && (
              <span className="text-[10px] font-semibold text-emerald-500">
                ↑ {entry.top_gainers[0].symbol} +{parseFloat(entry.top_gainers[0].diff_pct).toFixed(1)}%
              </span>
            )}
            {entry.top_losers?.[0] && (
              <span className="text-[10px] font-semibold text-red-400">
                ↓ {entry.top_losers[0].symbol} {parseFloat(entry.top_losers[0].diff_pct).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {/* User reflection excerpt */}
        {hasUserContent ? (
          <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2 italic">
            "{(entry.post_market || entry.pre_market || entry.during_market || entry.market_surprise).slice(0, 80)}…"
          </p>
        ) : (
          <p className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors">
            Click to add your notes →
          </p>
        )}
      </div>
    </div>
  )
}

// ── Database view row ─────────────────────────────────────────────────────────

function JournalDbRow({ entry, trades, onEditTrade, onDeleteTrade, onEditMarket }) {
  const { onContextMenu, ContextMenuPortal } = useContextMenu()
  const isTrade  = entry._type === 'trade'
  const emotion  = isTrade ? getEmotionMeta(entry.emotional_state) : null
  const mood     = !isTrade && entry.mood ? MOOD_META[entry.mood] : null
  const linked   = isTrade ? trades.find(t => t.id === entry.trade_id) : null
  const symbol   = isTrade ? (linked?.symbol || entry.symbol || null) : null
  const excerpt  = isTrade
    ? (entry.pre_trade_reasoning || entry.post_trade_evaluation || entry.notes || '—')
    : (entry.post_market || entry.pre_market || entry.during_market || '—')
  const nepse = !isTrade && entry.nepse_change_pct != null ? parseFloat(entry.nepse_change_pct) : null

  const ctxItems = isTrade
    ? [
        { label: 'Edit Entry', icon: '✏️', action: () => onEditTrade(entry) },
        { separator: true },
        { label: 'Delete', icon: '🗑️', danger: true, action: () => onDeleteTrade(entry.id) },
      ]
    : [{ label: 'Edit Journal', icon: '✏️', action: () => onEditMarket(entry) }]

  return (
    <>
      <ContextMenuPortal />
      <tr
        onContextMenu={onContextMenu(ctxItems)}
        onClick={() => isTrade ? onEditTrade(entry) : onEditMarket(entry)}
        className="border-b border-gray-50 dark:border-gray-800/60 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors"
      >
        <td className="px-4 py-2.5 tabular-nums text-[10px] text-gray-400">{entry.date}</td>
        <td className="px-4 py-2.5">
          {isTrade ? (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500 border border-blue-200 dark:border-blue-800/40">
              Trade
            </span>
          ) : (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
              Market
            </span>
          )}
        </td>
        <td className="px-4 py-2.5">
          {emotion && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${emotion.pill}`}>{emotion.label}</span>
          )}
          {mood && (
            <span className={`text-[9px] font-semibold ${mood.color}`}>{mood.icon} {entry.mood}</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-[10px] font-bold text-gray-700 dark:text-gray-200">
          {isTrade ? (
            symbol
              ? <span className="font-black tracking-wide text-gray-900 dark:text-white">{symbol}</span>
              : <span className="text-gray-300 dark:text-gray-600">—</span>
          ) : nepse != null ? (
            <span className={nepse >= 0 ? 'text-emerald-500 font-bold' : 'text-red-400 font-bold'}>
              {nepse >= 0 ? '+' : ''}{nepse.toFixed(2)}%
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-2.5 text-[10px] text-gray-500 dark:text-gray-400 max-w-xs truncate">
          {excerpt.length > 80 ? excerpt.slice(0, 80) + '…' : excerpt}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button className="text-[10px] text-gray-400 hover:text-blue-500 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
            Edit →
          </button>
        </td>
      </tr>
    </>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function JournalCalendar({ allEntries, trades, onEditMarket, onEditTrade }) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-based

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  // Group entries by date
  const byDate = useMemo(() => {
    const map = {}
    for (const e of allEntries) {
      if (!e.date?.startsWith(monthStr)) continue
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [allEntries, monthStr])

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <p className="text-[12px] font-semibold text-gray-800 dark:text-white">{MONTH_NAMES[month]} {year}</p>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-800/60">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="py-2 text-center text-[9px] font-bold uppercase tracking-widest text-gray-400">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {/* Empty leading cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e-${i}`} className="border-b border-r border-gray-50 dark:border-gray-800/40 min-h-[84px]" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day     = i + 1
          const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`
          const entries = byDate[dateStr] || []
          const todayStr = today.toISOString().slice(0, 10)
          const isToday = dateStr === todayStr

          const marketEntry = entries.find(e => e._type === 'market')
          const tradeEntries = entries.filter(e => e._type === 'trade')
          const nepse = marketEntry?.nepse_change_pct != null ? parseFloat(marketEntry.nepse_change_pct) : null
          const moodMeta = marketEntry?.mood ? MOOD_META[marketEntry.mood] : null

          const cellBg = marketEntry
            ? (nepse != null ? (nepse > 0 ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : nepse < 0 ? 'bg-red-50/40 dark:bg-red-900/10' : '') : '')
            : ''

          return (
            <div
              key={day}
              className={`border-b border-r border-gray-50 dark:border-gray-800/40 min-h-[84px] p-1.5 ${cellBg} ${entries.length > 0 ? 'cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/20 transition-colors' : ''}`}
              onClick={() => {
                if (marketEntry) onEditMarket(marketEntry)
                else if (tradeEntries.length > 0) onEditTrade(tradeEntries[0])
              }}
            >
              <p className={`text-[10px] font-semibold mb-1 ${isToday ? 'text-blue-500 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                {day}
              </p>
              {marketEntry && (
                <div className="mb-1">
                  {nepse != null && (
                    <>
                      <span className={`text-[8px] font-bold tabular-nums block mb-0.5 ${nepse >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {moodMeta?.icon} {nepse >= 0 ? '+' : ''}{nepse.toFixed(1)}%
                      </span>
                      {/* Mini NEPSE bar: centered, filled left(red) or right(green) from 0 */}
                      <svg width="100%" height="6" viewBox="0 0 48 6" preserveAspectRatio="none" style={{ display: 'block' }}>
                        <rect x={0} y={2} width={48} height={2} fill="rgba(0,0,0,0.06)" rx="1" />
                        {nepse >= 0 ? (
                          <rect
                            x={24}
                            y={1}
                            width={Math.min(23, Math.abs(nepse) * 4)}
                            height={4}
                            fill="#10b981"
                            opacity="0.6"
                            rx="1"
                          />
                        ) : (
                          <rect
                            x={Math.max(1, 24 - Math.min(23, Math.abs(nepse) * 4))}
                            y={1}
                            width={Math.min(23, Math.abs(nepse) * 4)}
                            height={4}
                            fill="#f87171"
                            opacity="0.6"
                            rx="1"
                          />
                        )}
                        <line x1={24} y1={0} x2={24} y2={6} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
                      </svg>
                    </>
                  )}
                </div>
              )}
              {tradeEntries.slice(0, 2).map(e => {
                const em = getEmotionMeta(e.emotional_state)
                const linkedTrade = trades.find(t => t.id === e.trade_id)
                const sym = linkedTrade?.symbol || e.symbol || null
                return (
                  <div key={e.id} className="flex items-center gap-1 mb-0.5">
                    {em && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${em.dot}`} />}
                    <span className="text-[8px] text-gray-500 dark:text-gray-400 truncate">
                      {sym || em?.label.split(' ')[0] || 'Trade'}
                    </span>
                  </div>
                )
              })}
              {tradeEntries.length > 2 && (
                <span className="text-[7px] text-gray-400">+{tradeEntries.length - 2} more</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main JournalTab ───────────────────────────────────────────────────────────

export default function JournalTab({
  journals = [],
  marketJournals = [],
  trades = [],
  onEditJournal,
  onDeleteJournal,
  onMarketJournalSaved,
}) {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEWS_KEY) || 'gallery' } catch { return 'gallery' }
  })
  const [typeFilter,    setTypeFilter]    = useState('all')   // 'all' | 'trade' | 'market'
  const [emotionFilter, setEmotionFilter] = useState('')
  const [fromDate,      setFromDate]      = useState('')
  const [toDate,        setToDate]        = useState('')
  const [search,        setSearch]        = useState('')
  const [editMarket,    setEditMarket]    = useState(null)    // market journal entry being edited

  const setViewPersist = (v) => {
    setView(v)
    try { localStorage.setItem(VIEWS_KEY, v) } catch {}
  }

  const allEntries = useMemo(() => mergeEntries(journals, marketJournals), [journals, marketJournals])

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase()
    return allEntries.filter(e => {
      if (typeFilter === 'trade'  && e._type !== 'trade')  return false
      if (typeFilter === 'market' && e._type !== 'market') return false
      if (emotionFilter && e._type === 'trade' && e.emotional_state !== emotionFilter) return false
      if (emotionFilter && e._type === 'market') return false
      if (fromDate && e.date < fromDate) return false
      if (toDate   && e.date > toDate)   return false
      if (lower) {
        const fields = e._type === 'trade'
          ? [e.pre_trade_reasoning, e.post_trade_evaluation, e.notes]
          : [e.pre_market, e.during_market, e.post_market, e.market_surprise]
        if (!fields.some(f => f?.toLowerCase().includes(lower))) return false
      }
      return true
    })
  }, [allEntries, typeFilter, emotionFilter, fromDate, toDate, search])

  const hasFilters = typeFilter !== 'all' || emotionFilter || fromDate || toDate || search
  const clearFilters = () => {
    setTypeFilter('all'); setEmotionFilter(''); setFromDate(''); setToDate(''); setSearch('')
  }

  const VIEW_ICONS = {
    database: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8M4 18h8" />
      </svg>
    ),
    calendar: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    gallery: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  }

  return (
    <div className="space-y-3">

      {/* ── Filter bar ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 rounded-t-2xl">

          {/* Type filter pills */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
            {[
              { key: 'all',    label: 'All',    icon: null },
              { key: 'trade',  label: 'Trade',  icon: '📈' },
              { key: 'market', label: 'Market', icon: '🏛️' },
            ].map(f => (
              <button key={f.key} onClick={() => setTypeFilter(f.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  typeFilter === f.key
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {f.icon && <span className="text-[10px]">{f.icon}</span>}
                {f.label}
              </button>
            ))}
          </div>

          {/* Text search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] text-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors w-32" />
          </div>

          {/* Emotion filter */}
          <select value={emotionFilter} onChange={e => setEmotionFilter(e.target.value)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors">
            <option value="">Emotion</option>
            {EMOTIONAL_STATES.map(es => (
              <option key={es.value} value={es.value}>{es.label}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            {/* Date range */}
            <div className="hidden sm:flex items-center gap-1.5">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors" />
              <span className="text-[10px] text-gray-300 dark:text-gray-600">–</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors" />
            </div>
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/50 transition-all">
                Clear
              </button>
            )}

            {/* View switcher */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {['database', 'calendar', 'gallery'].map(v => (
                <button key={v} onClick={() => setViewPersist(v)} title={v}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    view === v
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}>
                  {VIEW_ICONS[v]}
                  <span className="hidden sm:inline capitalize">{v}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Count strip */}
        <div className="px-4 py-2 flex items-center gap-3">
          <span className="text-[10px] text-gray-400 tabular-nums">
            {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
            {hasFilters && <span className="text-gray-300 dark:text-gray-600"> · filtered</span>}
          </span>
          <div className="flex items-center gap-2 ml-1">
            <span className="flex items-center gap-1 text-[9px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />{allEntries.filter(e => e._type === 'trade').length} trade</span>
            <span className="flex items-center gap-1 text-[9px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{allEntries.filter(e => e._type === 'market').length} market</span>
          </div>
        </div>
      </div>

      {/* ── Empty states ── */}
      {allEntries.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-20 text-center">
          <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <p className="text-[12px] font-medium text-gray-400">No journal entries yet</p>
          <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1">Right-click a trade → Journal, or use Quick Journal</p>
        </div>
      )}

      {allEntries.length > 0 && filtered.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-14 text-center">
          <p className="text-[12px] font-medium text-gray-400">No entries match this filter</p>
          <button onClick={clearFilters} className="mt-2 text-[10px] text-blue-500 hover:text-blue-400">Clear filters</button>
        </div>
      )}

      {/* ── Database view ── */}
      {view === 'database' && filtered.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Date', 'Type', 'Mood/Emotion', 'Symbol/NEPSE', 'Excerpt', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <JournalDbRow
                    key={e._type + e.id}
                    entry={e}
                    trades={trades}
                    onEditTrade={onEditJournal}
                    onDeleteTrade={onDeleteJournal}
                    onEditMarket={setEditMarket}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Calendar view ── */}
      {view === 'calendar' && (
        <JournalCalendar
          allEntries={filtered}
          trades={trades}
          onEditMarket={setEditMarket}
          onEditTrade={onEditJournal}
        />
      )}

      {/* ── Gallery view ── */}
      {view === 'gallery' && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((e, idx) =>
            e._type === 'trade' ? (
              <TradeJournalCard
                key={e.id}
                journal={e}
                trades={trades}
                onEdit={onEditJournal}
                onDelete={onDeleteJournal}
                idx={idx}
              />
            ) : (
              <MarketJournalCard
                key={e.id}
                entry={e}
                onClick={setEditMarket}
                idx={idx}
              />
            )
          )}
        </div>
      )}

      {/* Market Journal edit modal */}
      {editMarket && (
        <MarketJournalModal
          entry={editMarket}
          onClose={() => setEditMarket(null)}
          onSaved={(updated) => {
            onMarketJournalSaved(updated)
            setEditMarket(null)
          }}
        />
      )}
    </div>
  )
}
