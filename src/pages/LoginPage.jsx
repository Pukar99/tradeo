// === LoginPage.jsx — login page: brand panel (animated candles + features), email/password form, auth redirect, language support ===
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginUser } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getRedirectFrom } from '../components/PrivateRoute'
import AuthFormShell, {
  BrandPanelShell,
  TradeoLogo,
  FieldError,
  PasswordToggle,
  AuthErrorBanner,
  AuthSubmitButton,
  GoogleAuthSection,
} from '../components/auth/AuthFormShell'
import { suggestEmail, authFieldClass } from '../utils/authForm'

function BrandPanel() {
  const features = [
    {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      label: 'Live NEPSE market data',
    },
    {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      label: 'Full trade journal & audit',
    },
    {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
      ),
      label: 'Discipline score & streaks',
    },
    {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      label: 'AI trade coach (Groq)',
    },
  ]

  return (
    <BrandPanelShell>
      {/* Top — logo + copy */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-12">
          <TradeoLogo size={40} />
          <div>
            <p className="text-white font-bold text-xl tracking-tight leading-none">Tradeo</p>
            <p className="text-gray-500 text-xs mt-0.5">Your NEPSE trading OS</p>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white leading-tight mb-3">
          Built for traders who take
          <span className="block text-green-400">discipline seriously.</span>
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          From your first trade to your thousandth — Tradeo keeps you accountable, informed, and in
          control.
        </p>

        {/* Staggered feature list */}
        <ul className="mt-8 space-y-3">
          {features.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-3 animate-stagger-fade"
              style={{ animationDelay: `${200 + i * 80}ms` }}
            >
              <span className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-green-400 shrink-0">
                {f.icon}
              </span>
              <span className="text-sm text-gray-300">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-xs text-gray-600 mt-8">Free to use · NEPSE only · No spam</p>
    </BrandPanelShell>
  )
}

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailHint, setEmailHint] = useState('') // "did you mean …" suggestion

  const { login, user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Login — Tradeo'
  }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const msg = sessionStorage.getItem('authExpiredMsg')
    if (msg) {
      setServerError(msg)
      sessionStorage.removeItem('authExpiredMsg')
    }
  }, [])

  const clearField = (field) => {
    setErrors((prev) => ({ ...prev, [field]: '' }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const errs = {}
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
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return // re-entrancy guard (double-tap / Enter spam)
    document.activeElement?.blur?.() // dismiss mobile keyboard
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const { data } = await loginUser({ email: email.trim(), password })
      login(data.user, data.token)
      navigate(getRedirectFrom(), { replace: true })
    } catch (err) {
      if (err.response?.data?.code === 'NOT_VERIFIED') {
        navigate('/verify', { state: { email: err.response.data.email || email.trim() } })
        return
      }
      setServerError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFormShell
      brandPanel={<BrandPanel />}
      topRightTo="/signup"
      topRightLabel="Sign up free"
      py="py-8"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('loginPage.title')}
        </h1>
        <p className="text-sm text-gray-400 mt-1">{t('loginPage.sub')}</p>
      </div>

      {/* Error banner — slide-down on appear */}
      {serverError && (
        <AuthErrorBanner message={serverError} onDismiss={() => setServerError('')} mb="mb-6" />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            enterKeyHint="next"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              const val = e.target.value
              setEmail(val)
              clearField('email')
              setEmailHint(suggestEmail(val.trim()) || '')
            }}
            autoComplete="email"
            autoFocus
            aria-invalid={errors.email ? 'true' : undefined}
            className={authFieldClass(errors.email)}
            placeholder="you@example.com"
          />
          {errors.email ? (
            <FieldError>{errors.email}</FieldError>
          ) : emailHint ? (
            <p className="animate-slide-down text-xs mt-1.5 text-gray-500 dark:text-gray-400">
              Did you mean{' '}
              <button
                type="button"
                onClick={() => {
                  setEmail(emailHint)
                  setEmailHint('')
                }}
                className="text-blue-600 font-medium hover:underline"
              >
                {emailHint}
              </button>
              ?
            </p>
          ) : null}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              enterKeyHint="go"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearField('password')
              }}
              autoComplete="current-password"
              aria-invalid={errors.password ? 'true' : undefined}
              className={`auth-input w-full border dark:bg-gray-800 dark:text-white rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                errors.password
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              placeholder="••••••••"
            />
            <PasswordToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
          {errors.password && <FieldError>{errors.password}</FieldError>}
        </div>

        {/* Submit — press scale + color transition */}
        <AuthSubmitButton loading={loading} busyLabel="Signing in…" mt="mt-2">
          {t('loginPage.btn')}
        </AuthSubmitButton>
      </form>

      <GoogleAuthSection onError={setServerError} />

      <p className="text-sm text-gray-400 mt-6 text-center">
        {t('loginPage.noAccount')}{' '}
        <Link to="/signup" className="text-blue-600 hover:underline font-medium transition-colors">
          {t('loginPage.signup')}
        </Link>
      </p>
    </AuthFormShell>
  )
}

export default LoginPage
