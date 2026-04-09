import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import AnalysisPage from './pages/AnalysisPage'
import PortfolioPage from './pages/PortfolioPage'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import TraderPage from './pages/TraderPage'
import ResearchPage from './pages/ResearchPage'
import ResearchEditorPage from './pages/ResearchEditorPage'
import ResearchViewPage from './pages/ResearchViewPage'
import ProfilePage from './pages/ProfilePage'
import { useAuth } from './context/AuthContext'
import { getProfile } from './api'

function AppContent() {
  const { user, updateUser } = useAuth()

useEffect(() => {
  if (user) {
    getProfile()
      .then(res => {
        if (res.data.user.avatar_url) {
          updateUser({ avatar_url: res.data.user.avatar_url })
        }
      })
      .catch(() => {})
  }
}, [])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/trader" element={<TraderPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/research/new" element={<ResearchEditorPage />} />
        <Route path="/research/edit/:id" element={<ResearchEditorPage />} />
        <Route path="/research/:id" element={<ResearchViewPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
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