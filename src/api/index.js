import axios from 'axios'

const API = axios.create({
  baseURL: 'http://localhost:5000',
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const getStocks = () => API.get('/api/stocks')
export const getMarketSummary = () => API.get('/api/market-summary')
export const getTopGainers = () => API.get('/api/top-gainers')
export const loginUser = (data) => API.post('/api/auth/login', data)
export const signupUser = (data) => API.post('/api/auth/signup', data)
export const getTrades = () => API.get('/api/trades')
export const addTrade = (data) => API.post('/api/trades', data)
export const deleteTrade = (id) => API.delete(`/api/trades/${id}`)
export const getTradeSummary = () => API.get('/api/trades/summary')
export const getPortfolio = () => API.get('/api/portfolio')
export const addPortfolioHolding = (data) => API.post('/api/portfolio', data)
export const getJournal = () => API.get('/api/journal')
export const addJournalEntry = (data) => API.post('/api/journal', data)
export const updateJournalEntry = (id, data) => API.put(`/api/journal/${id}`, data)
export const deleteJournalEntry = (id) => API.delete(`/api/journal/${id}`)
export const getTodayTasks = () => API.get('/api/dashboard/tasks/today')
export const toggleFixedTask = (taskId) => API.post('/api/dashboard/tasks/toggle-fixed', { taskId })
export const addCustomTask = (title) => API.post('/api/dashboard/tasks/custom', { title })
export const updateCustomTask = (id, completed) => API.put(`/api/dashboard/tasks/custom/${id}`, { completed })
export const deleteCustomTask = (id) => API.delete(`/api/dashboard/tasks/custom/${id}`)
export const getDiscipline = () => API.get('/api/dashboard/discipline')
export const getGoals = () => API.get('/api/dashboard/goals')
export const addGoal = (data) => API.post('/api/dashboard/goals', data)
export const updateGoal = (id, completed) => API.put(`/api/dashboard/goals/${id}`, { completed })
export const deleteGoal = (id) => API.delete(`/api/dashboard/goals/${id}`)
export const getWatchlist = () => API.get('/api/dashboard/watchlist')
export const addToWatchlist = (data) => API.post('/api/dashboard/watchlist', data)
export const removeFromWatchlist = (id) => API.delete(`/api/dashboard/watchlist/${id}`)
export const getMindset = () => API.get('/api/dashboard/mindset')
export const saveMindset = (content) => API.post('/api/dashboard/mindset', { content })
export const getStockPrice = (symbol) => API.get(`/api/market/stock-price/${symbol}`)