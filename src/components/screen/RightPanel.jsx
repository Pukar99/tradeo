import { useState, useEffect, useCallback, useRef } from 'react'
import { getMarketDates, getDayFull, getIPOs, getMarketNews, getTopMovers } from '../../api'
import { useScreen } from '../../context/ScreenContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ChangeBar({ value }) {
  const v = parseFloat(value) || 0
  const isPos = v >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded-md ${
      isPos ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : 'bg-red-50 dark:bg-red-950 text-red-500'
    }`}>
      {isPos ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}

// ── Explore News Modal ────────────────────────────────────────────────────────

function ExploreModal({ items, onClose }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">Market Intelligence</span>
            <span className="text-[8px] bg-blue-100 dark:bg-blue-950 text-blue-500 px-1.5 py-0.5 rounded-full font-semibold">{items.length}</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="text-gray-400 text-[14px] leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-6">No data available yet</p>
          ) : items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-gray-50 dark:border-gray-800 pb-3 last:border-0 last:pb-0">
              <span className="text-[16px] shrink-0 mt-0.5">{item.icon || '📰'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {item.tag && (
                    <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${item.tagColor || 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                      {item.tag}
                    </span>
                  )}
                  {item.sentiment && (
                    <span className={`text-[7px] font-semibold ${
                      item.sentiment === 'positive' ? 'text-emerald-500' :
                      item.sentiment === 'negative' ? 'text-red-400' : 'text-yellow-500'
                    }`}>
                      {item.sentiment === 'positive' ? '● Bullish' : item.sentiment === 'negative' ? '● Bearish' : '● Neutral'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 leading-snug">{item.title || item.headline}</p>
                {item.summary && item.summary !== item.title && (
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-snug line-clamp-2">{item.summary}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {item.date && <span className="text-[8px] text-gray-400">{item.date}</span>}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-[8px] text-blue-500 hover:underline font-medium">
                      Source →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[8px] text-gray-400">SEBON · MeroShare · Sharesansar</p>
        </div>
      </div>
    </div>
  )
}

// ── Feed row ──────────────────────────────────────────────────────────────────

const TYPE_META = {
  ipo:       { icon: '📢', tag: 'IPO',       tagColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' },
  macro:     { icon: '🏛️', tag: 'Macro',     tagColor: 'bg-blue-100 dark:bg-blue-950 text-blue-500' },
  dividend:  { icon: '💰', tag: 'Dividend',  tagColor: 'bg-violet-100 dark:bg-violet-950 text-violet-500' },
  bonus:     { icon: '🎁', tag: 'Bonus',     tagColor: 'bg-orange-100 dark:bg-orange-950 text-orange-500' },
  corporate: { icon: '🏢', tag: 'Corporate', tagColor: 'bg-amber-100 dark:bg-amber-950 text-amber-500' },
  news:      { icon: '📰', tag: 'News',      tagColor: 'bg-gray-100 dark:bg-gray-800 text-gray-500' },
}

function FeedRow({ item, onClick }) {
  const meta = TYPE_META[item.type] || TYPE_META.news
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg px-1 -mx-1 transition-colors group"
    >
      <span className="text-[13px] shrink-0 mt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded ${meta.tagColor}`}>{meta.tag}</span>
          {item.sentiment && (
            <span className={`text-[7px] font-semibold ${
              item.sentiment === 'positive' ? 'text-emerald-500' :
              item.sentiment === 'negative' ? 'text-red-400' : 'text-yellow-500'
            }`}>
              {item.sentiment === 'positive' ? '▲' : item.sentiment === 'negative' ? '▼' : '~'}
            </span>
          )}
        </div>
        <p className="text-[9px] text-gray-700 dark:text-gray-300 leading-snug line-clamp-2 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
          {item.title || item.headline}
        </p>
        {item.sub && <p className="text-[8px] text-gray-400 mt-0.5 truncate">{item.sub}</p>}
      </div>
    </div>
  )
}

// ── All Movers Modal — self-fetches full data for the date ────────────────────

