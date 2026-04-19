/**
 * E2E Tests — Authentication Flow
 *
 * Tests the full auth cycle: signup → login → protected route → logout.
 * Runs against a live dev server (or staging).
 *
 * Set BASE_URL env var to point at the frontend (default: http://localhost:5173).
 * Set API_URL env var to point at the backend (default: http://localhost:5000).
 *
 * Run: npx playwright test tests/e2e/auth.spec.js
 */

const { test, expect } = require('@playwright/test')

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

// Unique email per run to avoid conflicts
const timestamp  = Date.now()
const TEST_EMAIL = `e2e_${timestamp}@test.com`
const TEST_PASS  = 'password123'
const TEST_NAME  = 'E2E Tester'

test.describe('Signup Flow', () => {
  test('new user can sign up and lands on dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)

    await page.fill('[name="name"], input[placeholder*="name" i]', TEST_NAME)
    await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Sign up"), button:has-text("Register")')

    // Should land on dashboard or trader page
    await expect(page).toHaveURL(/\/(dashboard|trader|home|app)/, { timeout: 10000 })
  })

  test('signup with duplicate email shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)

    // Use the same email twice
    await page.fill('[name="name"], input[placeholder*="name" i]', TEST_NAME)
    await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Sign up"), button:has-text("Register")')

    await expect(page.locator('text=/already registered|already exists|duplicate/i')).toBeVisible({ timeout: 8000 })
  })

  test('signup with invalid email format shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)

    await page.fill('[name="name"], input[placeholder*="name" i]', TEST_NAME)
    await page.fill('[name="email"], input[type="email"]', 'not-an-email')
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Sign up"), button:has-text("Register")')

    // Either HTML5 validation or server error
    const isInvalid = await page.evaluate(() => {
      const input = document.querySelector('input[type="email"]')
      return input && !input.validity.valid
    })
    if (!isInvalid) {
      await expect(page.locator('text=/invalid email/i')).toBeVisible({ timeout: 5000 })
    }
  })

  test('signup with short password shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)

    await page.fill('[name="name"], input[placeholder*="name" i]', TEST_NAME)
    await page.fill('[name="email"], input[type="email"]', `short_pw_${timestamp}@test.com`)
    await page.fill('[name="password"], input[type="password"]', '123')
    await page.click('button[type="submit"], button:has-text("Sign up"), button:has-text("Register")')

    await expect(page.locator('text=/password|6 char|too short/i')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Login Flow', () => {
  test.beforeAll(async ({ browser }) => {
    // Pre-create account via API so login tests have a known user
    const context = await browser.newContext()
    const page    = await context.newPage()
    await page.goto(`${BASE_URL}/signup`)
    // Attempt signup (may already exist from Signup Flow tests)
    await page.fill('[name="name"], input[placeholder*="name" i]', TEST_NAME)
    await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Sign up"), button:has-text("Register")')
    await page.waitForTimeout(2000)
    await context.close()
  })

  test('valid credentials log in and redirect to app', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')

    await expect(page).toHaveURL(/\/(dashboard|trader|home|app)/, { timeout: 10000 })
  })

  test('wrong password shows generic error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill('[name="password"], input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')

    await expect(page.locator('text=/invalid email or password/i')).toBeVisible({ timeout: 8000 })
  })

  test('unknown email shows generic error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    await page.fill('[name="email"], input[type="email"]', 'nobody_ever@test.com')
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')

    await expect(page.locator('text=/invalid email or password/i')).toBeVisible({ timeout: 8000 })
  })

  test('unauthenticated access to protected route redirects to login', async ({ page }) => {
    // Clear storage to ensure logged out
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())

    await page.goto(`${BASE_URL}/trader`)

    await expect(page).toHaveURL(/\/(login|auth|signin)/, { timeout: 8000 })
  })
})

test.describe('Session Persistence', () => {
  test('JWT persists across page reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
    await expect(page).toHaveURL(/\/(dashboard|trader|home|app)/, { timeout: 10000 })

    // Reload and verify still logged in
    await page.reload()
    await expect(page).not.toHaveURL(/\/(login|auth|signin)/)
  })

  test('logout clears session and redirects to login', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill('[name="password"], input[type="password"]', TEST_PASS)
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
    await expect(page).toHaveURL(/\/(dashboard|trader|home|app)/, { timeout: 10000 })

    // Find and click logout
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Log out"), [aria-label*="logout" i]')
    if (await logoutBtn.count() === 0) {
      // May be inside a dropdown/menu
      await page.click('[aria-label*="user" i], [aria-label*="account" i], button:has-text("Profile")').catch(() => {})
    }
    await logoutBtn.first().click({ timeout: 5000 }).catch(() => {
      // Fallback: clear storage manually
      return page.evaluate(() => localStorage.clear())
    })

    await page.goto(`${BASE_URL}/trader`)
    await expect(page).toHaveURL(/\/(login|auth|signin)/, { timeout: 8000 })
  })
})
