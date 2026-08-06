// @vitest-environment happy-dom
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockVerifyOtp = vi.fn()
const mockResendOtp = vi.fn()
vi.mock('../../src/api', () => ({
  verifyOtp: (...a) => mockVerifyOtp(...a),
  resendOtp: (...a) => mockResendOtp(...a),
}))

const mockLogin = vi.fn()
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, user: null }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

import VerifyOtpPage from '../../src/pages/VerifyOtpPage'

function renderPage(email = 'alice@test.com') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/verify', state: { email } }]}>
      <VerifyOtpPage />
    </MemoryRouter>
  )
}

function typeCode(code) {
  const boxes = screen.getAllByLabelText(/Digit \d of 6/)
  code.split('').forEach((digit, i) => {
    fireEvent.change(boxes[i], { target: { value: digit } })
  })
}

beforeEach(() => {
  mockVerifyOtp.mockReset()
  mockResendOtp.mockReset()
  mockLogin.mockReset()
  mockNavigate.mockReset()
})

describe('VerifyOtpPage', () => {
  test('renders the emailed-to address and 6 code boxes', () => {
    renderPage('alice@test.com')
    expect(screen.getByText(/alice@test.com/)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Digit \d of 6/)).toHaveLength(6)
  })

  test('typing all 6 digits auto-submits and logs the user in', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 1, email: 'alice@test.com' }, token: 'tok' },
    })
    renderPage('alice@test.com')

    typeCode('123456')

    await waitFor(() =>
      expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'alice@test.com', code: '123456' })
    )
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ id: 1, email: 'alice@test.com' }, 'tok'))
  })

  test('shows the server error message on a wrong code and clears the boxes', async () => {
    mockVerifyOtp.mockRejectedValue({ response: { data: { message: 'Incorrect code' } } })
    renderPage('alice@test.com')

    typeCode('000000')

    await waitFor(() => expect(screen.getByText('Incorrect code')).toBeInTheDocument())
    const boxes = screen.getAllByLabelText(/Digit \d of 6/)
    expect(boxes.every((b) => b.value === '')).toBe(true)
    expect(mockLogin).not.toHaveBeenCalled()
  })

  test('resend button starts a cooldown after a successful resend', async () => {
    mockResendOtp.mockResolvedValue({ data: { message: 'sent' } })
    renderPage('alice@test.com')

    fireEvent.click(screen.getByRole('button', { name: /resend code/i }))

    await waitFor(() => expect(mockResendOtp).toHaveBeenCalledWith({ email: 'alice@test.com' }))
    await waitFor(() => expect(screen.getByText(/Resend in \d+s/)).toBeInTheDocument())
  })

  test('redirects to /login when no email is in router state', () => {
    render(
      <MemoryRouter initialEntries={['/verify']}>
        <VerifyOtpPage />
      </MemoryRouter>
    )
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})
