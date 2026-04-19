import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { MarketProvider } from './context/MarketContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <MarketProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MarketProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)