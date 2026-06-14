// === insight/useMonthDetail.js — LRU caches + shared month-detail data layer ===
import { useState, useEffect } from 'react'
import {
  getMonthDetail,
  getSectorMonth,
  getSectorMonthStocks,
  getStockMonthDetail,
} from '../../../api/index'
import { apiError, isCanceled } from '../../../utils/format'
import { makeLruCache } from '../../../utils/lruCache'

// ─── Module-level LRU caches (Rule 46) ────────────────────────────────────────
// One factory (utils/lruCache), three caches: month detail, sector month,
// sector stocks. Why this matters: ← → month navigation used to cost 4 uncached
// API calls per press, and Maximize re-fetched everything the panel already had.
const monthDetailCache = makeLruCache(40, 10 * 60_000)
const sectorMonthCache = makeLruCache(60, 10 * 60_000)
const stockMonthDetailCache = makeLruCache(60, 10 * 60_000)
export const sectorStocksCache = makeLruCache(60, 10 * 60_000)

async function fetchMonthDetail(indexId, year, month, signal) {
  const key = `${indexId}:${year}-${month}`
  const hit = monthDetailCache.get(key)
  if (hit) return hit
  const r = await getMonthDetail({ index_id: indexId, year, month }, { signal })
  monthDetailCache.set(key, r.data)
  return r.data
}
async function fetchStockMonthDetail(symbol, year, month, signal) {
  const key = `${symbol}:${year}-${month}`
  const hit = stockMonthDetailCache.get(key)
  if (hit) return hit
  const r = await getStockMonthDetail({ symbol, year, month }, { signal })
  stockMonthDetailCache.set(key, r.data)
  return r.data
}
async function fetchSectorMonth(year, month, signal) {
  const key = `${year}-${month}`
  const hit = sectorMonthCache.get(key)
  if (hit) return hit
  const r = await getSectorMonth({ year, month }, { signal })
  const sectors = r.data?.sectors || []
  sectorMonthCache.set(key, sectors)
  return sectors
}
export async function fetchSectorStocks(sectorIndex, year, month, signal) {
  const key = `${sectorIndex}:${year}:${month}`
  const hit = sectorStocksCache.get(key)
  if (hit) return hit
  const r = await getSectorMonthStocks({ sector_index: sectorIndex, year, month }, { signal })
  const stocks = r.data?.stocks || []
  sectorStocksCache.set(key, stocks)
  return stocks
}

function priorMonth(y, m, back) {
  let mo = m - back,
    yr = y
  while (mo <= 0) {
    mo += 12
    yr--
  }
  return { year: yr, month: mo }
}

// ─── useMonthDetail — shared data layer for InlineRightPanel + InspectOverlay ─
// Fetches month detail + sector returns + 2 prior months for momentum sparklines.
// Previously duplicated verbatim in both components (~120 lines); the caches
// above make Maximize and back-and-forth month navigation effectively free.
//
// `symbol` switches the source to a single stock (stock-month-detail): candles
// and stats keep the same shape (plus nepse_return / relative_strength), and
// the sector layers are skipped — sector drill-down has no meaning for one stock.
export function useMonthDetail(cell, indexId, symbol = null) {
  const [state, setState] = useState({
    loading: false,
    candles: null,
    stats: null,
    sectors: null,
    available: true,
    dataError: null,
  })
  const [sectorHistory, setSectorHistory] = useState({})

  useEffect(() => {
    if (!cell) return
    const ctrl = new AbortController()
    setState({
      loading: true,
      candles: null,
      stats: null,
      sectors: null,
      available: true,
      dataError: null,
    })
    setSectorHistory({})
    const detail = symbol
      ? Promise.all([
          fetchStockMonthDetail(symbol, cell.year, cell.month, ctrl.signal),
          Promise.resolve(null),
        ])
      : Promise.all([
          fetchMonthDetail(indexId, cell.year, cell.month, ctrl.signal),
          fetchSectorMonth(cell.year, cell.month, ctrl.signal),
        ])
    detail
      .then(([det, sectors]) => {
        if (ctrl.signal.aborted) return
        if (!det.available) {
          setState((s) => ({ ...s, loading: false, available: false }))
          return
        }
        setState({
          loading: false,
          candles: det.candles || [],
          stats: det.stats || null,
          sectors,
          available: true,
          dataError: null,
        })
      })
      .catch((err) => {
        if (ctrl.signal.aborted || isCanceled(err)) return
        setState((s) => ({ ...s, loading: false, dataError: apiError(err, 'Failed to load data') }))
      })
    return () => ctrl.abort()
  }, [cell?.year, cell?.month, indexId, symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  const { sectors } = state
  useEffect(() => {
    if (!cell || !sectors?.length) return
    const ctrl = new AbortController()
    const p1 = priorMonth(cell.year, cell.month, 1)
    const p2 = priorMonth(cell.year, cell.month, 2)
    Promise.all([
      fetchSectorMonth(p2.year, p2.month, ctrl.signal).catch(() => []),
      fetchSectorMonth(p1.year, p1.month, ctrl.signal).catch(() => []),
    ]).then(([s2, s1]) => {
      if (ctrl.signal.aborted) return
      const h = {}
      sectors.forEach((s) => {
        if (!s.name) return
        h[s.name] = [
          s2.find((x) => x.name === s.name)?.return_pct ?? null,
          s1.find((x) => x.name === s.name)?.return_pct ?? null,
          s.return_pct,
        ]
      })
      setSectorHistory(h)
    })
    return () => ctrl.abort()
  }, [cell?.year, cell?.month, sectors]) // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, sectorHistory }
}
