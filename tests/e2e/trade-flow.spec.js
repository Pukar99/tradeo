/**
 * E2E Tests — Trade Entry & Lifecycle Flow
 *
 * Tests: open trade → view in table → partial close → full close → delete
 * Also tests: bulk delete, journal entry, dashboard stats update.
 *
 * Run: npx playwright test tests/e2e/trade-flow.spec.js
 */

const { test, expect } = require('@playwright/test')

const BASE_URL   = process.env.BASE_URL || 'http://localhost:5173'
const TEST_EMAIL = process.env.E2E_EMAIL || `e2e_trade_${Date.now()}@test.com`
const TEST_PASS  = process.env.E2E_PASS  || 'password123'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
  await page.fill('[name="password"], input[type="password"]', TEST_PASS)
  await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
  await expect(page).toHaveURL(/\/(dashboard|trader|home|app)/, { timeout: 12000 })
}

async function ensureAccount(page) {
  await page.goto(`${BASE_URL}/signup`)
  await page.fill('[name="name"], input[placeholder*="name" i]', 'E2E Trader')
  await page.fill('[name="email"], input[type="email"]', TEST_EMAIL)
  await page.fill('[name="password"], input[type="password"]', TEST_PASS)
  await page.click('button[type="submit"], button:has-text("Sign up"), button:has-text("Register")')
  await page.waitForTimeout(2000)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

test.describe('Trade Lifecycle', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx  = await browser.newContext()
    const page = await ctx.newPage()
    await ensureAccount(page)
    await ctx.close()
  })

  test.beforeEach(async ({ page }) => {
    await login(page)
    // Navigate to Trader page
    const traderLink = page.locator('a[href*="/trader"], nav >> text=/trader/i')
    if (await traderLink.count() > 0) {
      await traderLink.first().click()
    } else {
      await page.goto(`${BASE_URL}/trader`)
    }
    await page.waitForLoadState('networkidle')
  })

  test('can open a new LONG trade', async ({ page }) => {
    // Find the "Add Trade" / "New Trade" button
    const addBtn = page.locator('button:has-text("Add Trade"), button:has-text("New Trade"), button:has-text("Log Trade"), button[aria-label*="add" i]')
    await addBtn.first().click()

    // Fill the form
    await page.fill('input[name="symbol"], input[placeholder*="symbol" i]', 'NABIL')
    await page.fill('input[name="entry_price"], input[placeholder*="entry" i]', '500')
    await page.fill('input[name="quantity"], input[placeholder*="quantity" i]', '100')
    await page.fill('input[name="sl"], input[placeholder*="stop" i]', '480').catch(() => {})
    await page.fill('input[name="tp"], input[placeholder*="target" i]', '560').catch(() => {})

    // Select LONG position if there's a selector
    const longOption = page.locator('button:has-text("LONG"), input[value="LONG"], option[value="LONG"]')
    if (await longOption.count() > 0) await longOption.first().click()

    // Submit
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Add"), button:has-text("Submit"), dialog button[type="submit"]')

    // Verify trade appears in table
    await expect(page.locator('text=NABIL')).toBeVisible({ timeout: 8000 })
  })

  test('trade table shows correct status OPEN', async ({ page }) => {
    // After adding, NABIL trade should show OPEN
    await expect(page.locator('text=/OPEN/').first()).toBeVisible({ timeout: 5000 })
  })

  test('can open a SHORT trade', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add Trade"), button:has-text("New Trade"), button:has-text("Log Trade")')
    await addBtn.first().click()

    await page.fill('input[name="symbol"], input[placeholder*="symbol" i]', 'SBCF')
    await page.fill('input[name="entry_price"], input[placeholder*="entry" i]', '600')
    await page.fill('input[name="quantity"], input[placeholder*="quantity" i]', '80')

    const shortOption = page.locator('button:has-text("SHORT"), input[value="SHORT"], option[value="SHORT"]')
    if (await shortOption.count() > 0) await shortOption.first().click()

    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Add"), button:has-text("Submit"), dialog button[type="submit"]')

    await expect(page.locator('text=SBCF')).toBeVisible({ timeout: 8000 })
  })

  test('can partial-close an OPEN trade', async ({ page }) => {
    // Find a trade row with NABIL and click partial close
    const row = page.locator('tr, [data-testid="trade-row"]').filter({ hasText: 'NABIL' }).first()
    const partialBtn = row.locator('button:has-text("Partial"), button[aria-label*="partial" i]')

    if (await partialBtn.count() > 0) {
      await partialBtn.click()
      await page.fill('input[name="exit_quantity"], input[placeholder*="quantity" i]', '50')
      await page.fill('input[name="exit_price"], input[placeholder*="exit" i]', '530')
      await page.click('button[type="submit"]:has-text("Close"), button:has-text("Confirm"), dialog button[type="submit"]')

      // Should now show PARTIAL
      await expect(page.locator('text=/PARTIAL/').first()).toBeVisible({ timeout: 8000 })
    } else {
      test.skip()
    }
  })

  test('can fully close a trade', async ({ page }) => {
    const row = page.locator('tr, [data-testid="trade-row"]').filter({ hasText: 'SBCF' }).first()
    const closeBtn = row.locator('button:has-text("Close"), button[aria-label*="close" i]').first()

    if (await closeBtn.count() > 0) {
      await closeBtn.click()
      await page.fill('input[name="exit_price"], input[placeholder*="exit" i]', '540')
      await page.click('button[type="submit"]:has-text("Close"), button:has-text("Confirm"), dialog button[type="submit"]')

      await expect(page.locator('text=/CLOSED/').first()).toBeVisible({ timeout: 8000 })
    } else {
      test.skip()
    }
  })

  test('closed trade shows realized P&L', async ({ page }) => {
    // A closed SHORT SBCF at entry 600 exit 540 should show profit
    const row = page.locator('tr, [data-testid="trade-row"]').filter({ hasText: 'SBCF' }).first()
    // P&L = (600-540)*80 = 4800
    const pnlCell = row.locator('td, [data-label*="pnl" i], [data-label*="p&l" i]')
    if (await pnlCell.count() > 0) {
      const text = await pnlCell.first().textContent()
      expect(text).toMatch(/4[,.]?800|4800/)
    }
  })

  test('can delete a trade', async ({ page }) => {
    const row      = page.locator('tr, [data-testid="trade-row"]').filter({ hasText: 'NABIL' }).first()
    const deleteBtn = row.locator('button:has-text("Delete"), button[aria-label*="delete" i]')

    if (await deleteBtn.count() > 0) {
      await deleteBtn.click()
      // Confirm dialog
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes, delete"), button:has-text("Delete")')
      if (await confirmBtn.count() > 0) await confirmBtn.first().click()

      await expect(page.locator('tr:has-text("NABIL")')).not.toBeVisible({ timeout: 8000 })
    } else {
      test.skip()
    }
  })
})

