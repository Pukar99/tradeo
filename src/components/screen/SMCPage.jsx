import { useState, useEffect, useRef, useCallback } from 'react'
import { getSMCScan } from '../../api'
import { getMarketSymbols } from '../../utils/globalCache'
import { fmt } from '../../utils/format'

// ── Inline symbol search (stock-only, not tied to ScreenContext) ─────────────

function SMCSymbolSearch({ value, onChange }) {
  const [query,   setQuery]   = useState(value || '')
  const [open,    setOpen]    = useState(false)
  const [items,   setItems]   = useState([])
  const [cursor,  setCursor]  = useState(-1)
  const mouseDownInList       = useRef(false)
  const listRef               = useRef(null)

  useEffect(() => {
    getMarketSymbols()
      .then(r => setItems(r.data.stocks.map(s => ({ symbol: s.symbol, company_name: s.company_name || null }))))
      .catch(() => {})
  }, [])

  const q = query.toLowerCase()
  const filtered = query.length < 1
    ? items.slice(0, 20)
    : items.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        (s.company_name && s.company_name.toLowerCase().includes(q))
      ).slice(0, 30)

  function select(item) {
    setQuery(item.symbol)
    setOpen(false)
    setCursor(-1)
    onChange(item.symbol)
  }

  function handleKey(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && cursor >= 0) select(filtered[cursor])
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      listRef.current.children[cursor]?.scrollIntoView({ block: 'nearest' })
    }
  }, [cursor])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!mouseDownInList.current) setOpen(false) }}
          onKeyDown={handleKey}
          placeholder="Symbol (e.g. NABIL)"
          className="bg-transparent text-[12px] text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-40"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-52 overflow-y-auto w-48">
          <ul ref={listRef}>
            {filtered.map((s, i) => (
              <li
                key={s.symbol}
                onMouseDown={() => { mouseDownInList.current = true; select(s); mouseDownInList.current = false }}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${
                  i === cursor
                    ? 'bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">{s.symbol}</div>
                {s.company_name && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight truncate">{s.company_name}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, bullish, bearish }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-1.5">
      <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
          {count}
        </span>
      )}
      {bullish !== undefined && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
          {bullish} bull
        </span>
      )}
      {bearish !== undefined && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          {bearish} bear
        </span>
      )}
    </div>
  )
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function typeBull(t) { return t === 'bullish' || t === 'buy_side' }

