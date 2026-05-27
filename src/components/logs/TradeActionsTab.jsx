// === TradeActionsTab.jsx — trade actions tab: database/gallery/calendar views, add/close/partial/delete modals ===
import { useState, useCallback, useMemo } from 'react'
import { deleteTradeAction, deleteEntireTrade } from '../../api'
import PositionRow from './PositionRow'
import AddTradeModal from './AddTradeModal'
import ClosePositionModal from './ClosePositionModal'
import PartialExitModal from './PartialExitModal'
import TradeCalendarView from './TradeCalendarView'
import TradeGalleryView from './TradeGalleryView'

export default function TradeActionsTab({ positions, ltpMap, view, filter, search, addModal, setAddModal, onRefresh }) {
  const [closeTarget,   setCloseTarget]  = useState(null)
  const [partialTarget, setPartialTarget]= useState(null)
  const [addTarget,     setAddTarget]    = useState(null)
  const [confirmDel,    setConfirmDel]   = useState(null)
  const [deleting,      setDeleting]     = useState(false)
  const [deleteErr,     setDeleteErr]    = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const displayed = useMemo(() => {
    let list = positions || []
    if (filter === 'open') list = list.filter(p => p.status !== 'CLOSED')
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter(p => p.symbol.includes(q))
    }
    return list
  }, [positions, filter, search])

  const handleSaved = useCallback(() => {
    setAddModal(false)
    setAddTarget(null)
    setCloseTarget(null)
    setPartialTarget(null)
    setRefreshTick(prev => prev + 1)
    onRefresh()
  }, [onRefresh, setAddModal])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDel) return
    setDeleting(true)
    setDeleteErr(null)
    try {
      if (confirmDel.type === 'trade') {
        await deleteEntireTrade(confirmDel.target.trade_id)
      } else {
        await deleteTradeAction(confirmDel.target.id)
        confirmDel.refreshHistory?.()
      }
      setConfirmDel(null)
      setRefreshTick(prev => prev + 1)
      onRefresh()
    } catch (err) {
      setDeleteErr(err.response?.data?.message || err.response?.data?.error || err.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }, [confirmDel, onRefresh])

  const handleDeleteAction = useCallback((action, refreshHistory) => {
    setConfirmDel({ type: 'action', target: action, refreshHistory })
  }, [])

  return (
    <div className="space-y-2">

      {/* calendar view */}
      {view === 'calendar' && <TradeCalendarView />}

      {/* gallery view */}
      {view === 'gallery' && (
        <TradeGalleryView
          positions={positions}
          ltpMap={ltpMap}
          filter={filter}
          search={search}
          onAdd={p => setAddTarget(p)}
          onPartialExit={p => setPartialTarget(p)}
          onClose={p => setCloseTarget(p)}
          onDelete={p => setConfirmDel({ type: 'trade', target: p })}
          onOpenAddModal={() => setAddModal(true)}
        />
      )}

      {/* database view */}
      {view === 'database' && (
        displayed.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            <p className="text-[13px] font-semibold mb-1">
              No {filter === 'open' ? 'open ' : ''}positions
            </p>
            <p className="text-[11px]">
              {filter === 'open'
                ? <span className="text-gray-400">Switch to All above to see closed trades</span>
                : <button onClick={() => setAddModal(true)} className="underline hover:text-blue-500 transition-colors">Add your first trade →</button>
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(pos => (
              <PositionRow
                key={pos.trade_id}
                position={pos}
                ltp={ltpMap?.[pos.symbol]}
                onAdd={p => setAddTarget(p)}
                onPartialExit={p => setPartialTarget(p)}
                onClose={p => setCloseTarget(p)}
                onDelete={p => setConfirmDel({ type: 'trade', target: p })}
                onDeleteAction={handleDeleteAction}
                onRefresh={onRefresh}
                refreshTick={refreshTick}
              />
            ))}
          </div>
        )
      )}

      {/* delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-2xl">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {confirmDel.type === 'trade' ? 'Delete entire trade?' : 'Delete this action?'}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-5">
              {confirmDel.type === 'trade'
                ? `All action rows for ${confirmDel.target.symbol} will be permanently deleted.`
                : 'This action row will be permanently removed.'}
            </p>
            {deleteErr && <p className="text-[11px] text-red-500 mb-3">{deleteErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setConfirmDel(null); setDeleteErr(null) }}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modals */}
      {addModal && (
        <AddTradeModal onClose={() => setAddModal(false)} onSaved={handleSaved} />
      )}
      {addTarget && (
        <AddTradeModal existingPosition={addTarget} onClose={() => setAddTarget(null)} onSaved={handleSaved} />
      )}
      {closeTarget && (
        <ClosePositionModal position={closeTarget} onClose={() => setCloseTarget(null)} onSaved={handleSaved} />
      )}
      {partialTarget && (
        <PartialExitModal position={partialTarget} onClose={() => setPartialTarget(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}
