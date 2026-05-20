import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const API = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s — Render free tier cold-starts can take 30–50s
  withCredentials: true, // send HttpOnly auth cookie cross-origin (Vercel → Render)
})

// ── Request counter + 300ms dedup (dev-mode diagnostics) ─────────────────────
const _reqLog = { count: 0, endpoints: {} }
const _inFlight = new Map()  // key → { ts: timestamp, promise, resolve, reject }
const DEDUP_MS = 300

if (import.meta.env.DEV) {
  setInterval(() => {
    if (_reqLog.count === 0) return
    console.groupCollapsed(`[Tradeo API] ${_reqLog.count} requests in last 60s`)
    Object.entries(_reqLog.endpoints)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ep, n]) => console.log(`  ${n}× ${ep}`))
    console.groupEnd()
    _reqLog.count = 0
    _reqLog.endpoints = {}
  }, 60_000)
}

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Dedup identical GET requests fired within DEDUP_MS of each other.
  // Stores the in-flight promise so all callers get the same result — no forever-pending promises.
  if (config.method === 'get') {
    const key = config.url + JSON.stringify(config.params || '')
    const entry = _inFlight.get(key)
    if (entry && Date.now() - entry.ts < DEDUP_MS) {
      // Return a new promise that mirrors the original request's outcome
      config._dedupPromise = entry.shared
      return Promise.reject(Object.assign(new axios.Cancel('dedup'), { _dedup: true, _sharedPromise: entry.shared }))
    }
    // Register this request; build a shared promise other callers can hook into
    let resolve, reject
    const shared = new Promise((res, rej) => { resolve = res; reject = rej })
    _inFlight.set(key, { ts: Date.now(), shared, resolve, reject })
    config._inFlightKey = key
  }

  if (import.meta.env.DEV) {
    const ep = config.method.toUpperCase() + ' ' + config.url
    _reqLog.count++
    _reqLog.endpoints[ep] = (_reqLog.endpoints[ep] || 0) + 1
  }

  return config
})

