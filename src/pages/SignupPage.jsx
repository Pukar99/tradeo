import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signupUser } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'


function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function TradeoLogo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#111827" strokeWidth="0"/>
      <rect x="6" y="18" width="6" height="14" rx="1.5" fill="#22c55e"/>
      <line x1="9" y1="12" x2="9" y2="18" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="9" y1="32" x2="9" y2="36" stroke="#22c55e" strokeWidth="1.5"/>
      <rect x="17" y="12" width="6" height="16" rx="1.5" fill="#ef4444"/>
      <line x1="20" y1="6" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5"/>
      <line x1="20" y1="28" x2="20" y2="32" stroke="#ef4444" strokeWidth="1.5"/>
      <rect x="28" y="14" width="6" height="12" rx="1.5" fill="#22c55e"/>
      <line x1="31" y1="8" x2="31" y2="14" stroke="#22c55e" strokeWidth="1.5"/>
      <line x1="31" y1="26" x2="31" y2="30" stroke="#22c55e" strokeWidth="1.5"/>
    </svg>
  )
}

function getStrength(pw) {
  if (!pw) return null
  if (pw.length < 8)  return { level: 0, label: 'Too short', color: 'bg-red-500' }
  if (pw.length < 12) return { level: 1, label: 'Weak',      color: 'bg-orange-400' }
  if (pw.length < 16) return { level: 2, label: 'Medium',    color: 'bg-yellow-400' }
  return               { level: 3, label: 'Strong',     color: 'bg-green-500' }
}

function PasswordStrength({ password }) {
  const s = getStrength(password)
  if (!s) return null
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-0.5 flex-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= s.level ? s.color : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-400 w-12 text-right transition-all">{s.label}</span>
    </div>
  )
}

