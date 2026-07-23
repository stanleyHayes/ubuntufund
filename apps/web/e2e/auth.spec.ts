import { test, expect } from './fixtures'

test.describe('Authentication', () => {
  test('user can log in', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'demo@ubuntufund.com')
    await page.fill('input[name="password"]', 'ubuntu2026')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/dashboard/)
  })

  test('user can register', async ({ page }) => {
    await page.goto('/register')
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`)
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!')
    await page.click('button[type="submit"]')
    // Should redirect or show success
    await expect(page.locator('text=/success|welcome|dashboard/i')).toBeVisible()
  })
})