// Auto-logout on 401; dedup cancellations resolve/reject via the shared in-flight promise
API.interceptors.response.use(
  (response) => {
    // Resolve the shared promise so any dedup'd callers also get the result
    const key = response.config?._inFlightKey
    if (key) {
      const entry = _inFlight.get(key)
      if (entry) { entry.resolve(response); _inFlight.delete(key) }
    }
    return response
  },
  (error) => {
    if (error._dedup) {
      // Return the shared promise — dedup'd caller gets same resolution/rejection as primary
      return error._sharedPromise
    }
    // Primary request failed — reject the shared promise too
    const key = error.config?._inFlightKey
    if (key) {
      const entry = _inFlight.get(key)
      if (entry) { entry.reject(error); _inFlight.delete(key) }
    }
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Only force-redirect when the user HAD a token that expired mid-session.
      // If there was no token, the user is simply unauthenticated — let the page
      // handle it gracefully (show a login wall inline, not a hard redirect).
      if (hadToken) {
        const onAuthPage = ['/login', '/signup'].some(p => window.location.pathname.startsWith(p))
        if (!onAuthPage) {
          sessionStorage.setItem('authExpiredMsg', 'Your session has expired. Please log in again.')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// Wake Render free-tier instance on app load (fire-and-forget)
axios.get(`${BASE_URL}/`, { timeout: 60000 }).catch(() => {})

// Auth
export const loginUser = (data) => API.post('/api/auth/login', data)
export const signupUser = (data) => API.post('/api/auth/signup', data)

// Market
export const getStockPrice = (symbol) => API.get(`/api/market/stock-price/${symbol}`)
export const getBatchPrices = (symbols) => API.get('/api/market/batch-prices', { params: { symbols: symbols.join(',') } })

// Dashboard
export const getDashboardInit = () => API.get('/api/dashboard/init')
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
export const sendChatMessage    = (data)     => API.post('/api/chat/message', data)
export const sendAgentMessage   = (data)     => API.post('/api/chat/agent', data)
export const getChatSuggestions = ()         => API.get('/api/chat/suggestions')
export const getTraderProfile   = ()         => API.get('/api/chat/trader-profile')
export const transcribeAudio    = (formData) => API.post('/api/chat/transcribe', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})

// Chat sessions
export const saveChatSession    = (data)       => API.post('/api/chat/sessions', data)
export const listChatSessions   = ()           => API.get('/api/chat/sessions')
export const loadChatSession    = (id)         => API.get(`/api/chat/sessions/${id}`)
export const deleteChatSession  = (id)         => API.delete(`/api/chat/sessions/${id}`)

// Market — new DB-backed endpoints
export const getMarketSymbols  = ()             => API.get('/api/market/symbols')
export const getIndexChart     = (params)       => API.get('/api/market/index-chart', { params })
export const getStockChart     = (params, cfg)  => API.get('/api/market/stock-chart', { params, ...cfg })
export const getPerformance    = (params, cfg)  => API.get('/api/market/performance', { params, ...cfg })
export const getTopVolume      = (params)       => API.get('/api/market/top-volume', { params })
export const getLatestDate     = ()             => API.get('/api/market/latest-date')
export const getMarketDates    = ()             => API.get('/api/market/dates')
export const getTopMovers      = (date)         => API.get('/api/market/top-movers', { params: { date } })
export const getDaySummary     = (date)         => API.get('/api/market/day-summary', { params: { date } })
export const getDayFull        = (date)         => API.get('/api/market/day-full',    { params: { date } })
export const getNepseChart     = (range = '1m') => API.get('/api/market/nepse-chart', { params: { range } })
export const getAIReport       = ()             => API.get('/api/market/ai-report')
export const getIPOs           = ()             => API.get('/api/market/ipos')
export const getMarketNews     = ()             => API.get('/api/market/news')
export const triggerBackfill   = (date)         => API.post('/api/market/backfill', { date })

export const bulkImportTradeLog       = (trades, cfg)      => API.post('/api/tradelog/bulk', { trades }, cfg)
export const getPositions             = (status)          => API.get('/api/tradelog/positions', { params: status ? { status } : {} })
export const getTradeActions          = ()                => API.get('/api/tradelog/actions')
export const getTradeHistory          = (trade_id)        => API.get(`/api/tradelog/trade/${trade_id}/history`)
export const newPosition              = (data)            => API.post('/api/tradelog', data)
export const addToPosition            = (trade_id, data)  => API.post(`/api/tradelog/${trade_id}/add`, data)
export const partialExitPosition      = (trade_id, data)  => API.post(`/api/tradelog/${trade_id}/partial-exit`, data)
export const closePosition            = (trade_id, data)  => API.post(`/api/tradelog/${trade_id}/close`, data)
export const updateTradeAction        = (id, data)        => API.put(`/api/tradelog/${id}`, data)
export const deleteTradeAction        = (id)              => API.delete(`/api/tradelog/${id}`)
export const deleteEntireTrade        = (trade_id)        => API.delete(`/api/tradelog/trade/${trade_id}`)
export const getSetupTypes            = ()                => API.get('/api/tradelog/setup-types')
export const saveSetupType            = (name)            => API.post('/api/tradelog/setup-types', { name })

// Complex Tab — Insight
export const getInsightSignals      = (params) => API.get('/api/insight/signals',        { params })
export const getMonthlyReturns      = (params, cfg) => API.get('/api/insight/monthly-returns', { params, ...cfg })
export const getMonthDetail         = (params, cfg) => API.get('/api/insight/month-detail',    { params, ...cfg })
export const getSectorMonth         = (params, cfg) => API.get('/api/insight/sector-month',    { params, ...cfg })

// Complex Tab — Breakdown
export const scanBreakdown          = (data)   => API.post('/api/breakdown/scan',              data)
export const getSectorYear          = (params, cfg)   => API.get('/api/breakdown/sector-year',        { params, ...cfg })
export const getSectorCycles        = (data, cfg)     => API.post('/api/breakdown/sector-cycles',     data, cfg)
export const getSectorHistory       = (params) => API.get('/api/breakdown/sector-history',     { params })
export const getStockReturns        = (params) => API.get('/api/breakdown/stock-returns',      { params })
export const getStockMonthDetail    = (params) => API.get('/api/breakdown/stock-month-detail', { params })
export const getSectorMonthStocks   = (params, cfg) => API.get('/api/breakdown/sector-month-stocks',{ params, ...cfg })
export const getMarketCycles        = (params, cfg)   => API.get('/api/breakdown/market-cycles',      { params, ...cfg })
export const runDropAnalysis        = (data, cfg)     => API.post('/api/breakdown/drop-analysis',     data, cfg)
export const getSectorStocks        = (params, cfg)   => API.get('/api/breakdown/sector-stocks',      { params, ...cfg })
export const getSectorIndexChart    = (params, cfg)   => API.get('/api/breakdown/sector-index-chart', { params, ...cfg })
export const getStockPriceRange     = (params, cfg)   => API.get('/api/breakdown/stock-price-range',  { params, ...cfg })


// SMC (Smart Money Concepts) Scanner
export const getSMCScan = (params) => API.get('/api/smc/scan', { params })

// Price Action Scanner
export const getPriceActionScan = (params) => API.get('/api/market/price-action', { params })

// AI Trade Coach — auto-debrief after trade close
export const getTradeDebrief = (tradeData) => API.post('/api/chat/debrief', tradeData)

// What If I Had Held? Simulator
export const getWhatIf = (params) => API.get('/api/market/what-if', { params })

// Tax Report
export const getTaxReport        = (fy)       => API.get('/api/tax/report', { params: fy ? { fy } : {} })

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
export const getMeroshareToken       = (accountId) => API.get('/api/meroshare/token', { params: accountId ? { account_id: accountId } : {} })
export const getMeroshareAllotment   = (accountId, applicantFormId) => API.get('/api/meroshare/allotment', { params: { account_id: accountId, applicant_form_id: applicantFormId } })
export const getMeroshareBanks       = (accountId)     => API.get('/api/meroshare/banks', { params: accountId ? { account_id: accountId } : {} })
export const getMeroshareDisclaimer  = (accountId, companyShareId) => API.get('/api/meroshare/disclaimer', { params: { account_id: accountId, company_share_id: companyShareId } })
export const updateMeroshareAccount  = (id, data)      => API.put(`/api/meroshare/accounts/${id}`, data)
export const toggleMeroshareAutoApply = (accountId, enabled) => API.post('/api/meroshare/auto-apply/toggle', { account_id: accountId, enabled })
export const runMeroshareAutoApply        = ()  => API.post('/api/meroshare/auto-apply/run')
export const runMeroshareAutoApplyOnLogin = ()  => API.post('/api/meroshare/auto-apply/on-login')

// Market Journal
export const getMarketJournals      = ()         => API.get('/api/market-journal')
export const getMarketJournal       = (date)     => API.get(`/api/market-journal/${date}`)
export const autoCreateMarketJournal= (date)     => API.post('/api/market-journal/auto-create', { date })
export const updateMarketJournal    = (date, data) => API.put(`/api/market-journal/${date}`, data)