import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function App() {
  return (
    <BrowserRouter>
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<NotFoundPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App