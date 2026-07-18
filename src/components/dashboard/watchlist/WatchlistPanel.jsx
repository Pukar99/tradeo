// === WatchlistPanel.jsx — the HomePage watchlist card (t30 HOME-10 + HOME-16) ===
// Extracted from HomePage.jsx (~900 inlined lines → this module). Owns: tabs
// (Active / Pre-Watch / Positions), symbol search + add flow, edit modal (shared
// WatchAlertForm), auto-classification, alert badges, highlight-on-alert-click,
// and multi-select bulk delete. HomePage passes data + refresh; no fetch here
// beyond the cached symbol list for autocomplete.

import { useState, useEffect, useRef, useMemo } from 'react'
import { useContextMenu } from '../../ContextMenu'
import { useEscapeKey } from '../../../hooks/useEscapeKey'
import { useHighlightListener } from '../../../utils/chatEvents'
import { addToWatchlist, updateWatchlist, removeFromWatchlist } from '../../../api'
import { getMarketSymbols } from '../../../utils/globalCache'
import StockAvatar, { getStockBorder, getStockBar } from '../../common/StockAvatar'
import { IconPencil, IconTrash, IconWarning } from '../../common/icons'
import WatchAlertForm from './WatchAlertForm'

const EMPTY_FORM = { price_alert: '', alert_date: '', watch_low: '', watch_high: '', notes: '' }

