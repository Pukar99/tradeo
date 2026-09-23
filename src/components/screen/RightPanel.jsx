// === RightPanel.jsx — screen right panel: date nav, gainers/losers/volume/summary tabs, market intel feed, all-movers modal ===
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getMarketDates, getDayFull, getMarketFeed, getTopMovers } from '../../utils/globalCache'
import { useScreen } from '../../context/ScreenContext'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator'
import { safeUrl } from '../../utils/format'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ChangeBar({ value }) {
  const v = parseFloat(value) || 0
  const isPos = v >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded-md ${
        isPos
          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
          : 'bg-red-50 dark:bg-red-950 text-red-500'
      }`}
    >
      {isPos ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}

// ── Mover row — plain hover row (hp-watch-item, same class Home's own
// watchlist rows use — owner rejected a bordered-card treatment twice, no
// border/background box), keeping only a thin colored left accent stripe
// for at-a-glance identification. `right` is an optional extra value shown
// before the change badge (last price for gainers/losers, turnover for
// volume); `children` renders below the row (volume's turnover bar). ───────
function MoverRow({ rank, symbol, right, changeValue, accent, onClick, index, children }) {
  return (
    <div
      onClick={onClick}
      className="hp-watch-item flex overflow-hidden rounded-lg cursor-pointer transition-colors group animate-fade-up hover:bg-white dark:hover:bg-gray-800/60"
      style={{ animationDelay: `${index * 20}ms` }}
      translate="no"
    >
      <div className={`w-[3px] shrink-0 rounded-l-lg ${accent}`} />
      <div className="flex-1 px-2 py-1.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-300 dark:text-gray-600 tabular-nums w-3 shrink-0">
            {rank}
          </span>
          <span className="flex-1 text-[10px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors truncate">
            {symbol}
          </span>
          {right}
          <ChangeBar value={changeValue} />
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Explore News Modal ────────────────────────────────────────────────────────

function ExploreModal({ items, onClose }) {
  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden z-10 animate-modal-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">
              Market Intelligence
            </span>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-500 px-1.5 py-0.5 rounded-full font-semibold">
              {items.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="text-gray-400 text-[14px] leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-6">No data available yet</p>
          ) : (
            items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border-b border-gray-50 dark:border-gray-800 pb-3 last:border-0 last:pb-0"
              >
                <span className="text-[16px] shrink-0 mt-0.5">{item.icon || '📰'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {item.tag && (
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${item.tagColor || 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
                      >
                        {item.tag}
                      </span>
                    )}
                    {item.sentiment && (
                      <span
                        className={`text-[9px] font-semibold ${
                          item.sentiment === 'positive'
                            ? 'text-emerald-500'
                            : item.sentiment === 'negative'
                              ? 'text-red-400'
                              : 'text-yellow-500'
                        }`}
                      >
                        {item.sentiment === 'positive'
                          ? '● Bullish'
                          : item.sentiment === 'negative'
                            ? '● Bearish'
                            : '● Neutral'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 leading-snug">
                    {item.title || item.headline}
                  </p>
                  {item.summary && item.summary !== item.title && (
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug line-clamp-2">
                      {item.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {item.date && <span className="text-[10px] text-gray-400">{item.date}</span>}
                    {safeUrl(item.url) && (
                      <a
                        href={safeUrl(item.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline font-medium"
                      >
                        Source →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[10px] text-gray-400">SEBON · MeroShare · Sharesansar</p>
        </div>
      </div>
    </div>
  )
}

// ── Feed row ──────────────────────────────────────────────────────────────────

const TYPE_META = {
  ipo: { icon: '📢', tag: 'IPO', tagColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' },
  macro: { icon: '🏛️', tag: 'Macro', tagColor: 'bg-blue-100 dark:bg-blue-950 text-blue-500' },
  dividend: {
    icon: '💰',
    tag: 'Dividend',
    tagColor: 'bg-violet-100 dark:bg-violet-950 text-violet-500',
  },
  bonus: { icon: '🎁', tag: 'Bonus', tagColor: 'bg-orange-100 dark:bg-orange-950 text-orange-500' },
  corporate: {
    icon: '🏢',
    tag: 'Corporate',
    tagColor: 'bg-amber-100 dark:bg-amber-950 text-amber-500',
  },
  news: { icon: '📰', tag: 'News', tagColor: 'bg-gray-100 dark:bg-gray-800 text-gray-500' },
}

function FeedRow({ item, onClick }) {
  const meta = TYPE_META[item.type] || TYPE_META.news
  return (
    <div
      onClick={onClick}
      className="hp-alert-row flex items-start gap-2 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg px-1 -mx-1 transition-colors group"
    >
      <span className="text-[13px] shrink-0 mt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${meta.tagColor}`}>
            {meta.tag}
          </span>
          {item.sentiment && (
            <span
              className={`text-[9px] font-semibold ${
                item.sentiment === 'positive'
                  ? 'text-emerald-500'
                  : item.sentiment === 'negative'
                    ? 'text-red-400'
                    : 'text-yellow-500'
              }`}
            >
              {item.sentiment === 'positive' ? '▲' : item.sentiment === 'negative' ? '▼' : '~'}
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-700 dark:text-gray-300 leading-snug line-clamp-2 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
          {item.title || item.headline}
        </p>
        {item.sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.sub}</p>}
      </div>
    </div>
  )
}