function BrandPanel() {
  const features = [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      title: 'Screen & Analyze',
      desc: 'SMC, Price Action, MultiChart — all NEPSE',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
      title: 'Trade Journal',
      desc: 'Log every entry, exit, and lesson learned',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
      title: 'Data Lab',
      desc: 'NEPSE sector performance, bull/bear cycles',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      title: 'Tradeo AI',
      desc: 'Ask anything about your trades & market',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4l3 3"/>
        </svg>
      ),
      title: 'Discipline Score',
      desc: 'Track consistency, habits, and streaks',
    },
  ]

  const candles = [
    { x: 40,  h: 80,  t: 200, green: true  },
    { x: 80,  h: 140, t: 160, green: false },
    { x: 120, h: 60,  t: 220, green: true  },
    { x: 160, h: 110, t: 180, green: true  },
    { x: 200, h: 180, t: 140, green: false },
    { x: 240, h: 90,  t: 210, green: true  },
    { x: 280, h: 130, t: 170, green: true  },
    { x: 320, h: 70,  t: 230, green: false },
    { x: 360, h: 160, t: 150, green: true  },
    { x: 400, h: 100, t: 190, green: false },
  ]

  return (
    <div className="hidden md:flex flex-col justify-between w-[420px] shrink-0 bg-gray-950 px-10 py-10 relative overflow-hidden">

      {/* Animated candlestick background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none select-none"
        viewBox="0 0 420 700" preserveAspectRatio="xMidYMid slice"
      >
        {candles.map((c, i) => (
          <g key={c.x} className="animate-candle-grow origin-bottom" style={{ animationDelay: `${i * 60}ms` }}>
            <line x1={c.x} y1={c.t - 20} x2={c.x} y2={c.t + c.h + 20} stroke={c.green ? '#22c55e' : '#ef4444'} strokeWidth="1"/>
            <rect x={c.x - 8} y={c.t} width="16" height={c.h} fill={c.green ? '#22c55e' : '#ef4444'} rx="2"/>
          </g>
        ))}
      </svg>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-10">
          <TradeoLogo size={40} />
          <div>
            <p className="text-white font-bold text-xl tracking-tight leading-none">Tradeo</p>
            <p className="text-gray-500 text-xs mt-0.5">Your NEPSE trading OS</p>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white leading-tight mb-3">
          Everything you need to
          <span className="block text-green-400">trade smarter.</span>
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          One free account. Full access to charts, journal, AI coach, portfolio tracker, and more.
        </p>

        {/* Staggered feature list */}
        <ul className="space-y-4">
          {features.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-3 animate-stagger-fade"
              style={{ animationDelay: `${150 + i * 80}ms` }}
            >
              <span className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-green-400 shrink-0 mt-0.5">
                {f.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-xs text-gray-600">
        Free to use · NEPSE only · No spam
      </p>
    </div>
  )
}

function SignupPage() {
  const [name, setName]                       = useState('')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw]                   = useState(false)
  const [showConfirmPw, setShowConfirmPw]     = useState(false)
  const [errors, setErrors]                   = useState({})
  const [serverError, setServerError]         = useState('')
  const [loading, setLoading]                 = useState(false)

  const { login, user } = useAuth()
  const { t }           = useLanguage()
  const navigate        = useNavigate()

  useEffect(() => { document.title = 'Create Account — Tradeo' }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const clearField = (field) => {
    setErrors(prev => ({ ...prev, [field]: '' }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const errs = {}
    if (!name.trim()) {
      errs.name = 'Full name is required'
    } else if (name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters'
    } else if (name.trim().length > 100) {
      errs.name = 'Name must be under 100 characters'
    }
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Enter a valid email address'
    }
    if (!password) {
      errs.password = 'Password is required'
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters'
    } else if (password.length > 128) {
      errs.password = 'Password must be under 128 characters'
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const { data } = await signupUser({ name: name.trim(), email: email.trim(), password })
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      setServerError(err.response?.data?.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = (field) =>
    `w-full border dark:bg-gray-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
      errors[field]
        ? 'border-red-400 dark:border-red-500'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
    }`

  return (
    <div className="min-h-screen flex">

        {/* ── Left brand panel (md+) ── */}
        <BrandPanel />

        {/* ── Right form panel — fade-up on mount ── */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-screen animate-fade-up">

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </Link>

            <div className="flex md:hidden items-center gap-2">
              <TradeoLogo size={28} />
              <span className="text-sm font-bold text-gray-900 dark:text-white">Tradeo</span>
            </div>

            <Link to="/login" className="text-sm text-blue-600 hover:underline font-medium transition-colors">
              Login
            </Link>
          </div>

          {/* Form — vertically centered */}
          <div className="flex-1 flex items-center justify-center px-6 py-6">
            <div className="w-full max-w-[360px]">

              <div className="mb-7">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('signupPage.title')}</h1>
                <p className="text-sm text-gray-400 mt-1">{t('signupPage.sub')}</p>
              </div>

              {/* Error banner — slide-down on appear */}
              {serverError && (
                <div className="animate-slide-down bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 p-3 rounded-lg mb-5 text-sm flex items-start justify-between gap-2">
                  <span>{serverError}</span>
                  <button
                    type="button"
                    onClick={() => setServerError('')}
                    className="text-red-400 hover:text-red-600 flex-shrink-0 leading-none transition-colors"
                    aria-label="Dismiss error"
                  >✕</button>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                {/* Full Name */}
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearField('name') }}
                    autoComplete="name"
                    autoFocus
                    className={fieldClass('name')}
                    placeholder="Your full name"
                  />
                  {errors.name && (
                    <p className="animate-slide-down text-red-500 text-xs mt-1.5">{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearField('email') }}
                    autoComplete="email"
                    className={fieldClass('email')}
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p className="animate-slide-down text-red-500 text-xs mt-1.5">{errors.email}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        const val = e.target.value
                        setPassword(val)
                        setErrors(prev => {
                          const next = { ...prev, password: '', confirmPassword: '' }
                          if (confirmPassword && val !== confirmPassword) {
                            next.confirmPassword = 'Passwords do not match'
                          }
                          return next
                        })
                        if (serverError) setServerError('')
                      }}
                      autoComplete="new-password"
                      className={fieldClass('password')}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {/* Strength bar — transitions built in */}
                  <PasswordStrength password={password} />
                  {errors.password && (
                    <p className="animate-slide-down text-red-500 text-xs mt-1.5">{errors.password}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); clearField('confirmPassword') }}
                      autoComplete="new-password"
                      className={fieldClass('confirmPassword')}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPw(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="animate-slide-down text-red-500 text-xs mt-1.5">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="active:scale-95 w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all duration-150 flex items-center justify-center gap-2 !mt-6 shadow-sm hover:shadow-md"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'Creating account…' : t('signupPage.btn')}
                </button>

              </form>

              <p className="text-sm text-gray-400 mt-5 text-center">
                {t('signupPage.hasAccount')}{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-medium transition-colors">
                  {t('signupPage.login')}
                </Link>
              </p>

              <p className="text-xs text-gray-300 dark:text-gray-600 mt-4 text-center">
                Free to use · NEPSE only · No spam
              </p>

            </div>
          </div>
        </div>
      </div>
  )
}

export default SignupPage
