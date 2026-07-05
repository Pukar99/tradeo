// === BacktestHome.jsx — redesigned default (no-session) view: hero KPIs + history + setup ===
// Shown when there is no active backtest session. Surfaces lifetime analytics across
// past (COMPLETED) sessions, a scrollable history list, and the setup panel in a side card.

import { useState, useEffect, useCallback } from 'react'
import { btGetHistory, btDeleteHistory } from '../../api/backtest'
import { pnlClass } from '../../utils/format'
import BacktestSetupPanel from './BacktestSetupPanel'

// Design tokens (copied per-file per pm/docs/design.md — no shared ui.js)
const CARD =
  'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
const TILE = 'rounded-xl border p-3'
const LABEL =
  'text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500'

function fmtRs(n) {
  if (n == null) return '—'
  const v = Number(n)
  const sign = v < 0 ? '-' : ''
  return `${sign}Rs.${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}
function fmtPct(n) {
  return n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── KPI tile ────────────────────────────────────────────────────────────────────
function Kpi({ label, value, accent, sub }) {
  const color =
    accent === 'pos'
      ? 'text-green-600'
      : accent === 'neg'
        ? 'text-red-500'
        : 'text-gray-900 dark:text-white'
  const border =
    accent === 'pos'
      ? 'border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10'
      : accent === 'neg'
        ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10'
        : 'border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30'
  return (
    <div className={`${TILE} ${border}`}>
      <div className={LABEL}>{label}</div>
      <div className={`mt-1 text-[16px] font-black tracking-tight tabular-nums ${color}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────────
function HistoryRow({ s, onDelete, deleting }) {
  const pos = s.net_pnl >= 0
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-gray-800 dark:text-gray-100 truncate">
            {s.strategy_name}
          </span>
          <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
            {s.sl_mode}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
          {s.symbols.length ? s.symbols.join(', ') : '—'} · {fmtDate(s.ended_at)}
        </div>
      </div>

      <div className="shrink-0 text-center w-12">
        <div className="text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-200">
          {s.trades}
        </div>
        <div className="text-[9px] text-gray-400 uppercase tracking-wide">trades</div>
      </div>

      <div className="shrink-0 text-center w-12">
        <div className="text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-200">
          {s.win_rate}%
        </div>
        <div className="text-[9px] text-gray-400 uppercase tracking-wide">win</div>
      </div>

      <div className="shrink-0 text-right w-24">
        <div className={`text-[12px] font-bold tabular-nums ${pos ? 'text-green-600' : 'text-red-500'}`}>
          {fmtRs(s.net_pnl)}
        </div>
        <div className={`text-[10px] font-semibold tabular-nums ${pos ? 'text-green-600' : 'text-red-500'}`}>
          {fmtPct(s.return_pct)}
        </div>
      </div>

      {/* Delete — confirm in place */}
      <div className="shrink-0 w-12 flex justify-end">
        {confirm ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDelete(s.id)}
              disabled={deleting}
              title="Confirm delete"
              className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? '…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="px-1.5 py-0.5 text-[10px] font-semibold rounded border border-gray-200 dark:border-gray-700 text-gray-500"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            title="Delete backtest"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5">
              <path strokeLinecap="round" d="M2.5 4h11M6 4V2.5h4V4M5 4l.5 9h5l.5-9" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function BacktestHome({ onSessionStarted }) {
  const PAGE = 10
  const [summary, setSummary] = useState(null)
  const [sessions, setSessions] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true) // first page
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [showSetupMobile, setShowSetupMobile] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Load a page. offset 0 replaces the list (initial load / after delete); >0 appends.
  const loadPage = useCallback((offset) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    btGetHistory(PAGE, offset)
      .then((r) => {
        const { sessions: rows = [], summary: sum, has_more } = r.data
        setSummary(sum)
        setHasMore(!!has_more)
        setSessions((prev) => (offset === 0 ? rows : [...prev, ...rows]))
        setError('')
      })
      .catch(() => setError('Could not load backtest history'))
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }, [])

  useEffect(() => {
    loadPage(0)
  }, [loadPage])

  // Delete a past backtest, then reload from the first page so KPIs + paging stay correct.
  const handleDelete = useCallback(
    async (id) => {
      setDeletingId(id)
      try {
        await btDeleteHistory(id)
        loadPage(0)
      } catch {
        setError('Could not delete backtest')
      } finally {
        setDeletingId(null)
      }
    },
    [loadPage]
  )

  const hasHistory = sessions.length > 0

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-4">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[20px] font-black tracking-tight text-gray-900 dark:text-white">
              Backtesting
            </h1>
            <p className="text-[12px] text-gray-400 mt-0.5">
              Replay any NEPSE stock candle by candle — practice your strategy on real history.
            </p>
          </div>
          <button
            onClick={() => setShowSetupMobile(true)}
            className="lg:hidden px-3.5 py-2 rounded-xl text-[12px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            + New Backtest
          </button>
        </div>

        {/* ── Lifetime KPIs ──────────────────────────────────────────────────── */}
        <div>
          <div className={`${LABEL} mb-2`}>Lifetime Performance</div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`${TILE} border-gray-100 dark:border-gray-800 animate-pulse h-[68px]`}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Kpi
                label="Total P&L"
                value={fmtRs(summary?.total_pnl)}
                accent={pnlClass(summary?.total_pnl || 0, 'pos', 'neg')}
                sub={`${summary?.total_sessions || 0} backtests`}
              />
              <Kpi
                label="Avg Win Rate"
                value={`${summary?.avg_win_rate || 0}%`}
                sub={`${summary?.total_trades || 0} trades`}
              />
              <Kpi
                label="Best Run"
                value={fmtRs(summary?.best_session_pnl)}
                accent={(summary?.best_session_pnl || 0) >= 0 ? 'pos' : undefined}
              />
              <Kpi
                label="Worst Run"
                value={fmtRs(summary?.worst_session_pnl)}
                accent={(summary?.worst_session_pnl || 0) < 0 ? 'neg' : undefined}
              />
            </div>
          )}
        </div>

        {/* ── Two columns: history + setup ───────────────────────────────────── */}
        <div className="flex gap-4 items-start">
          {/* History */}
          <div className={`${CARD} flex-1 min-w-0 overflow-hidden`}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                Past Backtests
              </span>
              {hasHistory && (
                <span className="text-[10px] text-gray-400">
                  {sessions.length}
                  {summary?.total_sessions ? ` of ${summary.total_sessions}` : ''} sessions
                </span>
              )}
            </div>

            {error ? (
              <div className="px-3 py-8 text-center text-[11px] text-red-500">{error}</div>
            ) : loading ? (
              <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[52px] animate-pulse bg-gray-50/50 dark:bg-gray-800/20" />
                ))}
              </div>
            ) : !hasHistory ? (
              <div className="px-4 py-10 text-center">
                <div className="text-[13px] font-bold text-gray-700 dark:text-gray-200">
                  No backtests yet
                </div>
                <div className="text-[11px] text-gray-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Set one up on the right — we default to NABIL, the last 2 years, and Rs. 1 lakh.
                  Your completed runs and their analytics will show here.
                </div>
              </div>
            ) : (
              <div>
                {sessions.map((s) => (
                  <HistoryRow
                    key={s.id}
                    s={s}
                    onDelete={handleDelete}
                    deleting={deletingId === s.id}
                  />
                ))}

                {hasMore && (
                  <div className="px-3 py-2.5">
                    <button
                      onClick={() => loadPage(sessions.length)}
                      disabled={loadingMore}
                      className="w-full py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {loadingMore ? 'Loading…' : `Load more (${summary.total_sessions - sessions.length} left)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Setup — desktop side card */}
          <div className={`${CARD} hidden lg:flex w-[300px] shrink-0 flex-col overflow-hidden`}>
            <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                New Backtest
              </span>
            </div>
            <BacktestSetupPanel onSessionStarted={onSessionStarted} />
          </div>
        </div>
      </div>

      {/* ── Mobile setup sheet ───────────────────────────────────────────────── */}
      {showSetupMobile && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={() => setShowSetupMobile(false)}
          />
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-800"
            style={{ height: '80vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="shrink-0 flex items-center justify-between px-4 pb-2.5 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                New Backtest
              </span>
              <button
                onClick={() => setShowSetupMobile(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[12px]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <BacktestSetupPanel
                onSessionStarted={(sess, opts) => {
                  setShowSetupMobile(false)
                  onSessionStarted(sess, opts)
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