export default function WatchlistPanel({
  watchlist,
  setWatchlist,
  openPositions,
  onRefresh,
  priceMapRef,
  navigate,
}) {
  const [watchlistTab, setWatchlistTab] = useState('active')
  const { onContextMenu: watchCtx, ContextMenuPortal: WatchMenuPortal } = useContextMenu()

  // add-flow: null | 'search' | { symbol, refPrice }
  const [watchAddState, setWatchAddState] = useState(null)
  const [watchEditItem, setWatchEditItem] = useState(null)
  const [watchActionErr, setWatchActionErr] = useState(null)

  // symbol list for autocomplete — cached fetcher, loads once
  const symbolListRef = useRef([])
  const [symbolsReady, setSymbolsReady] = useState(false)
  const [watchQuery, setWatchQuery] = useState('')
  const [watchCursor, setWatchCursor] = useState(-1)
  const watchInputRef = useRef(null)

  const [watchForm, setWatchForm] = useState(EMPTY_FORM)
  const [watchAdding, setWatchAdding] = useState(false)
  const [watchEditForm, setWatchEditForm] = useState(null)
  const [watchSaving, setWatchSaving] = useState(false)

  // highlight-on-alert-click
  const [highlightSym, setHighlightSym] = useState(null)
  const watchRowRefs = useRef({}) // symbol → row DOM node
  const highlightTimer = useRef(null)

  // multi-select bulk delete (HOME-16)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setDeleteArmed(false)
  }

  useEscapeKey(() => {
    setWatchAddState(null)
    setWatchEditItem(null)
    setWatchForm(EMPTY_FORM)
    setWatchEditForm(null)
    setWatchQuery('')
    exitSelectMode()
  })

  useEffect(() => {
    getMarketSymbols()
      .then((res) => {
        symbolListRef.current = res.data?.stocks || []
        setSymbolsReady(true)
      })
      .catch(() => setSymbolsReady(true))
  }, [])

  // Focus search input when add panel opens
  useEffect(() => {
    if (watchAddState === 'search') setTimeout(() => watchInputRef.current?.focus(), 50)
  }, [watchAddState])

  // ── Classify: auto-derive active/pre from signals ───────────────────────────
  const watchTodayStr = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toDateString()
  }, [])
  const watchToday = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [watchTodayStr]) // eslint-disable-line react-hooks/exhaustive-deps

  const classifiedWatch = useMemo(() => {
    return watchlist.map((w) => {
      const ltp = w.currentPrice
      let priceSignal = 'neutral'
      if (w.price_alert && ltp) {
        const pct = Math.abs((ltp - parseFloat(w.price_alert)) / ltp) * 100
        priceSignal = pct <= 15 ? 'active' : 'pre'
      }
      let dateSignal = 'neutral',
        wStatus = null
      if (w.alert_date) {
        const days = Math.ceil((new Date(w.alert_date + 'T00:00:00') - watchToday) / 86400000)
        if (days >= 0 && days <= 14) {
          dateSignal = 'active'
        } else if (days > 14) {
          dateSignal = 'pre'
        } else if (days >= -10) {
          dateSignal = 'active'
          wStatus = 'grace'
        } else {
          dateSignal = 'expired'
          wStatus = 'expired'
        }
      }
      if (dateSignal === 'expired') return { ...w, category: 'pre', wStatus: 'expired' }
      if (priceSignal === 'active' || dateSignal === 'active')
        return { ...w, category: 'active', wStatus }
      return { ...w, category: 'pre', wStatus }
    })
  }, [watchlist, watchToday])

  const activeWatchItems = classifiedWatch.filter((w) => w.category === 'active')
  const preWatchItems = classifiedWatch.filter((w) => w.category === 'pre')
  const filteredWatch = watchlistTab === 'active' ? activeWatchItems : preWatchItems

  // ── Highlight a watchlist / position row when its alert is clicked ──────────
  useHighlightListener('watchlist', (key) => {
    const sym = String(key).toUpperCase()
    let tab = null
    if (activeWatchItems.some((w) => w.symbol?.toUpperCase() === sym)) tab = 'active'
    else if (preWatchItems.some((w) => w.symbol?.toUpperCase() === sym)) tab = 'pre'
    else if (openPositions.some((t) => t.symbol?.toUpperCase() === sym)) tab = 'positions'
    if (!tab) return
    setWatchlistTab(tab)
    setWatchAddState(null)
    setHighlightSym(sym)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        watchRowRefs.current[sym]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
    clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightSym(null), 2100)
  })

  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  // ── Autocomplete suggestions ────────────────────────────────────────────────
  const watchSuggestions = useMemo(() => {
    const q = watchQuery.trim().toUpperCase()
    if (!q || !symbolsReady) return []
    return symbolListRef.current
      .filter((s) => s.symbol.startsWith(q) || s.company_name?.toUpperCase().includes(q))
      .slice(0, 8)
  }, [watchQuery, symbolsReady])

  const handleWatchKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setWatchCursor((c) => Math.min(c + 1, watchSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setWatchCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick =
        watchCursor >= 0
          ? watchSuggestions[watchCursor]
          : watchSuggestions.length === 1
            ? watchSuggestions[0]
            : null
      if (pick) {
        const p = priceMapRef.current[pick.symbol]
        setWatchAddState({ symbol: pick.symbol, refPrice: p ? parseFloat(p.price) || null : null })
        setWatchQuery('')
        setWatchCursor(-1)
      }
    } else if (e.key === 'Escape') {
      setWatchAddState(null)
      setWatchQuery('')
    }
  }

  // ── Add / edit / remove handlers ────────────────────────────────────────────
  const handleAddWatch = async (e) => {
    e.preventDefault()
    if (!watchAddState || typeof watchAddState !== 'object') return
    const dupSym = watchAddState.symbol.toUpperCase()
    if (watchlist.some((w) => w.symbol?.toUpperCase() === dupSym)) {
      setWatchActionErr(`${watchAddState.symbol} is already in your watchlist.`)
      return
    }
    setWatchAdding(true)
    setWatchActionErr(null)
    setWatchQuery('')
    try {
      await addToWatchlist({
        symbol: watchAddState.symbol,
        price_alert: watchForm.price_alert ? parseFloat(watchForm.price_alert) : null,
        alert_date: watchForm.alert_date || null,
        watch_low: watchForm.watch_low ? parseFloat(watchForm.watch_low) : null,
        watch_high: watchForm.watch_high ? parseFloat(watchForm.watch_high) : null,
        notes: watchForm.notes || null,
        category: 'pre',
      })
      setWatchAddState(null)
      setWatchForm(EMPTY_FORM)
      if (onRefresh) await onRefresh()
    } catch (err) {
      setWatchActionErr(err.response?.data?.error || 'Failed to add.')
    } finally {
      setWatchAdding(false)
    }
  }

  const openWatchEdit = (item) => {
    setWatchActionErr(null)
    setWatchEditItem(item)
    setWatchEditForm({
      watch_low: item.watch_low != null ? String(item.watch_low) : '',
      watch_high: item.watch_high != null ? String(item.watch_high) : '',
      price_alert: item.price_alert != null ? String(item.price_alert) : '',
      alert_date: item.alert_date ? item.alert_date.slice(0, 10) : '',
      notes: item.notes || '',
    })
  }

  const handleSaveWatch = async (e) => {
    e.preventDefault()
    if (!watchEditItem || !watchEditForm) return
    setWatchSaving(true)
    setWatchActionErr(null)
    try {
      await updateWatchlist(watchEditItem.id, {
        watch_low: watchEditForm.watch_low !== '' ? parseFloat(watchEditForm.watch_low) : null,
        watch_high: watchEditForm.watch_high !== '' ? parseFloat(watchEditForm.watch_high) : null,
        price_alert:
          watchEditForm.price_alert !== '' ? parseFloat(watchEditForm.price_alert) : null,
        alert_date: watchEditForm.alert_date || null,
        notes: watchEditForm.notes || null,
        category: 'pre',
      })
      setWatchEditItem(null)
      setWatchEditForm(null)
      if (onRefresh) await onRefresh()
    } catch (err) {
      setWatchActionErr(err.response?.data?.error || 'Failed to save.')
    } finally {
      setWatchSaving(false)
    }
  }

  const handleRemoveWatch = async (id) => {
    const snapshot = watchlist
    setWatchActionErr(null)
    setWatchlist((prev) => prev.filter((w) => w.id !== id))
    try {
      await removeFromWatchlist(id)
    } catch {
      setWatchlist(snapshot)
      setWatchActionErr('Failed to remove — please try again.')
    }
  }

  // ── Multi-select bulk delete (HOME-16) ─────────────────────────────────────
  const toggleSelected = (id) => {
    setDeleteArmed(false)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    const ids = [...selectedIds]
    const snapshot = watchlist
    setBulkDeleting(true)
    setWatchActionErr(null)
    setWatchlist((prev) => prev.filter((w) => !selectedIds.has(w.id)))
    const results = await Promise.allSettled(ids.map((id) => removeFromWatchlist(id)))
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected')
    if (failedIds.length) {
      // Restore only the items that failed to delete, in original order.
      setWatchlist(snapshot.filter((w) => !selectedIds.has(w.id) || failedIds.includes(w.id)))
      setWatchActionErr(`${failedIds.length} item(s) could not be deleted — try again.`)
    }
    setBulkDeleting(false)
    exitSelectMode()
  }

  // ── Alert messages per item ─────────────────────────────────────────────────
  function watchAlertMsgs(item) {
    const msgs = []
    const ltp = item.currentPrice
    if (!ltp) return msgs
    if (item.price_alert) {
      const alert = parseFloat(item.price_alert)
      const diff = alert - ltp
      const pct = Math.abs((diff / ltp) * 100).toFixed(1)
      if (Math.abs(diff) < ltp * 0.02)
        msgs.push({
          text: 'Near alert level',
          color: 'text-orange-500',
          bg: 'bg-orange-50 dark:bg-orange-900/30',
        })
      else if (diff > 0)
        msgs.push({
          text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to alert`,
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/30',
        })
      else
        msgs.push({
          text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to alert`,
          color: 'text-red-500',
          bg: 'bg-red-50 dark:bg-red-900/30',
        })
    }
    if (item.watch_low && ltp) {
      const wl = parseFloat(item.watch_low)
      const diff = ltp - wl
      const pct = Math.abs((diff / ltp) * 100).toFixed(1)
      if (diff > 0)
        msgs.push({
          text: `-Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to watch low`,
          color: 'text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/30',
        })
      else
        msgs.push({
          text: 'Below watch low',
          color: 'text-red-500',
          bg: 'bg-red-50 dark:bg-red-900/30',
        })
    }
    if (item.watch_high && ltp) {
      const wh = parseFloat(item.watch_high)
      const diff = wh - ltp
      const pct = Math.abs((diff / ltp) * 100).toFixed(1)
      if (diff > 0)
        msgs.push({
          text: `+Rs.${Math.abs(Math.round(diff)).toLocaleString()} (${pct}%) to watch high`,
          color: 'text-green-500',
          bg: 'bg-green-50 dark:bg-green-900/30',
        })
      else
        msgs.push({
          text: 'Above watch high',
          color: 'text-green-500',
          bg: 'bg-green-50 dark:bg-green-900/30',
        })
    }
    if (item.alert_date) {
      const days = Math.ceil((new Date(item.alert_date + 'T00:00:00') - watchToday) / 86400000)
      if (days < -10)
        msgs.push({
          text: `Alert expired ${Math.abs(days)}d ago`,
          color: 'text-gray-400',
          bg: 'bg-gray-100 dark:bg-gray-800',
        })
      else if (days < 0)
        msgs.push({
          text: `${Math.abs(days)}d overdue — grace`,
          color: 'text-amber-500',
          bg: 'bg-amber-50 dark:bg-amber-900/30',
        })
      else if (days === 0)
        msgs.push({
          text: 'Alert date is today',
          color: 'text-orange-500',
          bg: 'bg-orange-50 dark:bg-orange-900/30',
        })
      else if (days <= 3)
        msgs.push({
          text: `${days}d left`,
          color: 'text-orange-500',
          bg: 'bg-orange-50 dark:bg-orange-900/30',
        })
      else if (days <= 14)
        msgs.push({
          text: `${days}d left`,
          color: 'text-blue-500',
          bg: 'bg-blue-50 dark:bg-blue-900/30',
        })
    }
    return msgs
  }

  const editLtp =
    watchEditItem?.currentPrice != null ? parseFloat(watchEditItem.currentPrice) : null

  return (
    <div className="flex flex-col">
      <WatchMenuPortal />

      {/* ── Edit modal — shared WatchAlertForm inside modal chrome ── */}
      {watchEditItem && watchEditForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setWatchEditItem(null)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full sm:max-w-xs z-10 overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white" translate="no">
                    {watchEditItem.symbol}
                  </p>
                  {editLtp != null && (
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      Rs.{editLtp.toLocaleString()}
                    </span>
                  )}
                  {watchEditItem.change != null && (
                    <span
                      className={`text-[9px] font-semibold tabular-nums ${watchEditItem.change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {watchEditItem.change >= 0 ? '+' : ''}
                      {watchEditItem.change}%
                    </span>
                  )}
                </div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mt-0.5">
                  Edit alert levels
                </p>
              </div>
              <button
                onClick={() => setWatchEditItem(null)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-base leading-none shrink-0 ml-2"
              >
                ×
              </button>
            </div>
            <WatchAlertForm
              variant="edit"
              ltp={editLtp}
              form={watchEditForm}
              setForm={setWatchEditForm}
              onSubmit={handleSaveWatch}
              onCancel={() => setWatchEditItem(null)}
              busy={watchSaving}
              error={watchActionErr}
            />
          </div>
        </div>
      )}

      <div className="hp-card bg-white/70 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">
            Watchlist
          </p>
          <div className="flex-1 shrink-0 min-w-[8px]" />
          {/* Tab pill group */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 shrink-0">
            {[
              {
                id: 'active',
                label: `Active${activeWatchItems.length ? ` ${activeWatchItems.length}` : ''}`,
              },
              {
                id: 'pre',
                label: `Pre-Watch${preWatchItems.length ? ` ${preWatchItems.length}` : ''}`,
              },
              {
                id: 'positions',
                label: `Pos.${openPositions.length ? ` ${openPositions.length}` : ''}`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setWatchlistTab(tab.id)
                  setWatchAddState(null)
                  exitSelectMode()
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                  watchlistTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Select toggle — watch tabs only (HOME-16) */}
          {watchlistTab !== 'positions' && filteredWatch.length > 0 && (
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors shrink-0 ${
                selectMode
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {/* Add button — only on watchlist tabs, hidden in select mode */}
          {watchAddState === null && watchlistTab !== 'positions' && !selectMode && (
            <button
              onClick={() => setWatchAddState('search')}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors shrink-0"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add
            </button>
          )}
        </div>

        {/* Symbol search panel */}
        {watchAddState === 'search' && (
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 h-7">
                <svg
                  className="w-3 h-3 text-gray-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                  />
                </svg>
                <input
                  ref={watchInputRef}
                  type="text"
                  value={watchQuery}
                  onChange={(e) => {
                    setWatchQuery(e.target.value.toUpperCase())
                    setWatchCursor(-1)
                  }}
                  onKeyDown={handleWatchKey}
                  placeholder="Type symbol…"
                  className="flex-1 bg-transparent text-[11px] text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
                  translate="no"
                />
                {watchQuery && (
                  <button
                    onClick={() => setWatchQuery('')}
                    className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
              {watchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden">
                  {watchSuggestions.map((s, i) => (
                    <button
                      key={s.symbol}
                      onClick={() => {
                        const p = priceMapRef.current[s.symbol]
                        setWatchAddState({
                          symbol: s.symbol,
                          refPrice: p ? parseFloat(p.price) || null : null,
                        })
                        setWatchQuery('')
                        setWatchCursor(-1)
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === watchCursor ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} ${i < watchSuggestions.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <span
                          className="text-[11px] font-bold text-gray-900 dark:text-white"
                          translate="no"
                        >
                          {s.symbol}
                        </span>
                        {s.company_name && (
                          <span className="text-[10px] text-gray-400 ml-1.5 truncate">
                            {s.company_name}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setWatchAddState(null)
                setWatchQuery('')
                setWatchForm(EMPTY_FORM)
              }}
              className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Add form — after symbol selected: strip + shared WatchAlertForm */}
        {watchAddState && typeof watchAddState === 'object' && (
          <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-[12px] font-bold text-gray-900 dark:text-white" translate="no">
                  {watchAddState.symbol}
                </p>
                {watchAddState.refPrice != null ? (
                  <span className="text-[10px] font-semibold tabular-nums text-gray-500 dark:text-gray-400 bg-gray-200/60 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    LTP Rs.{watchAddState.refPrice.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">No live price</span>
                )}
              </div>
              <button
                onClick={() => {
                  setWatchAddState(null)
                  setWatchForm(EMPTY_FORM)
                }}
                className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 leading-none px-1"
              >
                ✕
              </button>
            </div>
            <WatchAlertForm
              variant="add"
              ltp={watchAddState.refPrice}
              form={watchForm}
              setForm={setWatchForm}
              onSubmit={handleAddWatch}
              busy={watchAdding}
              error={watchActionErr}
            />
          </div>
        )}

        {/* List */}
        {watchlistTab === 'positions' ? (
          <div className="overflow-y-auto no-scrollbar max-h-[280px]">
            {openPositions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-400 text-xs">No open positions</p>
                <button
                  onClick={() => navigate('/logs')}
                  className="mt-2 text-blue-500 text-xs hover:underline"
                >
                  + Add a trade
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {openPositions.map((t) => {
                  const slDistPct =
                    t.sl != null && t.currentPrice
                      ? t.position === 'SHORT'
                        ? (((t.sl - t.currentPrice) / t.currentPrice) * 100).toFixed(1)
                        : (((t.currentPrice - t.sl) / t.currentPrice) * 100).toFixed(1)
                      : null
                  const tpDistPct =
                    t.tp != null && t.currentPrice
                      ? t.position === 'SHORT'
                        ? (((t.currentPrice - t.tp) / t.currentPrice) * 100).toFixed(1)
                        : (((t.tp - t.currentPrice) / t.currentPrice) * 100).toFixed(1)
                      : null
                  const isHl = highlightSym === t.symbol?.toUpperCase()
                  return (
                    <div
                      key={t.id}
                      ref={(el) => {
                        const k = t.symbol?.toUpperCase()
                        if (!k) return
                        if (el) watchRowRefs.current[k] = el
                        else delete watchRowRefs.current[k]
                      }}
                      className={`px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isHl ? 'hp-highlight' : ''}`}
                      translate="no"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StockAvatar symbol={t.symbol} size="w-7 h-7" textSize="text-[10px]" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                {t.symbol}
                              </p>
                              <span
                                className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                                  t.position === 'LONG'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                }`}
                              >
                                {t.position}
                              </span>
                              {t.status === 'PARTIAL' && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300 font-medium">
                                  P
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">
                              {t.quantity} @ Rs.{(t.entry_price || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {t.unrealizedPnl != null ? (
                            <p
                              className={`text-xs font-semibold ${t.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
                            >
                              {t.unrealizedPnl >= 0 ? '+' : ''}Rs.
                              {Math.abs(t.unrealizedPnl).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">—</p>
                          )}
                          {t.pnlPct != null && (
                            <p
                              className={`text-[10px] ${parseFloat(t.pnlPct) >= 0 ? 'text-green-400' : 'text-red-400'}`}
                            >
                              {parseFloat(t.pnlPct) >= 0 ? '+' : ''}
                              {t.pnlPct}%
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 ml-9 flex-wrap">
                        {t.sl != null ? (
                          <span className="text-[10px] bg-red-50 dark:bg-red-900/40 text-red-500 px-1.5 py-0.5 rounded">
                            SL{' '}
                            {slDistPct !== null
                              ? `${parseFloat(slDistPct) > 0 ? '+' : ''}${slDistPct}%`
                              : `Rs.${t.sl.toLocaleString()}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-50 dark:bg-orange-900/40 text-orange-500 px-1.5 py-0.5 rounded">
                            <IconWarning className="w-2.5 h-2.5" /> No SL
                          </span>
                        )}
                        {t.tp != null && (
                          <span className="text-[10px] bg-green-50 dark:bg-green-900/40 text-green-500 px-1.5 py-0.5 rounded">
                            TP{' '}
                            {tpDistPct !== null
                              ? `${parseFloat(tpDistPct) > 0 ? '+' : ''}${tpDistPct}%`
                              : `Rs.${t.tp.toLocaleString()}`}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={() => navigate('/portfolio')}
                  className="w-full px-4 py-2 text-[11px] font-semibold text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center"
                >
                  View all in Portfolio →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar snap-x snap-mandatory">
            {filteredWatch.length === 0 ? (
              <div className="w-full py-8 text-center">
                <p className="text-[11px] text-gray-400">
                  No stocks in {watchlistTab === 'active' ? 'Active' : 'Pre-Watch'}
                </p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
                  {watchlistTab === 'active'
                    ? 'Items auto-promote when alert is within 15% or 2 weeks'
                    : 'Click + to add a symbol'}
                </p>
              </div>
            ) : (
              filteredWatch.map((item) => {
                const isExpired = item.wStatus === 'expired'
                const inGrace = item.wStatus === 'grace'
                const isSelected = selectedIds.has(item.id)
                const priceFill =
                  item.price_alert && item.currentPrice
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          100 -
                            (Math.abs(
                              (item.currentPrice - parseFloat(item.price_alert)) /
                                item.currentPrice
                            ) *
                              100) /
                              15
                        )
                      )
                    : null
                const meta = item.price_alert
                  ? `@ Rs.${parseFloat(item.price_alert).toLocaleString()}`
                  : item.alert_date
                    ? `By ${new Date(item.alert_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : item.notes || null
                const isUp = item.change != null && item.change >= 0
                const isHl = highlightSym === item.symbol?.toUpperCase()
                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      const k = item.symbol?.toUpperCase()
                      if (!k) return
                      if (el) watchRowRefs.current[k] = el
                      else delete watchRowRefs.current[k]
                    }}
                    onClick={selectMode ? () => toggleSelected(item.id) : undefined}
                    onContextMenu={
                      selectMode
                        ? undefined
                        : watchCtx([
                            { label: 'Edit', icon: <IconPencil />, action: () => openWatchEdit(item) },
                            { separator: true },
                            {
                              label: 'Delete',
                              icon: <IconTrash />,
                              danger: true,
                              action: () => handleRemoveWatch(item.id),
                            },
                          ])
                    }
                    className={`hp-watch-item relative flex flex-col gap-1 px-1.5 py-1.5 rounded-xl snap-start
                  shrink-0 basis-[calc((100%-1rem)/3)] sm:basis-[calc((100%-1.5rem)/4)]
                  bg-white/70 dark:bg-gray-800/50 border border-white/80 dark:border-white/5
                  backdrop-blur-sm shadow-sm border-l-[3px] ${getStockBorder(item.symbol)}
                  ${isExpired ? 'opacity-50' : ''} ${isHl ? 'hp-highlight' : ''}
                  ${selectMode ? 'cursor-pointer' : 'cursor-default'}
                  ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
                    translate="no"
                  >
                    {/* Selection checkbox (select mode only) */}
                    {selectMode && (
                      <span
                        className={`absolute top-1 right-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-900/60'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-2 h-2 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                    )}

                    {/* Avatar + symbol */}
                    <div className="flex items-center gap-1">
                      <StockAvatar symbol={item.symbol} size="w-5 h-5" textSize="text-[8px]" />
                      <span
                        className={`text-[10px] font-bold leading-none truncate ${isExpired ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}
                      >
                        {item.symbol}
                      </span>
                    </div>

                    {/* Price + change */}
                    <div className="flex items-baseline justify-between gap-0.5">
                      <p className="text-[11px] font-bold tabular-nums text-gray-900 dark:text-white leading-none truncate">
                        {item.currentPrice != null
                          ? `Rs.${parseFloat(item.currentPrice).toLocaleString()}`
                          : '—'}
                      </p>
                      {item.change != null && (
                        <span
                          className={`text-[9px] font-semibold tabular-nums shrink-0 ${isUp ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                        >
                          {isUp ? '+' : ''}
                          {item.change}%
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    {meta && (
                      <p className="text-[8px] text-gray-400 dark:text-gray-500 truncate leading-none">
                        {meta}
                      </p>
                    )}

                    {/* Status badges */}
                    {(isExpired || inGrace) && (
                      <div className="flex gap-1">
                        {isExpired && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 font-semibold uppercase tracking-wide">
                            Exp
                          </span>
                        )}
                        {inGrace && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">
                            Grace
                          </span>
                        )}
                      </div>
                    )}

                    {/* Progress bar */}
                    {watchlistTab === 'active' && priceFill != null && (
                      <div className="h-0.5 w-full bg-gray-100 dark:bg-gray-700/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getStockBar(item.symbol)} transition-all`}
                          style={{ width: `${priceFill}%` }}
                        />
                      </div>
                    )}

                    {/* Alert badges */}
                    {(() => {
                      const msgs = watchAlertMsgs(item)
                      if (!msgs.length) return null
                      return (
                        <div className="flex flex-wrap gap-0.5">
                          {msgs.map((m, i) => (
                            <span
                              key={i}
                              className={`text-[8px] font-medium px-1 py-0.5 rounded-full ${m.bg} ${m.color}`}
                            >
                              {m.text}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Bulk-delete bar (select mode, HOME-16) */}
        {selectMode && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {selectedIds.size} selected
            </p>
            <div className="flex items-center gap-2">
              {watchActionErr && <p className="text-[10px] text-red-500">{watchActionErr}</p>}
              <button
                onClick={handleBulkDelete}
                disabled={!selectedIds.size || bulkDeleting}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 ${
                  deleteArmed
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                }`}
              >
                {bulkDeleting
                  ? 'Deleting…'
                  : deleteArmed
                    ? `Confirm delete ${selectedIds.size}?`
                    : `Delete${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
