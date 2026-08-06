// === LogsPage.jsx — logs page: Trades / Market / Stats tabs, shared toolbar, position fetch, chat refresh ===
import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getMarketJournals, autoCreateMarketJournal } from '../api'
import { today } from '../utils/format'
import {
  getBatchPrices,
  getPositions,
  clearEligibilityCache,
  clearPositionsCache,
} from '../utils/globalCache'
import { useChatRefresh } from '../utils/chatEvents'
import { PERF_RANGES } from '../components/logs/tradeConstants'
import {
  useCompactToolbar,
  ToolbarMenu,
  ToolbarMenuSection,
} from '../components/screen/ScreenToolbarAtoms'

import TradeActionsTab from '../components/logs/TradeActionsTab'
import AuditTab from '../components/logs/AuditTab'
const MarketJournalTab = lazy(() => import('../components/logs/MarketJournalTab'))

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const TABS = [
  { key: 'trades', label: 'Trades' },
  { key: 'market', label: 'Market' },
  { key: 'audit', label: 'Stats' },
]

// Legacy deep links: the old Stats tab merged into the audit tab (now labeled "Stats")
function resolveTabParam(t) {
  if (t === 'stats') return 'audit'
  return TABS.some((tab) => tab.key === t) ? t : null
}

export default function LogsPage() {
  const [positions, setPositions] = useState([])
  const [ltpMap, setLtpMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(
    () => resolveTabParam(searchParams.get('tab')) || 'trades'
  )
  // Sync tab if searchParams changes while component is already mounted (back/forward nav)
  const prevTabParam = useRef(searchParams.get('tab'))
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t !== prevTabParam.current) {
      prevTabParam.current = t
      const resolved = resolveTabParam(t)
      if (resolved) setActiveTab(resolved)
    }
  }, [searchParams])
  const [error, setError] = useState(null)

  // Tab click — keep the URL in sync so refresh/share restores the right tab
  const handleTabChange = useCallback(
    (key) => {
      setActiveTab(key)
      prevTabParam.current = key
      setSearchParams(key === 'trades' ? {} : { tab: key }, { replace: true })
    },
    [setSearchParams]
  )

  // Shared log view — persists across Trades + Market tabs
  const [view, setView] = useState('database')
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [addModal, setAddModal] = useState(false)

  // Stats tab filters
  const [auditRange, setAuditRange] = useState('1M')
  const [auditSymbol, setAuditSymbol] = useState('all')
  const [auditSymbols, setAuditSymbols] = useState([])
  const [auditShareOpen, setAuditShareOpen] = useState(false)

  const compact = useCompactToolbar()

  // Market-tab state — only loaded when user first opens the Market tab
  const [marketJournals, setMarketJournals] = useState([])
  const [marketJournalLoaded, setMarketJournalLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await getPositions()
      const allPositions = res.data || []
      setPositions(allPositions)

      const openSymbols = [
        ...new Set(allPositions.filter((p) => p.status !== 'CLOSED').map((p) => p.symbol)),
      ]
      if (openSymbols.length > 0) {
        try {
          const batchRes = await getBatchPrices(openSymbols)
          const prices = batchRes.data.prices || {}
          const map = {}
          for (const sym of openSymbols) {
            if (prices[sym]) map[sym] = prices[sym].price
          }
          setLtpMap(map)
        } catch {
          /* prices unavailable */
        }
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load positions. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMarketJournals = useCallback(async () => {
    try {
      // Auto-create/refresh today's entry, then load all entries.
      // (No historical backfill: the backend always writes the latest trading
      // date, so per-date backfill calls are no-ops that only burn rate limit.)
      await autoCreateMarketJournal(today())
      const journalsRes = await getMarketJournals()
      setMarketJournals(journalsRes.data || [])
    } catch (err) {
      console.error('[fetchMarketJournals]', err?.message)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])
  // Defer market journal load until the Market tab is first opened
  useEffect(() => {
    if (activeTab === 'market' && !marketJournalLoaded) {
      setMarketJournalLoaded(true)
      fetchMarketJournals()
    }
  }, [activeTab, marketJournalLoaded, fetchMarketJournals])

  const handleRefresh = useCallback(() => {
    clearEligibilityCache()
    clearPositionsCache()
    fetchData()
  }, [fetchData])

  // Chat-driven trade writes must invalidate the positions cache before
  // re-fetching — fetchData alone would serve the 30s-cached pre-write list.
  useChatRefresh(['trades'], handleRefresh)

  const handleMarketJournalSaved = useCallback((updated) => {
    setMarketJournals((prev) => prev.map((e) => (e.date === updated.date ? updated : e)))
  }, [])

  const allSymbols = useMemo(() => {
    const seen = new Set()
    positions.forEach((p) => seen.add(p.symbol))
    return [...seen]
  }, [positions])

  if (loading)
    return (
      <div className="flex flex-col h-[calc(100dvh-56px)] overflow-hidden bg-gray-50 dark:bg-gray-950 animate-pulse">
        {/* Toolbar skeleton */}
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-9">
          <div className="h-6 w-32 sm:w-48 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0" />
          <div className="hidden sm:block w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />
          <div className="hidden sm:block h-6 w-44 bg-gray-100 dark:bg-gray-800 rounded-md shrink-0" />
          <div className="hidden sm:block w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />
          <div className="hidden sm:block h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-md shrink-0" />
          <div className="hidden sm:block h-6 w-[140px] bg-gray-100 dark:bg-gray-800 rounded shrink-0" />
          {/* mobile-only ☰ menu placeholder */}
          <div className="sm:hidden h-6 w-7 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0" />
          <div className="flex-1" />
          <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-md shrink-0" />
        </div>
        {/* Position row skeletons */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="mb-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
                  <div className="h-4 w-10 bg-gray-100 dark:bg-gray-800 rounded-full" />
                  <div className="h-4 w-12 bg-gray-100 dark:bg-gray-800 rounded-full" />
                </div>
                <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j}>
                    <div className="h-3 w-12 bg-gray-100 dark:bg-gray-800 rounded mb-1" />
                    <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )

  // Shared view toggle (Database/Gallery) — inline on desktop, inside the ☰ menu on mobile
  const viewToggle = (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
      {[
        { key: 'database', label: 'Database' },
        { key: 'gallery', label: 'Gallery' },
      ].map((v) => (
        <button
          key={v.key}
          onClick={() => setView(v.key)}
          className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap ${
            view === v.key
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* ── Sticky toolbar — full-width border-b, DataLab pattern exactly ── */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Tab chips */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Middle slot — compact ☰ menu on mobile, inline controls on desktop */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto overscroll-x-contain">
          {compact ? (
            <>
              {/* Inline high-frequency control per tab */}
              {activeTab === 'audit' && (
                <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
                  {PERF_RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setAuditRange(r.key)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap ${
                        auditRange === r.key
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              {activeTab === 'trades' && (
                <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
                  {['open', 'all'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        filter === f
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {f === 'open' ? 'Open' : 'All'}
                    </button>
                  ))}
                </div>
              )}
              {/* Market: only a View toggle — show it inline, no menu needed */}
              {activeTab === 'market' && <div className="shrink-0">{viewToggle}</div>}

              {/* ☰ menu holds the rest (Trades only — View + Symbol) */}
              {activeTab === 'trades' && (
                <ToolbarMenu ariaLabel="Log options">
                  <ToolbarMenuSection label="View" divider={false}>
                    {viewToggle}
                  </ToolbarMenuSection>
                  <ToolbarMenuSection label="Symbol">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[10px] pointer-events-none select-none">
                        ⌕
                      </span>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Symbol"
                        list="symbol-datalist"
                        maxLength={20}
                        className="pl-5 pr-2 py-1 w-full text-[11px] font-semibold rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <datalist id="symbol-datalist">
                        {allSymbols.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                  </ToolbarMenuSection>
                </ToolbarMenu>
              )}
              {/* Stats: Script filter — in its own ☰ menu */}
              {activeTab === 'audit' && auditSymbols.length > 0 && (
                <ToolbarMenu ariaLabel="Log options">
                  <ToolbarMenuSection label="Script" divider={false}>
                    <select
                      value={auditSymbol}
                      onChange={(e) => setAuditSymbol(e.target.value)}
                      className="w-full h-7 px-1.5 rounded text-[11px] font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="all">All Scripts</option>
                      {auditSymbols.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </ToolbarMenuSection>
                </ToolbarMenu>
              )}
            </>
          ) : (
            <>
              {/* Stats: range chips + symbol select */}
              {activeTab === 'audit' && (
                <>
                  <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
                    {PERF_RANGES.map((r) => (
                      <button
                        key={r.key}
                        onClick={() => setAuditRange(r.key)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap ${
                          auditRange === r.key
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {auditSymbols.length > 0 && (
                    <>
                      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />
                      <select
                        value={auditSymbol}
                        onChange={(e) => setAuditSymbol(e.target.value)}
                        className="h-6 px-1.5 rounded text-[10px] font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 shrink-0 max-w-[110px]"
                      >
                        <option value="all">All Scripts</option>
                        {auditSymbols.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </>
              )}

              {/* Trades + Market: view toggle */}
              {(activeTab === 'trades' || activeTab === 'market') && (
                <>
                  <div className="shrink-0">{viewToggle}</div>

                  {activeTab === 'trades' && (
                    <>
                      <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 shrink-0" />

                      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
                        {['open', 'all'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                              filter === f
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                          >
                            {f === 'open' ? 'Open' : 'All'}
                          </button>
                        ))}
                      </div>

                      <div className="relative shrink-0 w-[140px]">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[10px] pointer-events-none select-none">
                          ⌕
                        </span>
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Symbol"
                          list="symbol-datalist"
                          maxLength={20}
                          className="pl-5 pr-2 py-0.5 w-full h-6 text-[10px] font-semibold rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all"
                        />
                        <datalist id="symbol-datalist">
                          {allSymbols.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Stats: Share My Stats button — right side of toolbar */}
        {activeTab === 'audit' && (
          <button
            onClick={() => setAuditShareOpen(true)}
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white transition-all whitespace-nowrap"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span className="hidden xs:inline">Share</span>
          </button>
        )}

        {/* New Trade button — Trades tab only, never compresses */}
        {activeTab === 'trades' && (
          <button
            onClick={() => setAddModal(true)}
            aria-label="Add new trade"
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-colors whitespace-nowrap"
          >
            <span className="text-sm leading-none">+</span>
            <span className="hidden xs:inline">New Trade</span>
            <span className="xs:hidden">New</span>
          </button>
        )}
      </div>

      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
        {error && (
          <div className="mx-3 sm:mx-5 mt-3 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-800/30 rounded-xl">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 text-sm leading-none"
            >
              ×
            </button>
          </div>
        )}

        <div className="px-3 sm:px-5 py-4 pb-16 max-w-[1800px] mx-auto">
          {activeTab === 'trades' && (
            <TradeActionsTab
              positions={positions}
              ltpMap={ltpMap}
              view={view}
              filter={filter}
              search={search}
              addModal={addModal}
              setAddModal={setAddModal}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'market' && (
            <Suspense fallback={<TabSpinner />}>
              <MarketJournalTab
                view={view}
                marketJournals={marketJournals}
                onMarketJournalSaved={handleMarketJournalSaved}
              />
            </Suspense>
          )}
          {activeTab === 'audit' && (
            <AuditTab
              range={auditRange}
              symbol={auditSymbol}
              onSymbolsLoaded={setAuditSymbols}
              shareOpen={auditShareOpen}
              onShareClose={() => setAuditShareOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
