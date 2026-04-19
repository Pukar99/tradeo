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

// Auto-logout on 401 (expired/invalid token)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      sessionStorage.removeItem('briefingShown')
      // Redirect to login if not already there
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const loginUser = (data) => API.post('/api/auth/login', data)
export const signupUser = (data) => API.post('/api/auth/signup', data)

// Market
export const getStocks = () => API.get('/api/stocks')
export const getMarketSummary = () => API.get('/api/market-summary')
export const getTopGainers = () => API.get('/api/top-gainers')
export const getStockPrice = (symbol) => API.get(`/api/market/stock-price/${symbol}`)

// Journal (old general journal - keep for now)
export const getJournal = () => API.get('/api/journal')
export const addJournalEntry = (data) => API.post('/api/journal', data)
export const updateJournalEntry = (id, data) => API.put(`/api/journal/${id}`, data)
export const deleteJournalEntry = (id) => API.delete(`/api/journal/${id}`)

// Dashboard
export const getTodayTasks = () => API.get('/api/dashboard/tasks/today')
export const toggleFixedTask = (taskId) => API.post('/api/dashboard/tasks/toggle-fixed', { taskId })
export const addCustomTask = (title) => API.post('/api/dashboard/tasks/custom', { title })
export const updateCustomTask = (id, completed) => API.put(`/api/dashboard/tasks/custom/${id}`, { completed })
export const deleteCustomTask = (id) => API.delete(`/api/dashboard/tasks/custom/${id}`)
export const getDiscipline = () => API.get('/api/dashboard/discipline')
export const getGoals = () => API.get('/api/dashboard/goals')
export const addGoal = (data) => API.post('/api/dashboard/goals', data)
export const updateGoal = (id, data) => API.put(`/api/dashboard/goals/${id}`, typeof data === 'boolean' ? { completed: data } : data)
export const deleteGoal = (id) => API.delete(`/api/dashboard/goals/${id}`)
export const getWatchlist = () => API.get('/api/dashboard/watchlist')
export const addToWatchlist = (data) => API.post('/api/dashboard/watchlist', data)
export const updateWatchlist = (id, data) => API.put(`/api/dashboard/watchlist/${id}`, data)
export const removeFromWatchlist = (id) => API.delete(`/api/dashboard/watchlist/${id}`)
export const getMindset = () => API.get('/api/dashboard/mindset')
export const checkPriceAlerts = () => API.get('/api/dashboard/alerts/check')
export const saveMindset = (content) => API.post('/api/dashboard/mindset', { content })

