import axios from 'axios'
import { BASE_URL } from './index'

const API = axios.create({ baseURL: BASE_URL })

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Symbols & OHLCV ───────────────────────────────────────────────────────────
export const btGetSymbols      = ()                    => API.get('/api/backtest/symbols')
export const btGetOHLCV        = (symbol, from, to)    => API.get('/api/backtest/ohlcv', { params: { symbol, from, to } })
export const btGetSettlementDate = (entry_date)        => API.get('/api/backtest/settlement-date', { params: { entry_date } })

// ── Session ───────────────────────────────────────────────────────────────────
export const btCreateSession   = (data)                => API.post('/api/backtest/session', data)
export const btGetSession      = ()                    => API.get('/api/backtest/session')
export const btUpdateSession   = (id, data)            => API.put(`/api/backtest/session/${id}`, data)
export const btEndSession      = (id)                  => API.delete(`/api/backtest/session/${id}`)
export const btAddScript       = (id, data)            => API.post(`/api/backtest/session/${id}/script`, data)

// ── Orders ────────────────────────────────────────────────────────────────────
export const btPlaceOrder      = (id, data)            => API.post(`/api/backtest/session/${id}/order`, data)
export const btUpdateSLTP      = (id, orderId, data)   => API.put(`/api/backtest/session/${id}/order/${orderId}`, data)
export const btSettleOrder     = (id, orderId)         => API.post(`/api/backtest/session/${id}/order/${orderId}/settle`)
export const btExitOrder       = (id, orderId, data)   => API.post(`/api/backtest/session/${id}/order/${orderId}/exit`, data)
export const btPartialExit     = (id, orderId, data)   => API.post(`/api/backtest/session/${id}/order/${orderId}/partial`, data)

// ── Behavior log ──────────────────────────────────────────────────────────────
export const btLogBehavior     = (id, data)            => API.post(`/api/backtest/session/${id}/behavior`, data)

// ── Report ────────────────────────────────────────────────────────────────────
export const btGetReport       = (id)                  => API.get(`/api/backtest/session/${id}/report`)