// ── All Movers Modal — self-fetches full data for the date ────────────────────

function AllMoversModal({ date, onClose }) {
  const { selectSymbol } = useScreen()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEscapeKey(onClose)

  useEffect(() => {
    if (!date) return
    let cancelled = false
    getTopMovers(date)
      .then((r) => {
        if (!cancelled) setData(r.data)
      })
      .catch(() => {
        if (!cancelled) setErr('Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [date])

  const gainers = data?.gainers || []
  const losers = data?.losers || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col overflow-hidden z-10 animate-modal-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">
              All Movers
            </span>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">
              {date}
            </span>
            {data && (
              <>
                <span className="text-[9px] font-semibold text-emerald-500">
                  ▲ {gainers.length}
                </span>
                <span className="text-[9px] font-semibold text-red-400">▼ {losers.length}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
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
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">
                  Gainers ({gainers.length})
                </p>
                {gainers.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      selectSymbol(s.s)
                      onClose()
                    }}
                    className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 group"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-300 dark:text-gray-600 w-4 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
                        {s.s}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-500 tabular-nums">
                      +{s.p}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-3">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">
                  Losers ({losers.length})
                </p>
                {losers.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      selectSymbol(s.s)
                      onClose()
                    }}
                    className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-0.5 group"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-300 dark:text-gray-600 w-4 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
                        {s.s}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-red-400 tabular-nums">
                      {s.p}%
                    </span>
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
  if (!summary)
    return (
      <div className="space-y-2 py-1 animate-pulse">
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800/60 h-[88px]" />
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800/60 h-[72px]" />
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800/60 h-[120px]" />
      </div>
    )

  const { nepse, breadth, sectors } = summary

  return (
    <div className="space-y-2 py-1 animate-fade-up" translate="no">
      {/* NEPSE index card */}
      {nepse &&
        (() => {
          const isPos = nepse.per_change >= 0
          const ptChg = nepse.point_change
          return (
            <div
              className={`relative overflow-hidden rounded-xl pl-3 pr-2.5 py-2 border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${
                isPos ? 'before:bg-emerald-400' : 'before:bg-red-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  NEPSE Index
                </span>
                <span
                  className={`text-[10px] font-bold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {isPos ? '▲' : '▼'} {Math.abs(nepse.per_change ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-[15px] font-black text-gray-900 dark:text-white tabular-nums">
                  {(nepse.close ?? 0).toLocaleString('en-NP', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-[10px] font-semibold tabular-nums ${isPos ? 'text-emerald-500' : 'text-red-400'}`}
                >
                  {ptChg >= 0 ? '+' : ''}
                  {(ptChg ?? 0).toFixed(2)} pts
                </span>
              </div>
              <div className="grid grid-cols-3 gap-x-2">
                {[
                  ['Open', nepse.open],
                  ['High', nepse.high],
                  ['Low', nepse.low],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-[10px] text-gray-400 uppercase">{l}</p>
                    <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 tabular-nums">
                      {v?.toLocaleString('en-NP', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
              {nepse.turnover > 0 && (
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Turnover: Rs {(nepse.turnover / 1e8).toFixed(2)} Cr
                </p>
              )}
            </div>
          )
        })()}

      {/* Market breadth */}
      {breadth &&
        (() => {
          const advPct = breadth.total > 0 ? (breadth.advancing / breadth.total) * 100 : 0
          const decPct = breadth.total > 0 ? (breadth.declining / breadth.total) * 100 : 0
          return (
            <div className="rounded-xl px-2.5 py-2 border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Market Breadth
              </p>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {[
                  [breadth.advancing, 'Up', 'text-emerald-500'],
                  [breadth.declining, 'Down', 'text-red-400'],
                  [breadth.unchanged, 'Flat', 'text-gray-400'],
                ].map(([val, lbl, cls]) => (
                  <div key={lbl} className="text-center">
                    <p className={`text-[12px] font-bold ${cls}`}>{val}</p>
                    <p className="text-[10px] text-gray-400 uppercase">{lbl}</p>
                  </div>
                ))}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex">
                <div className="h-full bg-emerald-400" style={{ width: `${advPct}%` }} />
                <div className="h-full bg-red-400" style={{ width: `${decPct}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-emerald-500">{advPct.toFixed(0)}% adv.</span>
                {breadth.totalTurnover > 0 && (
                  <span className="text-[10px] text-gray-400">
                    Rs {(breadth.totalTurnover / 1e8).toFixed(1)} Cr
                  </span>
                )}
                <span className="text-[10px] text-gray-400">{breadth.total} traded</span>
              </div>
            </div>
          )
        })()}

      {/* Sectors */}
      {sectors?.length > 0 && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-2.5 pt-2 pb-1">
            Sectors
          </p>
          <table className="w-full">
            <tbody>
              {sectors.map((s) => {
                const isPos = s.per_change >= 0
                return (
                  <tr
                    key={s.index_id}
                    onClick={() => selectSymbol(s.name, s.index_id)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group border-b border-gray-50 dark:border-gray-800 last:border-0"
                  >
                    <td className="py-1 pl-2.5 pr-1">
                      <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors">
                        {s.short}
                      </span>
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

  const [dbMovers, setDbMovers] = useState(null)
  const [dbVolume, setDbVolume] = useState(null)
  const [summary, setSummary] = useState(null)
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [latestDate, setLatestDate] = useState('')
  const [moverTab, setMoverTab] = useState('summary')
  const moverTabIndicator = useSlidingIndicator(moverTab, setMoverTab)
  const [loading, setLoading] = useState(false)
  const [moversErr, setMoversErr] = useState(null)
  const [datesErr, setDatesErr] = useState(null)
  const [showAllMovers, setShowAllMovers] = useState(false)

  const [feedItems, setFeedItems] = useState([])
  const [feedLoaded, setFeedLoaded] = useState(false)
  const [feedErr, setFeedErr] = useState(null)
  const [showExplore, setShowExplore] = useState(false)

  // Client-side cache: date → { movers, volume, summary } — avoids re-fetching same date
  const dayCache = useRef({})
  const requestIdRef = useRef(0)

  const fetchForDate = useCallback(async (date) => {
    if (!date) return
    const requestId = ++requestIdRef.current
    if (dayCache.current[date]) {
      const c = dayCache.current[date]
      setDbMovers(c.movers)
      setDbVolume(c.volume)
      setSummary(c.summary)
      setLoading(false)
      return
    }
    setLoading(true)
    setMoversErr(null)
    setSummary(null)
    try {
      const r = await getDayFull(date)
      dayCache.current[date] = {
        movers: r.data.movers,
        volume: r.data.volume,
        summary: r.data.summary,
      }
      if (requestId !== requestIdRef.current) return
      setDbMovers(r.data.movers)
      setDbVolume(r.data.volume)
      setSummary(r.data.summary)
    } catch {
      if (requestId === requestIdRef.current) setMoversErr('Failed to load market data')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [])

  // On mount: fire both requests in parallel — getDayFull resolves latest date server-side
  // so we don't need to wait for /dates before fetching day data (eliminates waterfall)
  useEffect(() => {
    Promise.all([
      getMarketDates(),
      getDayFull(), // no date = server returns latest
    ])
      .then(([datesRes, dayRes]) => {
        const dates = datesRes.data?.dates ?? []
        const latestDate = datesRes.data?.latestDate ?? ''
        setDates(dates)
        setLatestDate(latestDate)
        setSelectedDate(latestDate)
        // Seed the cache with the day-full response so fetchForDate won't re-fetch it
        const d = dayRes.data.date
        if (d) {
          dayCache.current[d] = {
            movers: dayRes.data.movers,
            volume: dayRes.data.volume,
            summary: dayRes.data.summary,
          }
          setDbMovers(dayRes.data.movers)
          setDbVolume(dayRes.data.volume)
          setSummary(dayRes.data.summary)
        }
      })
      .catch(() => setDatesErr('Failed to load dates'))
  }, [])

  // Keep the auxiliary volume/summary data aligned with either the pinned candle
  // or the date navigator, including restoring the selected date after unpinning.
  useEffect(() => {
    const date = clickedMovers?.date || selectedDate
    if (!date) return
    fetchForDate(date)
  }, [clickedMovers?.date, selectedDate, fetchForDate])

  // Load news/IPO feed once
  useEffect(() => {
    if (feedLoaded) return
    getMarketFeed()
      .then(([ir, nr]) => {
        setFeedLoaded(true)
        const ipoItems = (ir.data.ipos || []).map((ipo) => ({
          type: 'ipo',
          title:
            ipo.title ||
            `${ipo.symbol || ipo.name}: ${ipo.status === 'open' ? 'Apply Now on MeroShare' : ipo.status}`,
          sub:
            ipo.openDate && ipo.closeDate
              ? `${ipo.openDate} → ${ipo.closeDate}`
              : ipo.price
                ? `Issue Price: Rs ${ipo.price}`
                : null,
          sentiment: ipo.status === 'open' ? 'positive' : 'neutral',
          date: ipo.closeDate,
          url: ipo.url,
          icon: '📢',
          tag: 'IPO',
          tagColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600',
        }))
        const newsItems = (nr.data.news || []).map((n) => ({
          type: n.type || 'news',
          title: n.title || n.headline,
          sub: n.symbol || null,
          sentiment: n.sentiment,
          date: n.date,
          url: n.url,
          summary: n.summary,
        }))
        setFeedItems([...ipoItems, ...newsItems])
      })
      .catch(() => {
        setFeedLoaded(true)
        setFeedErr('Failed to load market intel')
      })
  }, [feedLoaded])

  const isPinned = !!clickedMovers
  const activeDate = isPinned ? clickedMovers.date : selectedDate
  // Pinned movers come from chart cache (top 10); full list via AllMoversModal self-fetch
  const activeMovers = isPinned ? clickedMovers.movers : dbMovers
  const gainers = activeMovers?.gainers || []
  const losers = activeMovers?.losers || []
  const volData = dbVolume?.data || []
  const maxTurnover =
    volData.length > 0 && parseFloat(volData[0].t) > 0 ? parseFloat(volData[0].t) : 1

  const TAB_CONFIG = {
    summary: { label: 'Market', color: 'text-violet-500', dot: 'bg-violet-400' },
    gainers: { label: 'Gainers', color: 'text-emerald-500', dot: 'bg-emerald-400' },
    losers: { label: 'Losers', color: 'text-red-400', dot: 'bg-red-400' },
    volume: { label: 'Volume', color: 'text-blue-500', dot: 'bg-blue-400' },
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Date navigation ───────────────────────────────────────────────── */}
      <div className="px-2 pt-2 pb-1.5 shrink-0">
        {isPinned ? (
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl px-2.5 py-1.5">
            <span className="text-[11px]">📌</span>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex-1 truncate tabular-nums">
              {clickedMovers.date}
            </span>
            <button
              onClick={clearPin}
              className="text-[9px] font-bold text-blue-400 hover:text-red-400 transition-colors"
            >
              ✕ Unpin
            </button>
          </div>
        ) : datesErr ? (
          <p className="text-[10px] text-red-400 px-1">{datesErr}</p>
        ) : (
          <div className="relative flex items-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
            <button
              onClick={() => {
                const i = dates.indexOf(selectedDate)
                if (i < dates.length - 1) setSelectedDate(dates[i + 1])
              }}
              disabled={!dates.length || dates.indexOf(selectedDate) >= dates.length - 1}
              className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-blue-500 disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              ‹
            </button>
            {/* Absolutely centered on the full bar (not the flex-1 gap between the
              arrows) — the conditional Live button below only sits on the right
              side, so a flex-1-centered date used to drift left whenever Live was
              showing (owner-caught). This stays dead-center regardless. */}
            <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700 dark:text-gray-200 tabular-nums pointer-events-none">
              {selectedDate || '—'}
            </span>
            <div className="flex-1" />
            {selectedDate && selectedDate !== latestDate && (
              <button
                onClick={() => setSelectedDate(latestDate)}
                className="text-[9px] font-bold text-blue-500 px-1.5 shrink-0 hover:text-blue-600 transition-colors"
              >
                Live
              </button>
            )}
            <button
              onClick={() => {
                const i = dates.indexOf(selectedDate)
                if (i > 0) setSelectedDate(dates[i - 1])
              }}
              disabled={!selectedDate || selectedDate === latestDate}
              className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-blue-500 disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div
        ref={moverTabIndicator.containerRef}
        onPointerDown={moverTabIndicator.onPointerDown}
        className="relative flex gap-0.5 px-2 mb-2 shrink-0 bg-white/25 dark:bg-white/[0.06] backdrop-blur-sm rounded-xl p-0.5 border border-white/20 dark:border-white/[0.06]"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 rounded-lg bg-white dark:bg-gray-700/90 shadow-sm transition-[transform,width,height] duration-300 ease-luxury pointer-events-none"
          style={moverTabIndicator.indicatorStyle}
        />
        {Object.entries(TAB_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            data-indicator-active={moverTab === key || undefined}
            data-indicator-key={key}
            onClick={() => setMoverTab(key)}
            className={`relative z-10 flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
              moverTab === key
                ? cfg.color
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {moverTab === key && (
              <span className={`inline-block w-1 h-1 rounded-full ${cfg.dot} mr-1 mb-px`} />
            )}
            {cfg.label}
          </button>
        ))}
      </div>

      {/* ── Tab content — capped + independently scrollable (owner-caught: a tall
        Market/summary tab used to push Market Intel off-screen since the whole
        panel scrolled as one unit). max-h (not flex-1) so a SHORT list (e.g.
        10 gainers) sizes to its own content with no dead gap below it —
        flex-1 was claiming all remaining space regardless of content height,
        which owner also caught live. Tall content (Market tab) scrolls within
        the cap instead of growing past it; Market Intel sits immediately
        after whatever height this actually renders at. ── */}
      <div className="px-2 max-h-[45vh] overflow-y-auto shrink-0">
        {moverTab === 'summary' ? (
          <SummaryTab summary={summary} selectSymbol={selectSymbol} />
        ) : (
          <>
            {moversErr && !loading && !isPinned && (
              <p className="text-[10px] text-red-400 text-center py-2">{moversErr}</p>
            )}
            {loading && !isPinned ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-0.5">
                {moverTab === 'gainers' &&
                  gainers.slice(0, 10).map((s, i) => (
                    <MoverRow
                      key={s.s}
                      rank={i + 1}
                      symbol={s.s}
                      right={
                        <span className="text-[9px] text-gray-400 tabular-nums shrink-0">
                          {s.c?.toLocaleString()}
                        </span>
                      }
                      changeValue={s.p}
                      accent="bg-emerald-400"
                      onClick={() => selectSymbol(s.s)}
                      index={i}
                    />
                  ))}
                {moverTab === 'losers' &&
                  losers.slice(0, 10).map((s, i) => (
                    <MoverRow
                      key={s.s}
                      rank={i + 1}
                      symbol={s.s}
                      right={
                        <span className="text-[9px] text-gray-400 tabular-nums shrink-0">
                          {s.c?.toLocaleString()}
                        </span>
                      }
                      changeValue={s.p}
                      accent="bg-red-400"
                      onClick={() => selectSymbol(s.s)}
                      index={i}
                    />
                  ))}
                {moverTab === 'volume' &&
                  volData.slice(0, 10).map((s, i) => (
                    <MoverRow
                      key={s.s}
                      rank={i + 1}
                      symbol={s.s}
                      right={
                        <span className="text-[9px] text-gray-400 tabular-nums shrink-0 whitespace-nowrap">
                          {isNaN(parseFloat(s.t)) ? '—' : (parseFloat(s.t) / 1e6).toFixed(1) + 'M'}
                        </span>
                      }
                      changeValue={s.p}
                      accent="bg-blue-400"
                      onClick={() => selectSymbol(s.s)}
                      index={i}
                    >
                      <div className="ml-4 mt-1 h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all"
                          style={{ width: `${(parseFloat(s.t) / maxTurnover) * 100}%` }}
                        />
                      </div>
                    </MoverRow>
                  ))}
              </div>
            )}

            {/* Footer */}
            {!loading && (activeMovers || volData.length > 0) && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-semibold text-emerald-500">
                    ▲ {gainers.length}
                  </span>
                  <span className="text-[9px] font-semibold text-red-400">▼ {losers.length}</span>
                  {activeMovers?.total && (
                    <span className="text-[9px] text-gray-400">/ {activeMovers.total}</span>
                  )}
                </div>
                {moverTab !== 'volume' && (
                  <button
                    onClick={() => setShowAllMovers(true)}
                    className={`text-[9px] font-bold text-white px-2.5 py-1 rounded-lg transition-colors shadow-sm ${
                      moverTab === 'gainers'
                        ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
                        : 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                    }`}
                  >
                    All →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-white/[0.07] mx-2 my-1.5 shrink-0" />

      {/* ── Market Intel feed ─────────────────────────────────────────────── */}
      <div className="px-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-violet-400" />
            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
              Market Intel
            </span>
          </div>
          {feedItems.length > 0 && (
            <span className="text-[9px] bg-violet-100 dark:bg-violet-900/40 text-violet-500 px-1.5 py-0.5 rounded-full font-semibold">
              {feedItems.length}
            </span>
          )}
        </div>

        {feedErr ? (
          <p className="text-[10px] text-red-400 py-2 text-center">{feedErr}</p>
        ) : !feedLoaded ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedItems.length === 0 ? (
          <p className="text-[10px] text-gray-400 py-2 text-center">No data available</p>
        ) : (
          <>
            {feedItems.slice(0, 4).map((item, i) => (
              <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <FeedRow item={item} onClick={() => setShowExplore(true)} />
              </div>
            ))}
            <button
              onClick={() => setShowExplore(true)}
              disabled={showExplore}
              className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border border-violet-100 dark:border-violet-800/40 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:from-violet-100 hover:to-blue-100 dark:hover:from-violet-950/50 dark:hover:to-blue-950/50 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>🔗</span> View All {feedItems.length} Updates
            </button>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="h-3 shrink-0" />

      {/* ── Modals — portalled to body to escape backdrop-blur stacking context ── */}
      {showAllMovers &&
        createPortal(
          <AllMoversModal date={activeDate} onClose={() => setShowAllMovers(false)} />,
          document.body
        )}
      {showExplore &&
        createPortal(
          <ExploreModal items={feedItems} onClose={() => setShowExplore(false)} />,
          document.body
        )}
    </div>
  )
}
