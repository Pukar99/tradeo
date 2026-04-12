import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { getTopVolume } from '../../api'
import { useAnalysis } from '../../context/AnalysisContext'

// ── Mini sparkline bar ────────────────────────────────────────────────────────
function ChangeBar({ value }) {
  const v = parseFloat(value) || 0
  const isPos = v >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
      isPos ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : 'bg-red-50 dark:bg-red-950 text-red-500'
    }`}>
      {isPos ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}

// ── Mover row ─────────────────────────────────────────────────────────────────
function MoverRow({ item, selectSymbol, rank }) {
  return (
    <tr
      onClick={() => selectSymbol(item.s)}
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
    >
      <td className="py-1.5 pr-1">
        <span className="text-[7px] text-gray-300 dark:text-gray-600 w-3 inline-block">{rank}</span>
      </td>
      <td className="py-1.5">
        <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
          {item.s}
        </span>
      </td>
      <td className="py-1.5 text-right text-[9px] text-gray-500 dark:text-gray-400">
        {item.c?.toLocaleString()}
      </td>
      <td className="py-1.5 text-right">
        <ChangeBar value={item.p} />
      </td>
    </tr>
  )
}

// ── Volume row ────────────────────────────────────────────────────────────────
function VolumeRow({ item, selectSymbol, rank, maxTurnover }) {
  const pct = maxTurnover ? (item.t / maxTurnover) * 100 : 0
  return (
    <tr
      onClick={() => selectSymbol(item.s)}
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
    >
      <td className="py-1.5 pr-1">
        <span className="text-[7px] text-gray-300 dark:text-gray-600 w-3 inline-block">{rank}</span>
      </td>
      <td className="py-1.5">
        <div>
          <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
            {item.s}
          </span>
          <div className="h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-0.5 overflow-hidden w-full">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </td>
      <td className="py-1.5 text-right text-[9px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {(item.t / 1e6).toFixed(1)}M
      </td>
      <td className="py-1.5 text-right">
        <ChangeBar value={item.p} />
      </td>
    </tr>
  )
}

// ── AI Report card ────────────────────────────────────────────────────────────
function AIReportCard() {
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)

  const generate = async () => {
    if (report) { setOpen(o => !o); return }
    setLoading(true)
    setOpen(true)
    try {
      const r = await axios.get('http://localhost:5000/api/market/ai-report')
      setReport(r.data)
    } catch {
      setReport({ summary: 'AI report unavailable. Check backend connection.', sentiment: 'neutral' })
    } finally {
      setLoading(false)
    }
  }

  const sentimentColor = {
    bullish:  'text-emerald-500',
    bearish:  'text-red-400',
    neutral:  'text-yellow-500',
    cautious: 'text-orange-400',
  }[report?.sentiment] || 'text-gray-400'

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={generate}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/40 dark:to-blue-950/40 hover:from-violet-100 dark:hover:from-violet-900/40 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">✦</span>
          <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">AI Market Report</span>
        </div>
        <div className="flex items-center gap-1.5">
          {report && (
            <span className={`text-[8px] font-semibold uppercase ${sentimentColor}`}>{report.sentiment}</span>
          )}
          {loading
            ? <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            : <span className="text-[9px] text-gray-400">{open ? '▲' : '▼'}</span>
          }
        </div>
      </button>

      {/* Body */}
      {open && !loading && report && (
        <div className="px-3 py-2.5 bg-white dark:bg-gray-900 space-y-2">
          <p className="text-[10px] leading-relaxed text-gray-600 dark:text-gray-400">{report.summary}</p>

          {report.keyPoints?.length > 0 && (
            <ul className="space-y-1">
              {report.keyPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[9px] text-gray-600 dark:text-gray-400">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}

          {report.generatedAt && (
            <p className="text-[8px] text-gray-300 dark:text-gray-700">
              Generated: {new Date(report.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}

      {open && !loading && !report && (
        <div className="px-3 py-2 text-[10px] text-gray-400">Loading...</div>
      )}
    </div>
  )
}

// ── IPO section ───────────────────────────────────────────────────────────────
function IPOSection() {
  const [ipos, setIpos]   = useState(null)
  const [open, setOpen]   = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    setOpen(o => !o)
    if (loaded) return
    setLoaded(true)
    try {
      const r = await axios.get('http://localhost:5000/api/market/ipos')
      setIpos(r.data.ipos || [])
    } catch {
      setIpos([])
    }
  }

  const statusColor = {
    open:     'bg-emerald-100 dark:bg-emerald-950 text-emerald-600',
    upcoming: 'bg-blue-100 dark:bg-blue-950 text-blue-500',
    closed:   'bg-gray-100 dark:bg-gray-800 text-gray-400',
    result:   'bg-violet-100 dark:bg-violet-950 text-violet-500',
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 hover:from-emerald-100 dark:hover:from-emerald-900/30 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">◈</span>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">IPO / FPO</span>
        </div>
        {ipos !== null && (
          <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold">
            {ipos.length}
          </span>
        )}
        <span className="text-[9px] text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 py-2 bg-white dark:bg-gray-900 space-y-2">
          {!ipos ? (
            <div className="text-[10px] text-gray-400 py-2 text-center">Loading...</div>
          ) : ipos.length === 0 ? (
            <p className="text-[10px] text-gray-400 py-2 text-center">No active IPOs</p>
          ) : (
            ipos.map((ipo, i) => (
              <div key={i} className="border-b border-gray-50 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100">{ipo.symbol || ipo.name}</span>
                  <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusColor[ipo.status] || statusColor.closed}`}>
                    {ipo.status}
                  </span>
                </div>
                {ipo.price && (
                  <p className="text-[9px] text-gray-500">Issue Price: <span className="font-medium text-gray-700 dark:text-gray-300">Rs {ipo.price}</span></p>
                )}
                {(ipo.openDate || ipo.closeDate) && (
                  <p className="text-[8px] text-gray-400 mt-0.5">
                    {ipo.openDate} → {ipo.closeDate}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Market News ───────────────────────────────────────────────────────────────
function NewsSection() {
  const [news, setNews]   = useState(null)
  const [open, setOpen]   = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    setOpen(o => !o)
    if (loaded) return
    setLoaded(true)
    try {
      const r = await axios.get('http://localhost:5000/api/market/news')
      setNews(r.data.news || [])
    } catch {
      setNews([])
    }
  }

  const categoryColor = {
    'policy':    'bg-blue-100 dark:bg-blue-950 text-blue-500',
    'economy':   'bg-violet-100 dark:bg-violet-950 text-violet-500',
    'corporate': 'bg-orange-100 dark:bg-orange-950 text-orange-500',
    'market':    'bg-teal-100 dark:bg-teal-950 text-teal-500',
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 hover:from-amber-100 dark:hover:from-amber-900/30 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">◉</span>
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Market News</span>
        </div>
        <span className="text-[9px] text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 py-2 bg-white dark:bg-gray-900 space-y-2.5 max-h-48 overflow-y-auto">
          {!news ? (
            <div className="text-[10px] text-gray-400 py-2 text-center">Loading...</div>
          ) : news.length === 0 ? (
            <p className="text-[10px] text-gray-400 py-2 text-center">No news available</p>
          ) : (
            news.map((item, i) => (
              <div key={i} className="border-b border-gray-50 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                <div className="flex items-start gap-1.5 mb-0.5">
                  {item.category && (
                    <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded shrink-0 mt-0.5 ${categoryColor[item.category] || 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                      {item.category}
                    </span>
                  )}
                  <a
                    href={item.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500 leading-snug line-clamp-2"
                    onClick={e => { if (!item.url) e.preventDefault() }}
                  >
                    {item.title}
                  </a>
                </div>
                {item.date && <p className="text-[8px] text-gray-400">{item.date}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main RightPanel ───────────────────────────────────────────────────────────
export default function RightPanel() {
  const { selectSymbol } = useAnalysis()
  const [movers, setMovers]   = useState(null)
  const [volume, setVolume]   = useState(null)
  const [dates, setDates]     = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [latestDate, setLatestDate]     = useState('')
  const [moverTab, setMoverTab]         = useState('gainers')  // 'gainers' | 'losers' | 'volume'
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    axios.get('http://localhost:5000/api/market/dates')
      .then(r => {
        setDates(r.data.dates)
        setLatestDate(r.data.latestDate)
        setSelectedDate(r.data.latestDate)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    Promise.all([
      axios.get(`http://localhost:5000/api/market/top-movers?date=${selectedDate}`),
      getTopVolume({ limit: 10, date: selectedDate }),
    ])
      .then(([mr, vr]) => {
        setMovers(mr.data)
        setVolume(vr.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedDate])

  const gainers = movers?.gainers || []
  const losers  = movers?.losers  || []
  const volData = volume?.data    || []
  const maxTurnover = volData.length > 0 ? volData[0].t : 1

  const isLatest = selectedDate === latestDate

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">

      {/* ── Date selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {!isLatest && (
          <button
            onClick={() => setSelectedDate(latestDate)}
            className="text-[9px] font-semibold text-blue-500 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-2 py-1.5 rounded-lg whitespace-nowrap hover:bg-blue-100 transition-colors"
          >
            Latest
          </button>
        )}
      </div>

      {/* ── Movers/Volume tab bar ──────────────────────────────────────────── */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-0.5 shrink-0">
        {[
          ['gainers', `▲ ${gainers.length}`],
          ['losers',  `▼ ${losers.length}`],
          ['volume',  '⊙ Vol'],
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
      <div className="flex-shrink-0">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-[7px] text-gray-300 dark:text-gray-600 pb-1 w-4">#</th>
                <th className="text-left text-[8px] text-gray-400 pb-1">Symbol</th>
                <th className="text-right text-[8px] text-gray-400 pb-1">
                  {moverTab === 'volume' ? 'Turnover' : 'Close'}
                </th>
                <th className="text-right text-[8px] text-gray-400 pb-1">Chg%</th>
              </tr>
            </thead>
            <tbody>
              {moverTab === 'gainers' && gainers.slice(0, 10).map((s, i) => (
                <MoverRow key={i} item={s} selectSymbol={selectSymbol} rank={i + 1} />
              ))}
              {moverTab === 'losers' && losers.slice(0, 10).map((s, i) => (
                <MoverRow key={i} item={s} selectSymbol={selectSymbol} rank={i + 1} />
              ))}
              {moverTab === 'volume' && volData.slice(0, 10).map((s, i) => (
                <VolumeRow key={i} item={s} selectSymbol={selectSymbol} rank={i + 1} maxTurnover={maxTurnover} />
              ))}
            </tbody>
          </table>
        )}

        {/* Market summary footer */}
        {movers && !loading && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800">
            <span className="text-[8px] text-gray-400">{movers.total} stocks traded</span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-emerald-500">▲ {gainers.length}</span>
              <span className="text-[8px] text-red-400">▼ {losers.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* ── AI Market Report ──────────────────────────────────────────────── */}
      <AIReportCard />

      {/* ── IPO / FPO ─────────────────────────────────────────────────────── */}
      <IPOSection />

      {/* ── Market News ───────────────────────────────────────────────────── */}
      <NewsSection />

    </div>
  )
}
