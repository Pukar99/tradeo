// =============================================================================
// FocusedCyclePanel.jsx — right panel for the FOCUSED cycle (S3 §8.4.2).
// Chart stays on TOP; below it a General | Sector | Stocks toggle.
//   General — cycle identity in ONE place (name·phase·pct·dates·duration·
//             From/To·Need%/Recovered) + stat strip.
//   Sector  — sector returns as today (drill-down kept); focused BULL also
//             shows sectors' recovery of the PRECEDING bear (owner-flippable).
//   Stocks  — MARKET-WIDE sortable list for the cycle (movers full variant),
//             NEPSE-comparison column; click charts it on top.
// =============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { getCycleMovers, runDropAnalysis } from '../../../api'
import { apiError, isCanceled } from '../../../utils/format'
import { CARD, LABEL, STITLE, Skeleton, fmtPct } from '../../datalab/shared'
import ViewSwitcher from '../../shared/ViewSwitcher'
import { stripIndexName, pctTextCls, phaseCls } from './helpers'
import { PriceChart, SectorIndexChart } from './charts'
import { SectorMatrix, StockList } from './SectorMatrix'
import { ResilientTile, Stat } from './atoms'
import { cycleKey } from './useCycleSelection'

const PANEL_VIEWS = [
  { id: 'general', label: 'General' },
  { id: 'sector', label: 'Sector' },
  { id: 'stocks', label: 'Stocks' },
]