function AllMoversModal({ date, onClose }) {
  const { selectSymbol } = useScreen()
  const [data, setData] = useState(null)
  const [err,  setErr]  = useState(null)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    if (!date) return
    getTopMovers(date)
      .then(r => setData(r.data))
      .catch(() => setErr('Failed to load'))
  }, [date])

  const gainers = data?.gainers || []
  const losers  = data?.losers  || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">All Movers</span>
            <span className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">{date}</span>
            {data && (
              <>
                <span className="text-[7px] font-semibold text-emerald-500">▲ {gainers.length}</span>
                <span className="text-[7px] font-semibold text-red-400">▼ {losers.length}</span>
              </>
            )}
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="text-gray-400 text-[14px] leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!data && !err && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {err && <p className="text-[10px] text-red-400 text-center py-8">{err}</p>}
          {data && (
            <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800">
              <div className="px-3 py-3">
                <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Gainers ({gainers.length})</p>
                {gainers.map((s, i) => (
                  <div key={i}
                    onClick={() => { selectSymbol(s.s); onClose() }}
                    className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 group"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] text-gray-300 dark:text-gray-600 w-4 tabular-nums">{i + 1}</span>
                      <span className="text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</span>
                    </div>
                    <span className="text-[8px] font-semibold text-emerald-500 tabular-nums">+{s.p}%</span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-3">
                <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest mb-2">Losers ({losers.length})</p>
                {losers.map((s, i) => (
                  <div key={i}
                    onClick={() => { selectSymbol(s.s); onClose() }}
                    className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 group"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] text-gray-300 dark:text-gray-600 w-4 tabular-nums">{i + 1}</span>
                      <span className="text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</span>
                    </div>
                    <span className="text-[8px] font-semibold text-red-400 tabular-nums">{s.p}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Summary tab content ───────────────────────────────────────────────────────

function SummaryTab({ summary, selectSymbol }) {
  if (!summary) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const { nepse, breadth, sectors } = summary

  return (
    <div className="space-y-2 py-1" translate="no">

      {/* NEPSE index card */}
      {nepse && (() => {
        const isPos = nepse.per_change >= 0
        const ptChg = nepse.point_change
        return (
          <div className={`rounded-xl px-2.5 py-2 border ${
            isPos
              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">NEPSE Index</span>
              <span className={`text-[9px] font-bold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
                {isPos ? '▲' : '▼'} {Math.abs(nepse.per_change).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[15px] font-black text-gray-900 dark:text-white tabular-nums">
                {nepse.close.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[9px] font-semibold tabular-nums ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
                {ptChg >= 0 ? '+' : ''}{ptChg.toFixed(2)} pts
              </span>
            </div>
            <div className="grid grid-cols-3 gap-x-2">
              {[['Open', nepse.open], ['High', nepse.high], ['Low', nepse.low]].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[6px] text-gray-400 uppercase">{l}</p>
                  <p className="text-[8px] font-semibold text-gray-600 dark:text-gray-400 tabular-nums">
                    {v?.toLocaleString('en-NP', { maximumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
            {nepse.turnover > 0 && (
              <p className="text-[7px] text-gray-400 mt-1.5">
                Turnover: Rs {(nepse.turnover / 1e8).toFixed(2)} Cr
              </p>
            )}
          </div>
        )
      })()}

      {/* Market breadth */}
      {breadth && (() => {
        const advPct  = breadth.total > 0 ? (breadth.advancing / breadth.total) * 100 : 0
        const decPct  = breadth.total > 0 ? (breadth.declining  / breadth.total) * 100 : 0
        return (
          <div className="rounded-xl px-2.5 py-2 border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">Market Breadth</p>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[
                [breadth.advancing, 'Up',   'text-emerald-500'],
                [breadth.declining, 'Down', 'text-red-400'],
                [breadth.unchanged, 'Flat', 'text-gray-400'],
              ].map(([val, lbl, cls]) => (
                <div key={lbl} className="text-center">
                  <p className={`text-[12px] font-bold ${cls}`}>{val}</p>
                  <p className="text-[6px] text-gray-400 uppercase">{lbl}</p>
                </div>
              ))}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex">
              <div className="h-full bg-emerald-400" style={{ width: `${advPct}%` }} />
              <div className="h-full bg-red-400"     style={{ width: `${decPct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[7px] text-emerald-500">{advPct.toFixed(0)}% adv.</span>
              {breadth.totalTurnover > 0 && (
                <span className="text-[7px] text-gray-400">Rs {(breadth.totalTurnover / 1e8).toFixed(1)} Cr</span>
              )}
              <span className="text-[7px] text-gray-400">{breadth.total} traded</span>
            </div>
          </div>
        )
      })()}

      {/* Sectors */}
      {sectors?.length > 0 && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 px-2.5 pt-2 pb-1">Sectors</p>
          <table className="w-full">
            <tbody>
              {sectors.map((s) => {
                const isPos = s.per_change >= 0
                return (
                  <tr key={s.index_id}
                    onClick={() => selectSymbol(s.name, s.index_id)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group border-b border-gray-50 dark:border-gray-800 last:border-0"
                  >
                    <td className="py-1 pl-2.5 pr-1">
                      <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors">{s.short}</span>
                    </td>
                    <td className="py-1 text-right pr-2.5">
                      <ChangeBar value={s.per_change} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main RightPanel ───────────────────────────────────────────────────────────

export default function RightPanel() {
  const { selectSymbol, clickedMovers, clearPin } = useScreen()

  const [dbMovers,  setDbMovers]  = useState(null)
  const [dbVolume,  setDbVolume]  = useState(null)
  const [summary,   setSummary]   = useState(null)
  const [dates,     setDates]     = useState([])
  const [selectedDate,  setSelectedDate]  = useState('')
  const [latestDate,    setLatestDate]    = useState('')
  const [moverTab,      setMoverTab]      = useState('gainers')
  const [loading,       setLoading]       = useState(false)
  const [moversErr,     setMoversErr]     = useState(null)
  const [datesErr,      setDatesErr]      = useState(null)
  const [showAllMovers, setShowAllMovers] = useState(false)

  const [feedItems,   setFeedItems]   = useState([])
  const [feedLoaded,  setFeedLoaded]  = useState(false)
  const [feedErr,     setFeedErr]     = useState(null)
  const [showExplore, setShowExplore] = useState(false)

  // Client-side cache: date → { movers, volume, summary } — avoids re-fetching same date
  const dayCache = useRef({})

  const fetchForDate = useCallback(async (date) => {
    if (!date) return
    // Return cached result immediately if available
    if (dayCache.current[date]) {
      const cached = dayCache.current[date]
      setDbMovers(cached.movers)
      setDbVolume(cached.volume)
      setSummary(cached.summary)
      return
    }
    setLoading(true); setMoversErr(null); setSummary(null)
    try {
      const r = await getDayFull(date)
      dayCache.current[date] = { movers: r.data.movers, volume: r.data.volume, summary: r.data.summary }
      setDbMovers(r.data.movers)
      setDbVolume(r.data.volume)
      setSummary(r.data.summary)
    } catch {
      setMoversErr('Failed to load market data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load date list once
  useEffect(() => {
    getMarketDates()
      .then(r => {
        setDates(r.data.dates)
        setLatestDate(r.data.latestDate)
        setSelectedDate(r.data.latestDate)
      })
      .catch(() => setDatesErr('Failed to load dates'))
  }, [])

  useEffect(() => { fetchForDate(selectedDate) }, [selectedDate, fetchForDate])

  // When candle is pinned, use the same cached fetchForDate (movers from chart cache still shown via clickedMovers)
  useEffect(() => {
    if (!clickedMovers) return
    const d = clickedMovers.date
    if (d === selectedDate) return
    fetchForDate(d)
  }, [clickedMovers?.date]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load news/IPO feed once
  useEffect(() => {
    if (feedLoaded) return
    Promise.all([getIPOs(), getMarketNews()])
      .then(([ir, nr]) => {
        setFeedLoaded(true)
        const ipoItems = (ir.data.ipos || []).map(ipo => ({
          type:      'ipo',
          title:     ipo.title || `${ipo.symbol || ipo.name}: ${ipo.status === 'open' ? 'Apply Now on MeroShare' : ipo.status}`,
          sub:       ipo.openDate && ipo.closeDate ? `${ipo.openDate} → ${ipo.closeDate}` : (ipo.price ? `Issue Price: Rs ${ipo.price}` : null),
          sentiment: ipo.status === 'open' ? 'positive' : 'neutral',
          date:      ipo.closeDate,
          url:       ipo.url,
          icon: '📢', tag: 'IPO', tagColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600',
        }))
        const newsItems = (nr.data.news || []).map(n => ({
          type:      n.type || 'news',
          title:     n.title || n.headline,
          sub:       n.symbol || null,
          sentiment: n.sentiment,
          date:      n.date,
          url:       n.url,
          summary:   n.summary,
        }))
        setFeedItems([...ipoItems, ...newsItems])
      })
      .catch(() => { setFeedLoaded(true); setFeedErr('Failed to load market intel') })
  }, [feedLoaded])

  const isPinned     = !!clickedMovers
  const activeDate   = isPinned ? clickedMovers.date   : selectedDate
  // Pinned movers come from chart cache (top 10); full list via AllMoversModal self-fetch
  const activeMovers = isPinned ? clickedMovers.movers : dbMovers
  const gainers      = activeMovers?.gainers || []
  const losers       = activeMovers?.losers  || []
  const volData      = dbVolume?.data || []
  const maxTurnover  = volData.length > 0 && parseFloat(volData[0].t) > 0 ? parseFloat(volData[0].t) : 1

  const TAB_LABELS = [
    ['gainers', 'Gainers'],
    ['losers',  'Losers'],
    ['volume',  'Volume'],
    ['summary', 'Summary'],
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Date navigation ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 shrink-0">
        {isPinned ? (
          <>
            <div className="flex-1 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1 min-w-0">
              <span className="text-[9px]">📌</span>
              <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 flex-1 truncate">{clickedMovers.date}</span>
            </div>
            <button
              onClick={clearPin}
              className="shrink-0 text-[8px] font-semibold text-gray-400 hover:text-red-400 border border-gray-200 dark:border-gray-700 px-1.5 py-1 rounded-lg transition-colors"
            >✕ Unpin</button>
          </>
        ) : datesErr ? (
          <p className="text-[8px] text-red-400 px-1">{datesErr}</p>
        ) : (
          <>
            <button
              onClick={() => { const i = dates.indexOf(selectedDate); if (i < dates.length - 1) setSelectedDate(dates[i + 1]) }}
              disabled={!dates.length || dates.indexOf(selectedDate) >= dates.length - 1}
              className="shrink-0 text-[8px] font-semibold border border-gray-200 dark:border-gray-700 px-1.5 py-1 rounded-lg disabled:opacity-30 hover:enabled:border-blue-300 hover:enabled:text-blue-500 transition-colors"
            >← Prev</button>
            <span className="flex-1 text-center text-[9px] font-semibold text-gray-600 dark:text-gray-300 tabular-nums">{selectedDate || '—'}</span>
            <button
              onClick={() => { const i = dates.indexOf(selectedDate); if (i > 0) setSelectedDate(dates[i - 1]) }}
              disabled={!selectedDate || selectedDate === latestDate}
              className="shrink-0 text-[8px] font-semibold border border-gray-200 dark:border-gray-700 px-1.5 py-1 rounded-lg disabled:opacity-30 hover:enabled:border-blue-300 hover:enabled:text-blue-500 transition-colors"
            >Next →</button>
            {selectedDate && selectedDate !== latestDate && (
              <button
                onClick={() => setSelectedDate(latestDate)}
                className="shrink-0 text-[8px] font-semibold text-blue-500 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-1.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
              >Today</button>
            )}
          </>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 mx-2 mb-1.5 shrink-0">
        {TAB_LABELS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMoverTab(key)}
            className={`flex-1 py-1 rounded-lg text-[8px] font-semibold transition-colors ${
              moverTab === key
                ? key === 'gainers' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm'
                : key === 'losers'  ? 'bg-white dark:bg-gray-700 text-red-500 shadow-sm'
                : key === 'summary' ? 'bg-white dark:bg-gray-700 text-violet-500 shadow-sm'
                :                    'bg-white dark:bg-gray-700 text-blue-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="px-2 shrink-0">

        {moverTab === 'summary' ? (
          <SummaryTab summary={summary} selectSymbol={selectSymbol} />
        ) : (
          <>
            {moversErr && !loading && !isPinned && (
              <p className="text-[8px] text-red-400 text-center py-2">{moversErr}</p>
            )}

            {loading && !isPinned ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left text-[7px] text-gray-300 dark:text-gray-600 pb-1 w-4">#</th>
                    <th className="text-left text-[7px] text-gray-400 pb-1">Symbol</th>
                    <th className="text-right text-[7px] text-gray-400 pb-1">{moverTab === 'volume' ? 'Turnover' : 'Close'}</th>
                    <th className="text-right text-[7px] text-gray-400 pb-1">Chg%</th>
                  </tr>
                </thead>
                <tbody translate="no">
                  {moverTab === 'gainers' && gainers.slice(0, 10).map((s, i) => (
                    <tr key={s.s} onClick={() => selectSymbol(s.s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
                      <td className="py-1 pr-1 text-[7px] text-gray-300 dark:text-gray-600 tabular-nums">{i + 1}</td>
                      <td className="py-1 text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</td>
                      <td className="py-1 text-right text-[8px] text-gray-500 tabular-nums">{s.c?.toLocaleString()}</td>
                      <td className="py-1 text-right"><ChangeBar value={s.p} /></td>
                    </tr>
                  ))}
                  {moverTab === 'losers' && losers.slice(0, 10).map((s, i) => (
                    <tr key={s.s} onClick={() => selectSymbol(s.s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
                      <td className="py-1 pr-1 text-[7px] text-gray-300 dark:text-gray-600 tabular-nums">{i + 1}</td>
                      <td className="py-1 text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</td>
                      <td className="py-1 text-right text-[8px] text-gray-500 tabular-nums">{s.c?.toLocaleString()}</td>
                      <td className="py-1 text-right"><ChangeBar value={s.p} /></td>
                    </tr>
                  ))}
                  {moverTab === 'volume' && volData.slice(0, 10).map((s, i) => (
                    <tr key={s.s} onClick={() => selectSymbol(s.s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
                      <td className="py-1 pr-1 text-[7px] text-gray-300 dark:text-gray-600 tabular-nums">{i + 1}</td>
                      <td className="py-1">
                        <span className="text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</span>
                        <div className="h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-0.5 overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(parseFloat(s.t) / maxTurnover) * 100}%` }} />
                        </div>
                      </td>
                      <td className="py-1 text-right text-[8px] text-gray-500 tabular-nums whitespace-nowrap">{(parseFloat(s.t) / 1e6).toFixed(1)}M</td>
                      <td className="py-1 text-right"><ChangeBar value={s.p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Footer */}
            {!loading && (activeMovers || volData.length > 0) && (
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-50 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] text-emerald-500">▲ {gainers.length}</span>
                  <span className="text-[7px] text-red-400">▼ {losers.length}</span>
                  {activeMovers?.total && <span className="text-[7px] text-gray-400">of {activeMovers.total}</span>}
                </div>
                {moverTab !== 'volume' && (
                  <button
                    onClick={() => setShowAllMovers(true)}
                    className="text-[8px] font-semibold text-blue-500 hover:underline"
                  >Show All →</button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-gray-800 mx-2 my-2" />

      {/* ── Market Intel feed ─────────────────────────────────────────────── */}
      <div className="px-2 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Market Intel</span>
          {feedItems.length > 0 && (
            <span className="text-[7px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">{feedItems.length}</span>
          )}
        </div>

        {feedErr ? (
          <p className="text-[8px] text-red-400 py-2 text-center">{feedErr}</p>
        ) : !feedLoaded ? (
          <div className="flex items-center justify-center py-3">
            <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedItems.length === 0 ? (
          <p className="text-[9px] text-gray-400 py-2 text-center">No data available</p>
        ) : (
          <>
            {feedItems.slice(0, 4).map((item, i) => (
              <FeedRow key={i} item={item} onClick={() => setShowExplore(true)} />
            ))}
            <button
              onClick={() => setShowExplore(true)}
              className="w-full mt-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[9px] font-semibold text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-1"
            >
              🔗 Explore All ({feedItems.length})
            </button>
          </>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showAllMovers && (
        <AllMoversModal date={activeDate} onClose={() => setShowAllMovers(false)} />
      )}
      {showExplore && (
        <ExploreModal items={feedItems} onClose={() => setShowExplore(false)} />
      )}

    </div>
  )
}
