import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signupUser } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const validate = () => {
    const errs = {}
    if (!name.trim()) {
      errs.name = 'Full name is required'
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
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
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

  const fieldClass = (field) =>
    `w-full border dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${
      errors[field] ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
    }`

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm w-full max-w-md">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('signupPage.title')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('signupPage.sub')}
          </p>
        </div>

        {serverError && (
          <div className="bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm flex items-start justify-between gap-2">
            <span>{serverError}</span>
            <button
              onClick={() => setServerError('')}
              className="text-red-400 hover:text-red-600 flex-shrink-0 leading-none"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })) }}
              autoComplete="name"
              className={fieldClass('name')}
              placeholder="Pukar Sharma"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })) }}
              autoComplete="email"
              className={fieldClass('email')}
              placeholder="pukar@gmail.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="mb-4">
            <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '', confirmPassword: '' })) }}
              autoComplete="new-password"
              className={fieldClass('password')}
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <div className="mb-6">
            <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: '' })) }}
              autoComplete="new-password"
              className={fieldClass('confirmPassword')}
              placeholder="••••••••"
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? 'Creating account…' : t('signupPage.btn')}
          </button>
        </form>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
          {t('signupPage.hasAccount')}{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            {t('signupPage.login')}
          </Link>
        </p>

      </div>
    </div>
  )
}

export default SignupPage