// Research
export const getResearchPosts = () => API.get('/api/research/posts')
export const getResearchPost = (id) => API.get(`/api/research/posts/${id}`)
export const getMyResearchPosts = () => API.get('/api/research/my-posts')
export const getResearchEligibility = () => API.get('/api/research/eligibility')
export const createResearchPost = (data) => API.post('/api/research/posts', data)
export const updateResearchPost = (id, data) => API.put(`/api/research/posts/${id}`, data)
export const deleteResearchPost = (id) => API.delete(`/api/research/posts/${id}`)
export const verifyResearchPost = (id) => API.post(`/api/research/posts/${id}/verify`)
export const pinResearchPost = (id) => API.post(`/api/research/posts/${id}/pin`)
export const addResearchComment = (data) => API.post('/api/research/comments', data)
export const deleteResearchComment = (id) => API.delete(`/api/research/comments/${id}`)
export const getAdminPending = () => API.get('/api/research/admin/pending')
export const uploadResearchFile = (formData) => API.post('/api/research/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})

// Profile
export const getProfile = () => API.get('/api/profile')
export const updateProfile = (data) => API.put('/api/profile', data)
export const uploadAvatar = (formData) => API.post('/api/profile/avatar', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const changePassword = (data) => API.put('/api/profile/password', data)

// AI Chat
export const sendChatMessage = (data) => API.post('/api/chat/message', data)
export const sendAgentMessage = (data) => API.post('/api/chat/agent', data)
export const getChatSuggestions = () => API.get('/api/chat/suggestions')
export const getTraderProfile = () => API.get('/api/chat/trader-profile')

// Market — new DB-backed endpoints
export const getMarketSymbols  = ()             => API.get('/api/market/symbols')
export const getIndexChart     = (params)       => API.get('/api/market/index-chart', { params })
export const getStockChart     = (params)       => API.get('/api/market/stock-chart', { params })
export const getTopVolume      = (params)       => API.get('/api/market/top-volume', { params })
export const getLatestDate     = ()             => API.get('/api/market/latest-date')
export const getMarketDates    = ()             => API.get('/api/market/dates')
export const getTopMovers      = (date)         => API.get('/api/market/top-movers', { params: { date } })
export const getAIReport       = ()             => API.get('/api/market/ai-report')
export const getIPOs           = ()             => API.get('/api/market/ipos')
export const getMarketNews     = ()             => API.get('/api/market/news')
export const getSectorStrength = ()             => API.get('/api/market/sector-strength')

// Trade Log (new system)
export const getTradeLog = () => API.get('/api/tradelog')
export const addTradeLog = (data) => API.post('/api/tradelog', data)
export const updateTradeLog = (id, data) => API.put(`/api/tradelog/${id}`, data)
export const closeTradeLog = (id, data) => API.post(`/api/tradelog/${id}/close`, data)
export const partialCloseTradeLog = (id, data) => API.post(`/api/tradelog/${id}/partial-close`, data)
export const deleteTradeLog = (id) => API.delete(`/api/tradelog/${id}`)
export const bulkDeleteTradeLog = (ids) => API.delete('/api/tradelog/bulk', { data: { ids } })
export const getTradeJournal = () => API.get('/api/tradelog/journal')
export const addTradeJournal = (data) => API.post('/api/tradelog/journal', data)
export const updateTradeJournal = (id, data) => API.put(`/api/tradelog/journal/${id}`, data)
export const deleteTradeJournal = (id) => API.delete(`/api/tradelog/journal/${id}`)

// Complex Tab — Insight
export const getInsightSignals      = (params) => API.get('/api/insight/signals',        { params })
export const getMonthlyReturns      = (params) => API.get('/api/insight/monthly-returns', { params })
export const getMonthDetail         = (params) => API.get('/api/insight/month-detail',    { params })
export const getSectorMonth         = (params) => API.get('/api/insight/sector-month',    { params })

// Complex Tab — Breakdown
export const scanBreakdown          = (data)   => API.post('/api/breakdown/scan',         data)
export const getSectorYear          = (params) => API.get('/api/breakdown/sector-year',   { params })
export const getSectorHistory       = (params) => API.get('/api/breakdown/sector-history',{ params })
export const getStockReturns        = (params) => API.get('/api/breakdown/stock-returns', { params })
export const getStockMonthDetail    = (params) => API.get('/api/breakdown/stock-month-detail', { params })
export const getSectorMonthStocks   = (params) => API.get('/api/breakdown/sector-month-stocks', { params })

// Complex Tab — Trade Behavior
export const getBehaviorStats = (params) => API.get('/api/behavior/stats', { params })

// Complex Tab — Market Regime
export const getRegime = (params) => API.get('/api/regime/detect', { params })

// Complex Tab — Swing Structure
export const getSwings = (params) => API.get('/api/structure/swings', { params })

// Complex Tab — Volatility
export const getVolatilityClusters = (params) => API.get('/api/volatility/clusters', { params })

// Complex Tab — Smart Screener
export const runScreener = (params) => API.get('/api/screener/scan', { params })

// AI Trade Coach — auto-debrief after trade close
export const getTradeDebrief = (tradeData) => API.post('/api/chat/debrief', tradeData)

// What If I Had Held? Simulator
export const getWhatIf = (params) => API.get('/api/market/what-if', { params })

// Corporate Actions Calendar
export const getCorporateActions = () => API.get('/api/market/corporate-actions')

// Tax Report
export const getTaxReport        = (fy)       => API.get('/api/tax/report', { params: fy ? { fy } : {} })

// Rules Library
export const getRules            = ()         => API.get('/api/rules')
export const addRule             = (data)     => API.post('/api/rules', data)
export const updateRule          = (id, data) => API.put(`/api/rules/${id}`, data)
export const deleteRule          = (id)       => API.delete(`/api/rules/${id}`)
export const getRuleViolations   = ()         => API.get('/api/rules/violations')

// Community Benchmarks
export const getBenchmarkCompare = ()         => API.get('/api/benchmark/compare')
export const benchmarkContribute = ()         => API.post('/api/benchmark/contribute')
export const benchmarkOptOut     = ()         => API.post('/api/benchmark/opt-out')

// Meroshare
export const getMeroshareDpList      = ()              => API.get('/api/meroshare/dp-list')
export const getMeroshareAccounts    = ()              => API.get('/api/meroshare/accounts')
export const addMeroshareAccount     = (data)          => API.post('/api/meroshare/accounts', data)
export const deleteMeroshareAccount  = (id)            => API.delete(`/api/meroshare/accounts/${id}`)
export const getMeroshareIPOs        = (accountId)     => API.get('/api/meroshare/ipos', { params: accountId ? { account_id: accountId } : {} })
export const getMeroshareResults     = (accountId)     => API.get('/api/meroshare/results', { params: accountId ? { account_id: accountId } : {} })
export const applyMeroshareIPO       = (data)          => API.post('/api/meroshare/apply', data)
export const applyMeroshareIPOBulk   = (data)          => API.post('/api/meroshare/apply-bulk', data)
export const getMerosharePortfolio   = (accountId)     => API.get('/api/meroshare/portfolio', { params: accountId ? { account_id: accountId } : {} })
export const cancelMeroshareIPO      = (data)          => API.post('/api/meroshare/cancel', data)