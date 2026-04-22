import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Component, useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import FloatingChat from './components/FloatingChat'
import MorningBriefing from './components/MorningBriefing'

// Lazy-loaded pages — each becomes its own JS chunk, reducing initial bundle size
const HomePage           = lazy(() => import('./pages/HomePage'))
const ScreenPage         = lazy(() => import('./pages/ScreenPage'))
const PortfolioPage      = lazy(() => import('./pages/PortfolioPage'))
const NotFoundPage       = lazy(() => import('./pages/NotFoundPage'))
const LoginPage          = lazy(() => import('./pages/LoginPage'))
const SignupPage         = lazy(() => import('./pages/SignupPage'))
const LogsPage           = lazy(() => import('./pages/LogsPage'))
const ResearchPage       = lazy(() => import('./pages/ResearchPage'))
const ResearchEditorPage = lazy(() => import('./pages/ResearchEditorPage'))
const ResearchViewPage   = lazy(() => import('./pages/ResearchViewPage'))
const ProfilePage        = lazy(() => import('./pages/ProfilePage'))
const ChatPage           = lazy(() => import('./pages/ChatPage'))
const RiskLabPage        = lazy(() => import('./pages/RiskLabPage'))
const CalendarPage       = lazy(() => import('./pages/CalendarPage'))
const IPOPage            = lazy(() => import('./pages/IPOPage'))

// Shared page-level loading spinner
function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
import { PriceAlertContainer, useAlertToasts } from './components/PriceAlertToast'
import { usePriceAlerts } from './hooks/usePriceAlerts'
import { useAuth } from './context/AuthContext'
import { useTheme } from './context/ThemeContext'
import { useHotkeys } from './hooks/useHotkeys'
import { getProfile } from './api'

// P4-005: catch uncaught render errors so the whole app doesn't white-screen
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-300 p-8">
          <div className="text-[32px]">⚠️</div>
          <div className="text-[14px] font-semibold">Something went wrong</div>
          <div className="text-[11px] text-gray-400 max-w-sm text-center">{this.state.error?.message}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Auth-only pages that should not show the navbar
const AUTH_ROUTES = ['/login', '/signup']

function AppContent() {
  const { user, updateUser } = useAuth()
  const { toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [showBriefing, setShowBriefing] = useState(false)
  const { toasts, addToast, dismissToast } = useAlertToasts()
  usePriceAlerts({ user, onAlert: addToast })

  // Global keyboard shortcuts for power traders
  // Alt+key to avoid conflicting with text input
  const hotkeys = useMemo(() => ({
    'alt+d':  () => toggleTheme(),
    'alt+h':  () => navigate('/'),
    'alt+s':  () => navigate('/screen'),
    'alt+l':  () => navigate('/logs'),
    'alt+p':  () => navigate('/portfolio'),
    'alt+c':  () => navigate('/chat'),
    'alt+r':  () => navigate('/risklab'),
    '/':      () => { if (location.pathname === '/screen') { document.querySelector('[data-chart-search]')?.focus() } },
  }), [toggleTheme, navigate, location.pathname])
  useHotkeys(hotkeys)

  const isAuthPage = AUTH_ROUTES.includes(location.pathname)

  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) return

    // Only re-fetch profile if cache is older than 5 minutes — avoids a request on every page load
    const PROFILE_TTL = 5 * 60_000
    const cacheKey = `tradeo_profile_ts_${userId}`
    const lastFetch = parseInt(localStorage.getItem(cacheKey) || '0', 10)
    if (Date.now() - lastFetch < PROFILE_TTL) return

    getProfile()
      .then(res => {
        if (res.data?.user?.avatar_url) {
          updateUser({ avatar_url: res.data.user.avatar_url })
          localStorage.setItem(cacheKey, String(Date.now()))
        }
      })
      .catch(() => {})

    const briefingShown = sessionStorage.getItem('briefingShown')
    let timer
    if (!briefingShown) {
      timer = setTimeout(() => setShowBriefing(true), 1000)
      sessionStorage.setItem('briefingShown', 'true')
    }
    return () => clearTimeout(timer)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {!isAuthPage && <Navbar />}
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/screen" element={<ScreenPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/research/new" element={<ResearchEditorPage />} />
          <Route path="/research/edit/:id" element={<ResearchEditorPage />} />
          <Route path="/research/:id" element={<ResearchViewPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/risklab" element={<RiskLabPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/ipo" element={<IPOPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {!isAuthPage && <FloatingChat />}
      {showBriefing && user && (
        <MorningBriefing onClose={() => setShowBriefing(false)} />
      )}
      <PriceAlertContainer alerts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: { fontSize: '13px', borderRadius: '10px', padding: '10px 16px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { duration: 4000 },
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
