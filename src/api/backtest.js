// =============================================================================
// api/backtest.js — Backtest API wrappers
// =============================================================================
// Sections:
//   1. Symbols & OHLCV  — symbols list, OHLCV data, settlement date
//   2. Session          — create, get, update, end, add script
//   3. Orders           — place, update SL/TP, settle, exit, partial exit
//   4. Behavior Log     — log behavior entry
//   5. Report           — get session report
// =============================================================================
// Uses the shared API instance from api/index.js — inherits auth header injection
// and the 300ms dedup interceptor (prevents double-fire in React StrictMode).
// =============================================================================

import { API } from './index'

// =============================================================================
// 1. SYMBOLS & OHLCV
// =============================================================================

export const btGetSymbols = () => API.get('/api/backtest/symbols')
export const btGetSymbolMeta = (symbol) =>
  API.get('/api/backtest/symbol-meta', { params: { symbol } })
export const btGetOHLCV = (symbol, from, to) =>
  API.get('/api/backtest/ohlcv', { params: { symbol, from, to } })
export const btGetSettlementDate = (entry_date) =>
  API.get('/api/backtest/settlement-date', { params: { entry_date } })

// =============================================================================
// 2. SESSION
// =============================================================================

export const btCreateSession = (data) => API.post('/api/backtest/session', data)
export const btGetHistory = (limit = 10, offset = 0) =>
  API.get('/api/backtest/history', { params: { limit, offset } })
export const btDeleteHistory = (id) => API.delete(`/api/backtest/history/${id}`)
export const btGetSession = () => API.get('/api/backtest/session')
export const btUpdateSession = (id, data) => API.put(`/api/backtest/session/${id}`, data)
export const btEndSession = (id) => API.delete(`/api/backtest/session/${id}`)
export const btAddScript = (id, data) => API.post(`/api/backtest/session/${id}/script`, data)

// =============================================================================
// 3. ORDERS
// =============================================================================

export const btPlaceOrder = (id, data) => API.post(`/api/backtest/session/${id}/order`, data)
export const btUpdateSLTP = (id, orderId, data) =>
  API.put(`/api/backtest/session/${id}/order/${orderId}`, data)
export const btSettleOrder = (id, orderId) =>
  API.post(`/api/backtest/session/${id}/order/${orderId}/settle`)
export const btExitOrder = (id, orderId, data) =>
  API.post(`/api/backtest/session/${id}/order/${orderId}/exit`, data)
export const btPartialExit = (id, orderId, data) =>
  API.post(`/api/backtest/session/${id}/order/${orderId}/partial`, data)

// =============================================================================
// 4. BEHAVIOR LOG
// =============================================================================

export const btLogBehavior = (id, data) => API.post(`/api/backtest/session/${id}/behavior`, data)

// =============================================================================
// 5. REPORT
// =============================================================================

export const btGetReport = (id) => API.get(`/api/backtest/session/${id}/report`)