function BullBear({ type }) {
  const bull = typeBull(type)
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
      bull
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    }`}>
      {bull ? '▲' : '▼'} {type.replace('_', ' ')}
    </span>
  )
}

// ── Tables ────────────────────────────────────────────────────────────────────

function OBTable({ data }) {
  if (!data.length) return <EmptySection />
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <th className="text-left py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Date</th>
          <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">Type</th>
          <th className="text-right py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">High</th>
          <th className="text-right py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">Low</th>
          <th className="text-right py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Vol</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
        {data.slice(-6).reverse().map((ob, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className="py-1.5 px-4 text-gray-500 dark:text-gray-400 tabular-nums">{ob.date}</td>
            <td className="py-1.5 px-2"><BullBear type={ob.type} /></td>
            <td className="py-1.5 px-2 text-right font-mono text-gray-700 dark:text-gray-200">{fmt(ob.high)}</td>
            <td className="py-1.5 px-2 text-right font-mono text-gray-700 dark:text-gray-200">{fmt(ob.low)}</td>
            <td className="py-1.5 px-4 text-right text-gray-400 tabular-nums">{Math.round(ob.ob_volume || 0).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FVGTable({ data }) {
  const active = data.filter(g => !g.mitigated)
  if (!active.length) return <EmptySection label="No active FVGs" />
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <th className="text-left py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Date</th>
          <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">Type</th>
          <th className="text-right py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">Top</th>
          <th className="text-right py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Bottom</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
        {active.slice(-5).reverse().map((g, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className="py-1.5 px-4 text-gray-500 dark:text-gray-400 tabular-nums">{g.date}</td>
            <td className="py-1.5 px-2"><BullBear type={g.type} /></td>
            <td className="py-1.5 px-2 text-right font-mono text-gray-700 dark:text-gray-200">{fmt(g.top)}</td>
            <td className="py-1.5 px-4 text-right font-mono text-gray-700 dark:text-gray-200">{fmt(g.bottom)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BOSTable({ data }) {
  if (!data.length) return <EmptySection />
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <th className="text-left py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Date</th>
          <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">Direction</th>
          <th className="text-right py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Level</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
        {data.slice(-8).reverse().map((b, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className="py-1.5 px-4 text-gray-500 dark:text-gray-400 tabular-nums">{b.date}</td>
            <td className="py-1.5 px-2"><BullBear type={b.type} /></td>
            <td className="py-1.5 px-4 text-right font-mono text-gray-700 dark:text-gray-200">{fmt(b.level)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SweepsTable({ data }) {
  if (!data.length) return <EmptySection />
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <th className="text-left py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Date</th>
          <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">Side</th>
          <th className="text-right py-1.5 px-4 text-[10px] font-semibold text-gray-400 uppercase">Level</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
        {data.slice(-5).reverse().map((s, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className="py-1.5 px-4 text-gray-500 dark:text-gray-400 tabular-nums">{s.date}</td>
            <td className="py-1.5 px-2"><BullBear type={s.type} /></td>
            <td className="py-1.5 px-4 text-right font-mono text-gray-700 dark:text-gray-200">{fmt(s.level)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EmptySection({ label = 'None detected' }) {
  return (
    <p className="px-4 py-3 text-[11px] text-gray-400 dark:text-gray-500 italic">{label}</p>
  )
}

// ── Main SMCPage ──────────────────────────────────────────────────────────────

export default function SMCPage() {
  const [symbol, setSymbol] = useState('NABIL')
  const [days,   setDays]   = useState('250')
  const [data,   setData]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const scan = useCallback(async (sym, d) => {
    if (!sym) return
    setLoading(true)
    setError('')
    try {
      const res = await getSMCScan({ symbol: sym, days: parseInt(d) || 250 })
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Scan failed')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-scan on mount with default symbol
  useEffect(() => { scan(symbol, days) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleScan() { scan(symbol, days) }

  const ob     = data?.order_blocks || []
  const fvg    = data?.fvg          || []
  const bos    = data?.bos          || []
  const choch  = data?.choch        || []
  const sweeps = data?.sweeps       || []

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-gray-950">

      {/* ── Controls bar ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <SMCSymbolSearch value={symbol} onChange={setSymbol} />

        <select
          value={days}
          onChange={e => setDays(e.target.value)}
          className="px-2 py-1.5 text-[11px] border border-gray-200 dark:border-gray-700 rounded-lg
                     bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none"
        >
          <option value="100">100 days</option>
          <option value="250">250 days</option>
          <option value="500">500 days</option>
        </select>

        <button
          onClick={handleScan}
          disabled={loading}
          className="px-3 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Scanning…' : 'Scan'}
        </button>

        {data && !loading && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {data.symbol} · {data.candles} candles
          </span>
        )}

        {error && (
          <span className="text-[11px] text-red-500">{error}</span>
        )}
      </div>

      {/* ── Results ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && !data && !error && (
        <div className="flex-1 flex items-center justify-center text-[12px] text-gray-400">
          Enter a symbol and click Scan
        </div>
      )}

      {!loading && data && (
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* 2-column grid on wider screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800">

            {/* Left column */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">

              {/* Order Blocks */}
              <div>
                <SectionHeader
                  label="Order Blocks"
                  bullish={ob.filter(o => o.type === 'bullish').length}
                  bearish={ob.filter(o => o.type === 'bearish').length}
                />
                <OBTable data={ob} />
              </div>

              {/* FVG */}
              <div>
                <SectionHeader
                  label="Fair Value Gaps"
                  count={fvg.filter(g => !g.mitigated).length}
                />
                <FVGTable data={fvg} />
              </div>
            </div>

            {/* Right column */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">

              {/* BOS */}
              <div>
                <SectionHeader
                  label="Break of Structure"
                  bullish={bos.filter(b => b.type === 'bullish').length}
                  bearish={bos.filter(b => b.type === 'bearish').length}
                />
                <BOSTable data={bos} />
              </div>

              {/* CHoCH */}
              <div>
                <SectionHeader
                  label="Change of Character"
                  count={choch.length}
                />
                <BOSTable data={choch} />
              </div>

              {/* Sweeps */}
              <div>
                <SectionHeader
                  label="Liquidity Sweeps"
                  count={sweeps.length}
                />
                <SweepsTable data={sweeps} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
