// === BacktestHome.jsx — redesigned default (no-session) view: hero KPIs + history + setup ===
// Shown when there is no active backtest session. Surfaces lifetime analytics across
// past (COMPLETED) sessions, a scrollable history list, and the setup panel in a side card.
//
// SCR-13 (2026-08-11): KPI tiles + history now use the shared Card/CardStack shell
// (src/components/common/CardShell.jsx) — the same colored-stripe + tinted-icon
// language already shipped on SMC/Price Action's left panels and the Admin panel.
// The KPI+history column is the page's top-level styled surface (no ScreenPage-style
// outer dock wrapper above it here), so IT owns the group/ring/tier-accent overlay —
// CardStack is mounted with tiered={false} inside it to avoid a doubled ring, exactly
// the "outer wrapper supplies it instead" pattern CardShell's own comment documents
// for panels with a header row above the scroll body (here: the bordered card frame
// + TierAccentOverlay sit on the frame, CardStack is just the padded scroll body).

import { useState, useEffect, useCallback } from 'react'
import { btGetHistory, btDeleteHistory } from '../../api/backtest'
import { pnlClass } from '../../utils/format'
import { useAuth } from '../../context/AuthContext'
import { TIER_ACCENT, getDisplayTier, TierAccentOverlay, tierRingClass } from '../common/TierMaterial'
import { Card, CardStack } from '../common/CardShell'
import BacktestSetupPanel from './BacktestSetupPanel'

// Design tokens (copied per-file per pm/docs/design.md — no shared ui.js)
const CARD =
  'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800'
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

// ── Icons (12x12 stroke glyphs, same recipe as ProfessionalAnalysisPanels' CardIcon:
// viewBox 0 0 24 24, stroke currentColor, strokeWidth 2.4, w-3 h-3 — trend/target/pulse
// reuse those exact glyph paths for visual consistency; trendDown is new, mirrored
// from trend for "Worst Run") ──────────────────────────────────────────────────────
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'w-3 h-3',
}
const ICONS = {
  trend: (
    <svg {...iconProps}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  ),
  trendDown: (
    <svg {...iconProps}>
      <path d="M7 7 17 17" />
      <path d="M7 17h10V7" />
    </svg>
  ),
  target: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  ),
  pulse: (
    <svg {...iconProps}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
}

