import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
    if (!briefingShown) {
      setTimeout(() => setShowBriefing(true), 1000)
      sessionStorage.setItem('briefingShown', 'true')
    }
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
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