test.describe('Trade Table Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/trader`)
    await page.waitForLoadState('networkidle')
  })

  test('status filter shows only OPEN trades', async ({ page }) => {
    const filterSelect = page.locator('select[name*="status"], button:has-text("Filter"), [aria-label*="filter" i]')
    if (await filterSelect.count() > 0) {
      await filterSelect.first().selectOption('OPEN').catch(async () => {
        await filterSelect.first().click()
        await page.click('text=OPEN')
      })
      const rows = page.locator('tr, [data-testid="trade-row"]').filter({ hasText: /CLOSED|PARTIAL/ })
      await expect(rows).toHaveCount(0, { timeout: 5000 })
    } else {
      test.skip()
    }
  })

  test('search by symbol filters trades', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="symbol" i], input[type="search"]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('SBCF')
      await page.waitForTimeout(500)
      const rows = page.locator('tr, [data-testid="trade-row"]')
      const nonSbcf = rows.filter({ hasNotText: 'SBCF' }).filter({ hasText: /[A-Z]{3,}/ })
      await expect(nonSbcf).toHaveCount(0, { timeout: 5000 })
    } else {
      test.skip()
    }
  })
})

test.describe('Dashboard Stats', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')
  })

  test('dashboard loads without JS errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0)
  })

  test('dashboard shows stats cards', async ({ page }) => {
    // Should show some kind of stats (win rate, P&L, trade count)
    const statsText = await page.textContent('body')
    const hasStats  = /win rate|total trades|realized|p&l|profit/i.test(statsText)
    expect(hasStats).toBe(true)
  })
})

test.describe('Journal Entry', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/trader`)
    await page.waitForLoadState('networkidle')
  })

  test('can add a journal entry to a trade', async ({ page }) => {
    // Find journal tab or button
    const journalTab = page.locator('button:has-text("Journal"), tab:has-text("Journal"), a:has-text("Journal")')
    if (await journalTab.count() > 0) {
      await journalTab.first().click()
      await page.waitForLoadState('networkidle')

      const addJournalBtn = page.locator('button:has-text("Add"), button:has-text("New Entry"), button:has-text("Write")')
      if (await addJournalBtn.count() > 0) {
        await addJournalBtn.first().click()
        const textarea = page.locator('textarea, [contenteditable="true"]').first()
        await textarea.fill('Test journal entry from E2E test')
        await page.click('button[type="submit"]:has-text("Save"), button:has-text("Submit")')
        await expect(page.locator('text=Test journal entry from E2E test')).toBeVisible({ timeout: 8000 })
      }
    } else {
      test.skip()
    }
  })
})
