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
export const updateGoal = (id, completed) => API.put(`/api/dashboard/goals/${id}`, { completed })
export const deleteGoal = (id) => API.delete(`/api/dashboard/goals/${id}`)
export const getWatchlist = () => API.get('/api/dashboard/watchlist')
export const addToWatchlist = (data) => API.post('/api/dashboard/watchlist', data)
export const removeFromWatchlist = (id) => API.delete(`/api/dashboard/watchlist/${id}`)
export const getMindset = () => API.get('/api/dashboard/mindset')
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
export const getChatSuggestions = () => API.get('/api/chat/suggestions')

// Trade Log (new system)
export const getTradeLog = () => API.get('/api/tradelog')
export const addTradeLog = (data) => API.post('/api/tradelog', data)
export const updateTradeLog = (id, data) => API.put(`/api/tradelog/${id}`, data)
export const closeTradeLog = (id, data) => API.post(`/api/tradelog/${id}/close`, data)
export const partialCloseTradeLog = (id, data) => API.post(`/api/tradelog/${id}/partial-close`, data)
export const deleteTradeLog = (id) => API.delete(`/api/tradelog/${id}`)
export const getTradeJournal = () => API.get('/api/tradelog/journal')
export const addTradeJournal = (data) => API.post('/api/tradelog/journal', data)
export const updateTradeJournal = (id, data) => API.put(`/api/tradelog/journal/${id}`, data)
export const deleteTradeJournal = (id) => API.delete(`/api/tradelog/journal/${id}`)