export default function FocusedCyclePanel(props) {
  const {
    focused,
    cycleCandles,
    dark,
    selectedIndexLabel,
    indexLabel,
    selectedStock,
    stockCandles,
    stockLoading,
    stockError,
    onStockSelect,
    activeSector,
    summary,
    onClose,
  } = props
  const [view, setView] = useState('general')
  useEffect(() => setView('general'), [focused && cycleKey(focused)]) // eslint-disable-line react-hooks/exhaustive-deps

  const idxLabel = indexLabel || selectedIndexLabel

  return (
    <>
      {/* Slim tinted header — arrow+name · phase · pct · close */}
      <div
        className={`shrink-0 px-3 py-2 border-b
        ${
          focused.type === 'bull'
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40'
            : 'bg-red-50/70 dark:bg-red-950/20 border-red-100 dark:border-red-900/40'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-black ${focused.type === 'bull' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
          >
            {focused.type === 'bull' ? '▲' : '▼'}{' '}
            {focused.name || (focused.type === 'bull' ? 'Bull' : 'Bear')}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${phaseCls(focused.phase)}`}
          >
            {focused.phase}
          </span>
          <span
            className={`text-[18px] font-black tabular-nums ml-auto
            ${focused.type === 'bull' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
          >
            {focused.pct >= 0 ? '+' : ''}
            {focused.pct?.toFixed(1)}%
          </span>
          <button
            onClick={onClose}
            aria-label="Close cycle detail"
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 text-[13px] leading-none"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-white/40 dark:bg-gray-950/40 p-3 space-y-3">
        {/* Chart: cycle / sector / stock */}
        <div className={`${CARD} p-2`}>
          {selectedStock ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => onStockSelect(selectedStock)}
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                >
                  ← back
                </button>
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">
                  {selectedStock.symbol}
                </span>
                <span
                  className={`text-[10px] font-bold ml-auto ${pctTextCls(selectedStock.drop_pct)}`}
                >
                  {selectedStock.drop_pct != null
                    ? `${selectedStock.drop_pct >= 0 ? '+' : ''}${selectedStock.drop_pct.toFixed(1)}%`
                    : ''}
                </span>
              </div>
              {stockError && (
                <div className="text-[10px] text-red-500 px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded mb-1">
                  {stockError}
                </div>
              )}
              {stockLoading ? (
                <Skeleton minH={260} />
              ) : (
                <PriceChart
                  candles={stockCandles}
                  startDate={focused.start_date}
                  endDate={focused.end_date}
                  type={focused.type}
                  dark={dark}
                  label={selectedStock.symbol}
                  height={260}
                />
              )}
            </div>
          ) : activeSector && activeSector.index_name !== 'NEPSE' ? (
            <SectorIndexChart sector={activeSector} cycle={focused} dark={dark} />
          ) : (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 font-mono">
                {idxLabel}
              </p>
              <PriceChart
                candles={cycleCandles}
                startDate={focused.start_date}
                endDate={focused.end_date}
                type={focused.type}
                dark={dark}
                label={idxLabel}
                height={260}
              />
            </div>
          )}
        </div>

        <ViewSwitcher views={PANEL_VIEWS} active={view} onChange={setView} ariaLabel="Cycle detail view" />

        {view === 'general' && <GeneralView focused={focused} summary={summary} />}
        {view === 'sector' && <SectorView {...props} />}
        {view === 'stocks' && (
          <CycleStocksList
            cycle={focused}
            indexId={props.indexId}
            selected={selectedStock}
            onSelect={onStockSelect}
          />
        )}
      </div>
    </>
  )
}

function GeneralView({ focused, summary }) {
  return (
    <div className="space-y-3">
      <div className={`${CARD} p-3 space-y-2`}>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
          {focused.start_date} → {focused.end_date} · {focused.duration_days}d
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
          {focused.start_close != null && (
            <span className="text-gray-500 dark:text-gray-400">
              <span className={LABEL}>From </span>
              <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                {(+focused.start_close).toLocaleString()}
              </span>
            </span>
          )}
          {focused.end_close != null && (
            <span className="text-gray-500 dark:text-gray-400">
              <span className={LABEL}>To </span>
              <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                {(+focused.end_close).toLocaleString()}
              </span>
            </span>
          )}
          {focused.type === 'bear' && focused.recovery_needed_pct != null && (
            <span className="text-gray-500 dark:text-gray-400">
              <span className={LABEL}>Need </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{focused.recovery_needed_pct.toFixed(1)}%
              </span>
            </span>
          )}
          {focused.type === 'bear' && focused.recovery_date && (
            <span className="text-gray-500 dark:text-gray-400">
              <span className={LABEL}>Recovered </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                {focused.recovery_date}
              </span>
            </span>
          )}
        </div>
      </div>
      {summary && (
        <div className={`${CARD} px-3 py-2 flex divide-x divide-gray-100 dark:divide-gray-800`}>
          <Stat
            l="Move"
            v={`${focused.pct >= 0 ? '+' : ''}${focused.pct?.toFixed(1)}%`}
            tone={focused.type === 'bull' ? 'green' : 'red'}
          />
          <Stat l="Days" v={`${focused.duration_days}`} />
          {focused.type === 'bear' && (
            <>
              <Stat
                l="Rec %"
                v={
                  summary.recovery_pct != null
                    ? `${summary.recovery_pct >= 0 ? '+' : ''}${summary.recovery_pct.toFixed(1)}%`
                    : '—'
                }
                tone={summary.recovery_pct > 0 ? 'green' : 'gray'}
              />
              <Stat
                l="Rec d"
                v={focused.recovery_days != null ? `${focused.recovery_days}` : '—'}
                tone={focused.recovery_date ? 'green' : 'amber'}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SectorView(props) {
  const {
    focused,
    cycles,
    indexId,
    matrixRows,
    nepseRow,
    sectors,
    maxMoveAbs,
    sortBy,
    sortAsc,
    onSort,
    analyzing,
    analyzeError,
    onDismissAnalyzeError,
    activeSector,
    onSectorClick,
    sectorStocks,
    sectorLoading,
    onStockSelect,
    selectedStock,
  } = props
  // Preceding bear = the last bear that ended on/before this bull began.
  const precedingBear = useMemo(
    () =>
      focused.type === 'bull'
        ? [...cycles].filter((c) => c.type === 'bear' && c.end_date <= focused.start_date).pop() || null
        : null,
    [focused, cycles]
  )
  return (
    <div className="space-y-3">
      {analyzeError && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-lg text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{analyzeError}</span>
          <button onClick={onDismissAnalyzeError} className="font-bold ml-4">
            ×
          </button>
        </div>
      )}
      {analyzing ? (
        <div className={`${CARD}`}>
          <Skeleton minH={200} />
        </div>
      ) : sectors.length === 0 ? (
        <div
          className={`${CARD} flex items-center justify-center py-6 text-[11px] text-gray-400`}
        >
          No sector data for this cycle
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="max-h-[320px] overflow-y-auto">
            <SectorMatrix
              rows={matrixRows}
              activeSectorName={activeSector?.index_name}
              onRowClick={onSectorClick}
              cycleType={focused.type}
              sortBy={sortBy}
              sortAsc={sortAsc}
              onSort={onSort}
              maxMoveAbs={maxMoveAbs}
            />
          </div>
        </div>
      )}

      {/* Sector zoom: stocks inline */}
      {activeSector && activeSector.index_name !== 'NEPSE' && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
            <span className={STITLE}>{stripIndexName(activeSector.index_name)}</span>
            <span className="text-[10px] text-gray-400 ml-auto">click to chart</span>
            <button
              onClick={() => onSectorClick(activeSector)}
              className="text-gray-300 hover:text-gray-500 text-[14px] leading-none"
            >
              ×
            </button>
          </div>
          <div className="max-h-[320px] overflow-auto">
            <StockList
              stocks={sectorStocks[activeSector.index_name]}
              loading={!!sectorLoading[activeSector.index_name]}
              onSelect={onStockSelect}
              selected={selectedStock}
            />
          </div>
        </div>
      )}

      {/* Resilience tile (bear only, after analysis) */}
      {focused.type === 'bear' && !analyzing && sectors.length > 0 && (
        <ResilientTile sectors={[...(nepseRow ? [nepseRow] : []), ...sectors]} />
      )}

      {precedingBear && <PrecedingBearRecovery bear={precedingBear} indexId={indexId} />}
    </div>
  )
}

// Owner-flippable default (spec §8.4.2 Sector): for a focused BULL, show how
// each sector recovered from the PRECEDING bear.
function PrecedingBearRecovery({ bear, indexId }) {
  const [sectors, setSectors] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const ctrl = new AbortController()
    setSectors(null)
    setError('')
    runDropAnalysis(
      { peak_date: bear.start_date, trough_date: bear.end_date, index_id: indexId },
      { signal: ctrl.signal }
    )
      .then((r) => {
        if (ctrl.signal.aborted) return
        setSectors(
          [...(r.data.sectors || [])].sort(
            (a, b) => (b.recovery_progress ?? -1) - (a.recovery_progress ?? -1)
          )
        )
      })
      .catch((e) => {
        if (ctrl.signal.aborted || isCanceled(e)) return
        setError(apiError(e, 'Failed to load recovery'))
      })
    return () => ctrl.abort()
  }, [bear.start_date, bear.end_date, indexId])

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
        <span className={STITLE}>Recovery from {bear.name || 'the preceding bear'}</span>
        <p className={`${LABEL} normal-case mt-0.5`}>
          how each sector climbed back before this bull
        </p>
      </div>
      {error && <div className="px-3 py-2 text-[10px] text-red-500">{error}</div>}
      {!sectors && !error ? (
        <Skeleton minH={100} />
      ) : (
        <div className="max-h-[240px] overflow-y-auto">
          {(sectors || []).map((s) => (
            <div key={s.index_name} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0">
              <span className="text-[11px] font-medium text-gray-800 dark:text-gray-100 truncate w-[130px]">
                {stripIndexName(s.index_name)}
              </span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, s.recovery_progress || 0)}%`,
                    background: s.fully_recovered ? '#10b981' : '#f59e0b',
                  }}
                />
              </div>
              <span className={`w-12 text-right text-[10px] font-semibold tabular-nums ${s.fully_recovered ? 'text-emerald-500' : 'text-amber-500'}`}>
                {(s.recovery_progress || 0).toFixed(0)}%
              </span>
              <span className="w-10 text-right text-[10px] text-gray-400 tabular-nums">
                {s.fully_recovered && s.recovery_days != null ? `${s.recovery_days}d` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Stocks view (spec §8.4.2): every covered symbol in THIS cycle, sortable
// gainer ↔ loser, with a NEPSE-comparison column. Click a stock → charts it.
function CycleStocksList({ cycle, indexId, selected, onSelect }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [desc, setDesc] = useState(true) // true = gainers first
  const ctrlRef = useRef(null)

  useEffect(() => {
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setData(null)
    setError('')
    getCycleMovers(
      {
        cycles: [{ start_date: cycle.start_date, end_date: cycle.end_date, type: cycle.type }],
        full: true,
        index_id: indexId,
      },
      { signal: ctrl.signal }
    )
      .then((r) => { if (!ctrl.signal.aborted) setData(r.data) })
      .catch((e) => {
        if (ctrl.signal.aborted || isCanceled(e)) return
        setError(apiError(e, 'Failed to load stocks'))
      })
    return () => ctrl.abort()
  }, [cycle.start_date, cycle.end_date, cycle.type, indexId])

  const rows = useMemo(() => {
    const s = data?.stocks || []
    return desc ? s : [...s].reverse() // server sorts avg_ret desc — reverse = losers first
  }, [data, desc])

  if (error) return <div className={`${CARD} px-3 py-2 text-[10px] text-red-500`}>{error}</div>
  if (!data) return <div className={CARD}><Skeleton minH={200} /></div>

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
        <span className={STITLE}>All stocks · {data.total_symbols}</span>
        <button
          onClick={() => setDesc((d) => !d)}
          className={`${LABEL} normal-case ml-auto hover:text-gray-600 dark:hover:text-gray-300`}
        >
          {desc ? 'gainers first ↓' : 'losers first ↑'}
        </button>
      </div>
      <div className={`grid grid-cols-[1fr_4rem_4.5rem] gap-2 px-3 py-1 ${LABEL} border-b border-gray-50 dark:border-gray-800/60`}>
        <span>Stock</span><span className="text-right">Return</span><span className="text-right">vs NEPSE</span>
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {rows.map((s) => (
          <button
            key={s.symbol}
            onClick={() => onSelect(selected?.symbol === s.symbol ? s : { symbol: s.symbol, drop_pct: s.avg_ret })}
            className={`w-full grid grid-cols-[1fr_4rem_4.5rem] gap-2 items-center px-3 py-1 text-left border-b border-gray-50 dark:border-gray-800/60 last:border-b-0 transition-colors
              ${selected?.symbol === s.symbol ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'}`}
          >
            <span className="min-w-0">
              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{s.symbol}</span>
              <span className="block text-[10px] text-gray-400 truncate">{s.company_name}</span>
            </span>
            <span className={`text-right text-[11px] font-bold tabular-nums ${pctTextCls(s.avg_ret)}`}>{fmtPct(s.avg_ret)}</span>
            <span className={`text-right text-[10px] font-semibold tabular-nums ${s.vs_index >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmtPct(s.vs_index)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
