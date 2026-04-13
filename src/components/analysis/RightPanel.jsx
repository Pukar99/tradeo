import { useState, useEffect } from 'react'
import { getTopVolume, getMarketDates, getTopMovers, getAIReport, getIPOs, getMarketNews } from '../../api'
import { useAnalysis } from '../../context/AnalysisContext'

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
  const all = items.slice(0, 10)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">Market Intelligence</span>
            <span className="text-[8px] bg-blue-100 dark:bg-blue-950 text-blue-500 px-1.5 py-0.5 rounded-full font-semibold">{all.length} items</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="text-gray-400 text-[14px] leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {all.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-6">No data available yet</p>
          ) : all.map((item, i) => (
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
                      {item.sentiment === 'positive' ? '● Positive' : item.sentiment === 'negative' ? '● Negative' : '● Neutral'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 leading-snug">{item.title || item.headline}</p>
                {item.summary && (
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-snug">{item.summary}</p>
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
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[9px] text-gray-400">Data sourced from SEBON, MeroShare & Sharesansar</p>
        </div>
      </div>
    </div>
  )
}

// ── Feed row types ────────────────────────────────────────────────────────────

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
          <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded ${meta.tagColor}`}>
            {meta.tag}
          </span>
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
        {item.sub && (
          <p className="text-[8px] text-gray-400 mt-0.5 truncate">{item.sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Main RightPanel ───────────────────────────────────────────────────────────

export default function RightPanel() {
  const { selectSymbol } = useAnalysis()
  const [movers, setMovers]         = useState(null)
  const [volume, setVolume]         = useState(null)
  const [dates, setDates]           = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [latestDate, setLatestDate]     = useState('')
  const [moverTab, setMoverTab]         = useState('gainers')
  const [loading, setLoading]           = useState(false)

  // News/IPO feed state
  const [feedItems, setFeedItems]   = useState([])
  const [feedLoaded, setFeedLoaded] = useState(false)
  const [showExplore, setShowExplore] = useState(false)

  // Load dates once
  useEffect(() => {
    getMarketDates()
      .then(r => {
        setDates(r.data.dates)
        setLatestDate(r.data.latestDate)
        setSelectedDate(r.data.latestDate)
      })
      .catch(() => {})
  }, [])

  // Load movers + volume when date changes
  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    Promise.all([
      getTopMovers(selectedDate),
      getTopVolume({ limit: 10, date: selectedDate }),
    ])
      .then(([mr, vr]) => {
        setMovers(mr.data)
        setVolume(vr.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedDate])

  // Load IPO + news feed (once, lazy)
  useEffect(() => {
    if (feedLoaded) return
    setFeedLoaded(true)
    Promise.all([getIPOs(), getMarketNews()])
      .then(([ir, nr]) => {
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
      .catch(() => {})
  }, [feedLoaded])

  const gainers   = movers?.gainers || []
  const losers    = movers?.losers  || []
  const volData   = volume?.data    || []
  const maxTurnover = volData.length > 0 ? volData[0].t : 1
  const isLatest  = selectedDate === latestDate

  const visibleFeed = feedItems.slice(0, 4)

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Date selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 shrink-0">
        <select
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[9px] text-gray-700 dark:text-gray-300 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {!isLatest && (
          <button
            onClick={() => setSelectedDate(latestDate)}
            className="text-[8px] font-semibold text-blue-500 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-1.5 py-1 rounded-lg whitespace-nowrap hover:bg-blue-100 transition-colors"
          >
            Latest
          </button>
        )}
      </div>

      {/* ── Movers tab bar ────────────────────────────────────────────────── */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 mx-2 mb-1.5 shrink-0">
        {[
          ['gainers', `▲ ${gainers.length}`],
          ['losers',  `▼ ${losers.length}`],
          ['volume',  '⊙'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMoverTab(key)}
            className={`flex-1 py-1 rounded-lg text-[8px] font-semibold transition-colors ${
              moverTab === key
                ? key === 'gainers'
                  ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm'
                  : key === 'losers'
                    ? 'bg-white dark:bg-gray-700 text-red-500 shadow-sm'
                    : 'bg-white dark:bg-gray-700 text-blue-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Table area ────────────────────────────────────────────────────── */}
      <div className="px-2 shrink-0">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[7px] text-gray-300 dark:text-gray-600 pb-1 w-4">#</th>
                <th className="text-left text-[7px] text-gray-400 pb-1">Sym</th>
                <th className="text-right text-[7px] text-gray-400 pb-1">
                  {moverTab === 'volume' ? 'Turn.' : 'Close'}
                </th>
                <th className="text-right text-[7px] text-gray-400 pb-1">Chg%</th>
              </tr>
            </thead>
            <tbody translate="no">
              {moverTab === 'gainers' && gainers.slice(0, 10).map((s, i) => (
                <tr key={i} onClick={() => selectSymbol(s.s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
                  <td className="py-1 pr-1 text-[7px] text-gray-300 dark:text-gray-600">{i + 1}</td>
                  <td className="py-1 text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</td>
                  <td className="py-1 text-right text-[8px] text-gray-500">{s.c?.toLocaleString()}</td>
                  <td className="py-1 text-right"><ChangeBar value={s.p} /></td>
                </tr>
              ))}
              {moverTab === 'losers' && losers.slice(0, 10).map((s, i) => (
                <tr key={i} onClick={() => selectSymbol(s.s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
                  <td className="py-1 pr-1 text-[7px] text-gray-300 dark:text-gray-600">{i + 1}</td>
                  <td className="py-1 text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</td>
                  <td className="py-1 text-right text-[8px] text-gray-500">{s.c?.toLocaleString()}</td>
                  <td className="py-1 text-right"><ChangeBar value={s.p} /></td>
                </tr>
              ))}
              {moverTab === 'volume' && volData.slice(0, 10).map((s, i) => (
                <tr key={i} onClick={() => selectSymbol(s.s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
                  <td className="py-1 pr-1 text-[7px] text-gray-300 dark:text-gray-600">{i + 1}</td>
                  <td className="py-1">
                    <div>
                      <span className="text-[9px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">{s.s}</span>
                      <div className="h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-0.5 overflow-hidden w-full">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(s.t / maxTurnover) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-1 text-right text-[8px] text-gray-500 whitespace-nowrap">{(s.t / 1e6).toFixed(1)}M</td>
                  <td className="py-1 text-right"><ChangeBar value={s.p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {movers && !loading && (
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-50 dark:border-gray-800">
            <span className="text-[7px] text-gray-400">{movers.total} stocks</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[7px] text-emerald-500">▲ {gainers.length}</span>
              <span className="text-[7px] text-red-400">▼ {losers.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-gray-800 mx-2 my-2" />

      {/* ── Market Intelligence Feed ──────────────────────────────────────── */}
      <div className="px-2 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Market Intel</span>
          {feedItems.length > 0 && (
            <span className="text-[7px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">{feedItems.length}</span>
          )}
        </div>

        {feedItems.length === 0 && feedLoaded ? (
          <p className="text-[9px] text-gray-400 py-2 text-center">No data available</p>
        ) : feedItems.length === 0 ? (
          <div className="flex items-center justify-center py-3">
            <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            {visibleFeed.map((item, i) => (
              <FeedRow key={i} item={item} onClick={() => setShowExplore(true)} />
            ))}
          </div>
        )}

        <button
          onClick={() => setShowExplore(true)}
          className="w-full mt-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-[9px] font-semibold text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-1"
        >
          <span>🔗</span> Explore All
        </button>
      </div>

      {/* ── Explore Modal ─────────────────────────────────────────────────── */}
      {showExplore && (
        <ExploreModal
          items={feedItems}
          onClose={() => setShowExplore(false)}
        />
      )}

    </div>
  )
}
