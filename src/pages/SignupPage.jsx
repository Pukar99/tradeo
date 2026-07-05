// === SignupPage.jsx — signup page: brand panel (animated candles + feature list), name/email/password form, strength meter, language support ===
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signupUser } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import AuthFormShell, {
  BrandPanelShell,
  TradeoLogo,
  FieldError,
  PasswordToggle,
  AuthErrorBanner,
  AuthSubmitButton,
} from '../components/auth/AuthFormShell'
import { suggestEmail, authFieldClass } from '../utils/authForm'

function CheckIcon() {
  return (
    <svg
      className="animate-scale-in"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Strength is advisory only (display) — the backend Zod rule is the real gate,
// so this never blocks a password the server would accept. Scores length plus
// character variety (lower / upper / digit / symbol) so "12345678" reads weak.
function getStrength(pw) {
  if (!pw) return null
  if (pw.length < 8) return { level: 0, label: 'Too short', color: 'bg-red-500' }
  let variety = 0
  if (/[a-z]/.test(pw)) variety++
  if (/[A-Z]/.test(pw)) variety++
  if (/\d/.test(pw)) variety++
  if (/[^A-Za-z0-9]/.test(pw)) variety++
  // score: length buckets (0–2) + variety bonus (0–2), clamped to 0–3
  let score = pw.length >= 16 ? 2 : pw.length >= 12 ? 1 : 0
  if (variety >= 3) score++
  if (variety >= 4 && pw.length >= 12) score++
  score = Math.min(score, 3)
  return [
    { level: 0, label: 'Weak', color: 'bg-orange-400' },
    { level: 1, label: 'Fair', color: 'bg-yellow-400' },
    { level: 2, label: 'Good', color: 'bg-lime-500' },
    { level: 3, label: 'Strong', color: 'bg-green-500' },
  ][score]
}

function PasswordStrength({ password }) {
  const s = getStrength(password)
  if (!s) return null
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-0.5 flex-1">
        {[0, 1, 2, 3].map((i) => (
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
      title: 'Screen & Analyze',
      desc: 'SMC, Price Action, MultiChart — all NEPSE',
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
      title: 'Trade Journal',
      desc: 'Log every entry, exit, and lesson learned',
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
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      title: 'Data Lab',
      desc: 'NEPSE sector performance, bull/bear cycles',
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
      title: 'Tradeo AI',
      desc: 'Ask anything about your trades & market',
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
      title: 'Discipline Score',
      desc: 'Track consistency, habits, and streaks',
    },
  ]

  return (
    <BrandPanelShell>
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

      <p className="relative z-10 text-xs text-gray-600">Free to use · NEPSE only · No spam</p>
    </BrandPanelShell>
  )
}

function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailHint, setEmailHint] = useState('') // "did you mean …" suggestion

  const { login, user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Create Account — Tradeo'
  }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const clearField = (field) => {
    setErrors((prev) => ({ ...prev, [field]: '' }))
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
      const { data } = await signupUser({ name: name.trim(), email: email.trim(), password })
      login(data.user, data.token)
      navigate('/')
    } catch (err) {
      setServerError(err.response?.data?.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = (field) => authFieldClass(errors[field])

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword

  return (
    <AuthFormShell
      brandPanel={<BrandPanel />}
      topRightTo="/login"
      topRightLabel="Login"
      py="py-6"
    >
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('signupPage.title')}
        </h1>
        <p className="text-sm text-gray-400 mt-1">{t('signupPage.sub')}</p>
      </div>

      {/* Error banner — slide-down on appear */}
      {serverError && (
        <AuthErrorBanner message={serverError} onDismiss={() => setServerError('')} mb="mb-5" />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full Name */}
        <div>
          <label
            htmlFor="signup-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            autoCapitalize="words"
            enterKeyHint="next"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              clearField('name')
            }}
            autoComplete="name"
            autoFocus
            aria-invalid={errors.name ? 'true' : undefined}
            className={fieldClass('name')}
            placeholder="Your full name"
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="signup-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Email
          </label>
          <input
            id="signup-email"
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
            aria-invalid={errors.email ? 'true' : undefined}
            className={fieldClass('email')}
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
            htmlFor="signup-password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
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
                setErrors((prev) => {
                  const next = { ...prev, password: '', confirmPassword: '' }
                  if (confirmPassword && val !== confirmPassword) {
                    next.confirmPassword = 'Passwords do not match'
                  }
                  return next
                })
                if (serverError) setServerError('')
              }}
              enterKeyHint="next"
              autoComplete="new-password"
              aria-invalid={errors.password ? 'true' : undefined}
              className={`${fieldClass('password')} pr-12`}
              placeholder="••••••••"
            />
            <PasswordToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
          {/* Strength bar — transitions built in */}
          <PasswordStrength password={password} />
          {errors.password && <FieldError>{errors.password}</FieldError>}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="signup-confirm-password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="signup-confirm-password"
              type={showConfirmPw ? 'text' : 'password'}
              enterKeyHint="go"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                clearField('confirmPassword')
              }}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? 'true' : undefined}
              className={`${fieldClass('confirmPassword')} ${passwordsMatch ? 'pr-[5.5rem]' : 'pr-12'}`}
              placeholder="••••••••"
            />
            {passwordsMatch && (
              <span
                className="absolute right-12 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none"
                aria-label="Passwords match"
              >
                <CheckIcon />
              </span>
            )}
            <PasswordToggle shown={showConfirmPw} onToggle={() => setShowConfirmPw((v) => !v)} />
          </div>
          {errors.confirmPassword && <FieldError>{errors.confirmPassword}</FieldError>}
        </div>

        {/* Submit */}
        <AuthSubmitButton loading={loading} busyLabel="Creating account…" mt="!mt-6">
          {t('signupPage.btn')}
        </AuthSubmitButton>
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
    </AuthFormShell>
  )
}

export default SignupPage
