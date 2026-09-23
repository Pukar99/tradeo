// @vitest-environment happy-dom
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockGoogleAuth = vi.fn()
vi.mock('../../src/api', () => ({ googleAuth: (...a) => mockGoogleAuth(...a) }))

const mockLogin = vi.fn()
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

// The real GoogleLogin renders Google's own iframe/script — stub it to a plain
// button so tests never touch real Google network calls, matching the plan's
// "no real Google network call in CI" requirement.
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError }) => (
    <div>
      <button onClick={() => onSuccess({ credential: 'fake-credential' })}>
        Mock Google Sign-In Success
      </button>
      <button onClick={() => onError()}>Mock Google Sign-In Error</button>
    </div>
  ),
}))

import { GoogleAuthSection } from '../../src/components/auth/AuthFormShell'

function renderSection(onError = vi.fn()) {
  return render(
    <MemoryRouter>
      <GoogleAuthSection onError={onError} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockGoogleAuth.mockReset()
  mockLogin.mockReset()
  mockNavigate.mockReset()
})

describe('GoogleAuthSection', () => {
  test('renders the divider and the Google button', () => {
    renderSection()
    expect(screen.getByText('or')).toBeInTheDocument()
    expect(screen.getByText('Mock Google Sign-In Success')).toBeInTheDocument()
  })

  test('a successful credential posts to /api/auth/google, logs in, and redirects home', async () => {
    mockGoogleAuth.mockResolvedValue({
      data: { user: { id: 1, email: 'alice@test.com' }, token: 'tok' },
    })
    renderSection()

    fireEvent.click(screen.getByText('Mock Google Sign-In Success'))

    await waitFor(() =>
      expect(mockGoogleAuth).toHaveBeenCalledWith({ credential: 'fake-credential' })
    )
    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({ id: 1, email: 'alice@test.com' }, 'tok')
    )
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  test('a backend failure surfaces the error via onError instead of logging in', async () => {
    mockGoogleAuth.mockRejectedValue({ response: { data: { message: 'Google sign-in failed' } } })
    const onError = vi.fn()
    renderSection(onError)

    fireEvent.click(screen.getByText('Mock Google Sign-In Success'))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Google sign-in failed'))
    expect(mockLogin).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('a client-side Google error (e.g. origin mismatch) surfaces via onError', () => {
    const onError = vi.fn()
    renderSection(onError)

    fireEvent.click(screen.getByText('Mock Google Sign-In Error'))

    expect(onError).toHaveBeenCalledWith('Google sign-in failed, please try again')
    expect(mockGoogleAuth).not.toHaveBeenCalled()
  })
})