// ── KPI tile — thin wrapper around the shared Card shell ───────────────────────────
function Kpi({ label, value, tone = 'neutral', icon, sub, index }) {
  const valueColor =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-red-500 dark:text-red-400'
        : tone === 'info'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-900 dark:text-white'
  return (
    <Card tone={tone} icon={icon} title={label} index={index}>
      <div className={`text-[16px] font-black tracking-tight tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</div>}
    </Card>
  )
}

// ── History row ───────────────────────────────────────────────────────────────────
// Deliberately NOT a full padded Card per row — Card's stripe+icon+padding language
// is meant for a handful of sectioned items (see SMC/PA), not a scrolling list of
// 10-29 sessions; that much padding per row would read as heavy/repetitive. Instead
// each row keeps its original slim single-line layout but picks up the same stripe
// language as a thin 2px colored left edge (emerald/red by win-loss), consistent
// with Card's own left-stripe, inside one shared bordered+divided list container.
function HistoryRow({ s, onDelete, deleting, index }) {
  const pos = s.net_pnl >= 0
  const [confirm, setConfirm] = useState(false)

  return (
    <div
      className="group/row relative flex items-center gap-3 pl-4 pr-3 py-2.5 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors animate-fade-up"
      style={index != null ? { animationDelay: `${index * 30}ms` } : undefined}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full ${pos ? 'bg-emerald-500' : 'bg-red-500'}`}
      />
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
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-all"
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

// ── Skeleton — shaped to match the real KPI grid + history list exactly, so the
// swap-in once btGetHistory resolves doesn't shift anything (same convention as
// ProfessionalAnalysisPanels' CardSkeleton/CardStackSkeleton). Lives inside the same
// bordered frame as the real content, at CardStack's own p-2.5 space-y-2.5 rhythm. ──
function KpiSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-3.5 pr-3 space-y-2 animate-pulse">
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-gray-200 dark:bg-gray-700" />
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-md bg-gray-200 dark:bg-gray-700" />
        <span className="h-2 w-16 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-3.5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-2 w-14 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

function HistoryRowSkeleton() {
  return (
    <div className="relative flex items-center gap-3 pl-4 pr-3 py-2.5 animate-pulse">
      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-2 w-36 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="shrink-0 w-12 space-y-1">
        <div className="h-2.5 w-6 mx-auto rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-1.5 w-8 mx-auto rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="shrink-0 w-12 space-y-1">
        <div className="h-2.5 w-8 mx-auto rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-1.5 w-6 mx-auto rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="shrink-0 w-24 space-y-1">
        <div className="h-3 w-16 ml-auto rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-2 w-10 ml-auto rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="shrink-0 w-12" />
    </div>
  )
}

function BacktestHomeSkeleton() {
  return (
    <div className="p-2.5 space-y-2.5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <div>
        <div className="h-2.5 w-28 rounded bg-gray-100 dark:bg-gray-800 mb-2 animate-pulse" />
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/60 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <HistoryRowSkeleton key={i} />
          ))}
        </div>
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

  const { user } = useAuth()
  const displayTier = getDisplayTier(user)
  const accent = TIER_ACCENT[displayTier]

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

        {/* ── Two columns: KPIs+history (tier-accented card frame) + setup ────── */}
        <div className="flex gap-4 items-start">
          {/* KPIs + History — one bordered card frame owns the tier ring/overlay;
              CardStack inside is mounted tiered={false} so its own ring doesn't
              double up (and doesn't get clipped by this frame's overflow-hidden —
              see TierMaterial's own note: a CHILD's box-shadow gets clipped by a
              parent's overflow-hidden, so the ring must live on the frame itself). */}
          <div
            className={`group relative flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 ${accent ? tierRingClass(displayTier) : ''}`}
          >
            <TierAccentOverlay accent={accent} radius="rounded-t-2xl" />
            {loading ? (
              <BacktestHomeSkeleton />
            ) : (
              <CardStack tiered={false}>
                {/* Lifetime KPIs */}
                <div>
                  <div className={`${LABEL} mb-2`}>Lifetime Performance</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <Kpi
                      index={0}
                      label="Total P&L"
                      icon={ICONS.trend}
                      tone={pnlClass(summary?.total_pnl || 0, 'positive', 'negative')}
                      value={fmtRs(summary?.total_pnl)}
                      sub={`${summary?.total_sessions || 0} backtests`}
                    />
                    <Kpi
                      index={1}
                      label="Avg Win Rate"
                      icon={ICONS.target}
                      tone={(summary?.avg_win_rate || 0) >= 50 ? 'positive' : 'info'}
                      value={`${summary?.avg_win_rate || 0}%`}
                      sub={`${summary?.total_trades || 0} trades`}
                    />
                    <Kpi
                      index={2}
                      label="Best Run"
                      icon={ICONS.pulse}
                      tone="positive"
                      value={fmtRs(summary?.best_session_pnl)}
                    />
                    <Kpi
                      index={3}
                      label="Worst Run"
                      icon={ICONS.trendDown}
                      tone={(summary?.worst_session_pnl || 0) !== 0 ? 'negative' : 'neutral'}
                      value={fmtRs(summary?.worst_session_pnl)}
                    />
                  </div>
                </div>

                {/* History */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
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
                  ) : !hasHistory ? (
                    <div className="px-4 py-10 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                      <div className="text-[13px] font-bold text-gray-700 dark:text-gray-200">
                        No backtests yet
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                        Set one up on the right — we default to NABIL, the last 2 years, and Rs. 1 lakh.
                        Your completed runs and their analytics will show here.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/60 overflow-hidden">
                        {sessions.map((s, i) => (
                          <HistoryRow
                            key={s.id}
                            s={s}
                            index={i}
                            onDelete={handleDelete}
                            deleting={deletingId === s.id}
                          />
                        ))}
                      </div>

                      {hasMore && (
                        <button
                          onClick={() => loadPage(sessions.length)}
                          disabled={loadingMore}
                          className="mt-2 w-full py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                          {loadingMore ? 'Loading…' : `Load more (${summary.total_sessions - sessions.length} left)`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </CardStack>
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
