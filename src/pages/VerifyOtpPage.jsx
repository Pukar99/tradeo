// === VerifyOtpPage.jsx — 6-digit email OTP entry after signup, or after a login blocked by NOT_VERIFIED ===
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { verifyOtp, resendOtp } from '../api'
import { useAuth } from '../context/AuthContext'
import AuthFormShell, {
  BrandPanelShell,
  TradeoLogo,
  AuthErrorBanner,
  AuthSubmitButton,
} from '../components/auth/AuthFormShell'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_S = 60

function CheckBadge() {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="animate-scale-in w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
  )
}

function BrandPanel() {
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
          You're almost in.
          <span className="block text-green-400">One quick check.</span>
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Confirming your email keeps your account — and your trade journal — secure.
        </p>
      </div>
      <p className="relative z-10 text-xs text-gray-600">Free to use · NEPSE only · No spam</p>
    </BrandPanelShell>
  )
}

function VerifyOtpPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''))
  const [serverError, setServerError] = useState('')
  const [shake, setShake] = useState(false)
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRefs = useRef([])

  useEffect(() => {
    document.title = 'Verify email — Tradeo'
  }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  // No email in state (e.g. page opened directly / refreshed) — nothing to verify.
  useEffect(() => {
    if (!email) navigate('/login', { replace: true })
  }, [email, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 300)
  }

  const submitCode = async (code) => {
    if (loading) return
    setServerError('')
    setLoading(true)
    try {
      const { data } = await verifyOtp({ email, code })
      setVerified(true)
      login(data.user, data.token)
      setTimeout(() => navigate('/', { replace: true }), 500)
    } catch (err) {
      setServerError(err.response?.data?.message || 'Verification failed. Please try again.')
      setDigits(Array(CODE_LENGTH).fill(''))
      triggerShake()
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const setDigitAt = (index, value) => {
    setDigits((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleDigitChange = (index, raw) => {
    const value = raw.replace(/\D/g, '').slice(-1)
    setDigitAt(index, value)
    if (serverError) setServerError('')
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
    if (value && index === CODE_LENGTH - 1) {
      const full = [...digits.slice(0, index), value].join('')
      if (full.length === CODE_LENGTH) submitCode(full)
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    e.preventDefault()
    const next = Array(CODE_LENGTH).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    if (serverError) setServerError('')
    if (pasted.length === CODE_LENGTH) {
      submitCode(pasted)
    } else {
      inputRefs.current[pasted.length]?.focus()
    }
  }

  const handleResend = async () => {
    if (resending || cooldown > 0) return
    setResending(true)
    setServerError('')
    try {
      await resendOtp({ email })
      setCooldown(RESEND_COOLDOWN_S)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } catch (err) {
      setServerError(err.response?.data?.message || 'Could not resend the code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (!email) return null

  return (
    <AuthFormShell brandPanel={<BrandPanel />} topRightTo="/login" topRightLabel="Cancel" py="py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Check your email</h1>
        <p className="text-sm text-gray-400 mt-1">
          We sent a 6-digit code to <span className="text-gray-600 dark:text-gray-300">{email}</span>
        </p>
      </div>

      {serverError && (
        <AuthErrorBanner message={serverError} onDismiss={() => setServerError('')} mb="mb-6" />
      )}

      {verified ? (
        <CheckBadge />
      ) : (
        <>
          <div className={`flex gap-2 mb-6 ${shake ? 'animate-auth-shake' : ''}`}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={d}
                autoFocus={i === 0}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
                className={`w-full h-12 border dark:bg-gray-800 dark:text-white rounded-xl text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                  serverError
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              />
            ))}
          </div>

          <AuthSubmitButton loading={loading} busyLabel="Verifying…" mt="mt-2">
            Verify email
          </AuthSubmitButton>
        </>
      )}

      <p className="text-sm text-gray-400 mt-6 text-center">
        Didn't get a code?{' '}
        {cooldown > 0 ? (
          <span className="text-gray-400 dark:text-gray-600">Resend in {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-blue-600 hover:underline font-medium transition-colors disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </p>
    </AuthFormShell>
  )
}

export default VerifyOtpPage
