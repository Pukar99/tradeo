import { useState, useEffect, useMemo } from 'react'
import { getCorporateActions, getWatchlist } from '../api'
import { useAuth } from '../context/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META = {
  dividend: { label: 'Dividend',   bg: 'bg-emerald-100 dark:bg-emerald-900/30', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  bonus:    { label: 'Bonus',      bg: 'bg-blue-100 dark:bg-blue-900/30',       dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300',       badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'       },
  rights:   { label: 'Rights',     bg: 'bg-violet-100 dark:bg-violet-900/30',   dot: 'bg-violet-500',  text: 'text-violet-700 dark:text-violet-300',   badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
  agm:      { label: 'AGM/EGM',    bg: 'bg-amber-100 dark:bg-amber-900/30',     dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300',     badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'   },
  closure:  { label: 'Book Close', bg: 'bg-red-100 dark:bg-red-900/30',         dot: 'bg-red-400',     text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'         },
  other:    { label: 'Corporate',  bg: 'bg-gray-100 dark:bg-gray-800',          dot: 'bg-gray-400',    text: 'text-gray-600 dark:text-gray-400',       badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'       },
}

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function isoToLocal(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

// ── Event Pill (inside calendar cell) ────────────────────────────────────────

function EventPill({ event, isWatched, onClick }) {
  const meta = TYPE_META[event.type] || TYPE_META.other
  return (
    <button
      onClick={() => onClick(event)}
      className={`w-full text-left px-1.5 py-0.5 rounded text-[8px] font-semibold truncate transition-all hover:opacity-80 ${meta.bg} ${meta.text} ${isWatched ? 'ring-1 ring-offset-1 ring-current' : ''}`}
      title={`${event.symbol || event.company} — ${event.action}`}
    >
      {isWatched && '★ '}{event.symbol || event.company?.slice(0, 6)}
    </button>
  )
}

// ── Event Detail Popover ──────────────────────────────────────────────────────

function EventDetail({ event, onClose }) {
  if (!event) return null
  const meta = TYPE_META[event.type] || TYPE_META.other
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-sm p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[20px]">{event.icon}</span>
            <div>
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">{event.symbol || '—'}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{event.company}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            {event.date && (
              <span className="text-[10px] text-gray-400">{event.date}</span>
            )}
          </div>
          <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">{event.action}</p>
          {event.detail && event.detail !== event.action && (
            <p className="text-[10px] text-gray-400 leading-relaxed">{event.detail}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuth()
  const today    = new Date()

  const [actions,   setActions]   = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [year,      setYear]      = useState(today.getFullYear())
  const [month,     setMonth]     = useState(today.getMonth())
  const [selected,  setSelected]  = useState(null)   // selected event for detail
  const [typeFilter, setTypeFilter] = useState('all') // all | dividend | bonus | rights | agm | closure
  const [view,      setView]      = useState('calendar') // calendar | list

  useEffect(() => {
    const loads = [getCorporateActions()]
    if (user) loads.push(getWatchlist())

    Promise.allSettled(loads).then(([actRes, wlRes]) => {
      if (actRes.status === 'fulfilled') {
        setActions(actRes.value.data.actions || [])
      } else {
        setError(actRes.reason?.response?.data?.error || 'Failed to load corporate actions')
      }
      if (wlRes?.status === 'fulfilled') {
        setWatchlist(wlRes.value.data || [])
      }
      setLoading(false)
    })
  }, [user])

  const watchedSymbols = useMemo(() => new Set(watchlist.map(w => w.symbol)), [watchlist])

  // Actions filtered by type
  const filtered = useMemo(() =>
    typeFilter === 'all' ? actions : actions.filter(a => a.type === typeFilter)
  , [actions, typeFilter])

  // Group by date for calendar
  const byDate = useMemo(() => {
    const map = {}
    for (const ev of filtered) {
      if (!ev.date) continue
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  }, [filtered])

  // Events for this month (calendar view)
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthEvents = useMemo(() =>
    filtered.filter(e => e.date?.startsWith(monthPrefix))
  , [filtered, monthPrefix])

  // Events for list view — next 60 days from today
  const upcoming = useMemo(() => {
    const todayStr = today.toISOString().slice(0, 10)
    const limit = new Date(today); limit.setDate(limit.getDate() + 60)
    const limitStr = limit.toISOString().slice(0, 10)
    return filtered.filter(e => e.date >= todayStr && e.date <= limitStr)
  }, [filtered, today])

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  if (loading) return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[11px] text-gray-400">Loading corporate actions…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8">
      <div className="bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
        <p className="text-[11px] text-red-500">{error}</p>
      </div>
    </div>
  )

  const firstDay = firstDayOfMonth(year, month)
  const totalDays = daysInMonth(year, month)
  const cells = Array.from({ length: firstDay + totalDays }, (_, i) => {
    if (i < firstDay) return null
    return i - firstDay + 1
  })
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-5 pb-14">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">Corporate Actions</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Dividends · Bonus · Rights · AGM · Book closures</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {[{ k: 'calendar', icon: '⊞' }, { k: 'list', icon: '☰' }].map(({ k, icon }) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${view === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}>
                {icon}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-700 dark:text-gray-200 focus:outline-none">
            <option value="all">All types</option>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} onClick={() => setTypeFilter(typeFilter === k ? 'all' : k)}
            className={`flex items-center gap-1.5 transition-opacity ${typeFilter !== 'all' && typeFilter !== k ? 'opacity-30' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${v.dot}`} />
            <span className="text-[9px] text-gray-500 dark:text-gray-400">{v.label}</span>
          </button>
        ))}
        {user && (
          <span className="ml-auto text-[9px] text-gray-300 dark:text-gray-700">★ = in your watchlist</span>
        )}
      </div>

      {/* ── Calendar view ── */}
      {view === 'calendar' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
              ‹
            </button>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">
              {MONTHS[month]} {year}
              <span className="ml-2 text-[10px] font-normal text-gray-400">{monthEvents.length} events</span>
            </p>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
              ›
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-[9px] font-semibold uppercase tracking-widest text-gray-400">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
              const dayEvents = dateStr ? (byDate[dateStr] || []) : []
              const isToday = dateStr === todayStr
              const isPast  = dateStr && dateStr < todayStr

              return (
                <div key={i}
                  className={`min-h-[80px] border-b border-r border-gray-50 dark:border-gray-800/60 p-1.5 ${isPast ? 'opacity-60' : ''} ${!day ? 'bg-gray-50/40 dark:bg-gray-800/10' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-[10px] font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev, j) => (
                          <EventPill key={j} event={ev} isWatched={watchedSymbols.has(ev.symbol)} onClick={setSelected} />
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-[8px] text-gray-400 pl-1">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              Next 60 days — {upcoming.length} events
            </p>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[11px] text-gray-400">No upcoming events in the next 60 days</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {upcoming.map((ev, i) => {
                const meta      = TYPE_META[ev.type] || TYPE_META.other
                const isWatched = watchedSymbols.has(ev.symbol)
                const dDate     = isoToLocal(ev.date)
                const daysAway  = dDate ? Math.ceil((dDate - today) / 86400000) : null
                return (
                  <button key={i} onClick={() => setSelected(ev)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors text-left">
                    {/* Date badge */}
                    <div className="flex-shrink-0 w-10 text-center">
                      <p className="text-[8px] text-gray-400 uppercase">{ev.date?.slice(5, 7) ? MONTHS[parseInt(ev.date.slice(5, 7)) - 1]?.slice(0, 3) : ''}</p>
                      <p className="text-[16px] font-black text-gray-900 dark:text-white leading-none">{ev.date?.slice(8)}</p>
                    </div>

                    {/* Type dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate">
                          {isWatched && <span className="text-amber-400 mr-0.5">★</span>}
                          {ev.symbol || '—'}
                        </p>
                        <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{ev.action}</p>
                    </div>

                    {/* Days away */}
                    {daysAway != null && (
                      <div className="flex-shrink-0 text-right">
                        <p className={`text-[10px] font-semibold ${daysAway <= 5 ? 'text-red-400' : daysAway <= 14 ? 'text-amber-500' : 'text-gray-400'}`}>
                          {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway}d`}
                        </p>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Event detail modal ── */}
      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
