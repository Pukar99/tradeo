import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Component, useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import ScreenPage from './pages/ScreenPage'
import PortfolioPage from './pages/PortfolioPage'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import LogsPage from './pages/LogsPage'
import ResearchPage from './pages/ResearchPage'
import ResearchEditorPage from './pages/ResearchEditorPage'
import ResearchViewPage from './pages/ResearchViewPage'
import ProfilePage from './pages/ProfilePage'
import ChatPage from './pages/ChatPage'
import RiskLabPage from './pages/RiskLabPage'
import FloatingChat from './components/FloatingChat'
import MorningBriefing from './components/MorningBriefing'
import { useAuth } from './context/AuthContext'
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
  const location = useLocation()
  const [showBriefing, setShowBriefing] = useState(false)

  const isAuthPage = AUTH_ROUTES.includes(location.pathname)

  useEffect(() => {
    if (!user) return

    getProfile()
      .then(res => {
        if (res.data?.user?.avatar_url) {
          updateUser({ avatar_url: res.data.user.avatar_url })
        }
      })
      .catch(() => {})

    // Show briefing once per session (clears on tab close, not on refresh)
    const briefingShown = sessionStorage.getItem('briefingShown')
    // P3-001: store timer ID and clear it on cleanup so it doesn't fire after unmount
    let timer
    if (!briefingShown) {
      timer = setTimeout(() => setShowBriefing(true), 1000)
      sessionStorage.setItem('briefingShown', 'true')
    }
    return () => clearTimeout(timer)
  }, [user]) // re-run when user changes (login/logout in same session)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {!isAuthPage && <Navbar />}
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isAuthPage && <FloatingChat />}
      {showBriefing && user && (
        <MorningBriefing onClose={() => setShowBriefing(false)} />
      )}
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
