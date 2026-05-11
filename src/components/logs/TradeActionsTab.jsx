import { useState, useCallback, useMemo } from 'react'
import { deleteTradeAction, deleteEntireTrade } from '../../api'
import PositionRow from './PositionRow'
import AddTradeModal from './AddTradeModal'
import ClosePositionModal from './ClosePositionModal'
import PartialExitModal from './PartialExitModal'

export default function TradeActionsTab({ positions, ltpMap, onRefresh }) {
  const [filter,       setFilter]       = useState('open')   // 'open' | 'all'
  const [search,       setSearch]       = useState('')
  const [addModal,     setAddModal]     = useState(false)
  const [closeTarget,  setCloseTarget]  = useState(null)
  const [partialTarget,setPartialTarget]= useState(null)
  const [addTarget,    setAddTarget]    = useState(null)     // position to add to
  const [confirmDel,   setConfirmDel]   = useState(null)     // { type: 'trade'|'action', target, refreshHistory? }
  const [deleting,     setDeleting]     = useState(false)
  const [deleteErr,    setDeleteErr]    = useState(null)

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
    onRefresh()
  }, [onRefresh])

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
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex items-center gap-2">
        {/* filter pills */}
        <div className="flex rounded-lg bg-gray-100/80 dark:bg-gray-800/80 p-0.5 gap-0.5">
          {['open', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === f
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f === 'open' ? 'Open' : 'All'}
            </button>
          ))}
        </div>

        {/* search — compact */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[11px] pointer-events-none">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Symbol"
            className="pl-6 pr-3 py-1 w-24 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:w-32 transition-all"
          />
        </div>

        {/* count badge */}
        {displayed.length > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            {displayed.length} position{displayed.length !== 1 ? 's' : ''}
          </span>
        )}

        <button
          onClick={() => setAddModal(true)}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-sm shadow-blue-500/30"
        >
          <span className="text-base leading-none">+</span>
          New Trade
        </button>
      </div>

      {/* hint */}
      <p className="text-[10px] text-gray-300 dark:text-gray-700 -mt-1">Right-click any row to add, partial exit, or close</p>

      {/* position list */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-[13px] font-semibold mb-1">No {filter === 'open' ? 'open ' : ''}positions</p>
          <p className="text-[11px]">
            {filter === 'open'
              ? <button onClick={() => setFilter('all')} className="underline hover:text-blue-500 transition-colors">Show all trades</button>
              : <button onClick={() => setAddModal(true)} className="underline hover:text-blue-500 transition-colors">Add your first trade →</button>
            }
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
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
            />
          ))}
        </div>
      )}

      {/* modals */}
      {addModal && (
        <AddTradeModal
          onClose={() => setAddModal(false)}
          onSaved={handleSaved}
        />
      )}
      {addTarget && (
        <AddTradeModal
          existingPosition={addTarget}
          onClose={() => setAddTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {closeTarget && (
        <ClosePositionModal
          position={closeTarget}
          onClose={() => setCloseTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {partialTarget && (
        <PartialExitModal
          position={partialTarget}
          onClose={() => setPartialTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {confirmDel.type === 'trade' ? 'Delete entire trade?' : 'Delete this action?'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {confirmDel.type === 'trade'
                ? `This will delete all actions for ${confirmDel.target.symbol}. This cannot be undone.`
                : 'This action row will be removed. The position will recalculate.'}
            </p>
            {deleteErr && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-3">{deleteErr}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmDel(null); setDeleteErr(null) }}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
