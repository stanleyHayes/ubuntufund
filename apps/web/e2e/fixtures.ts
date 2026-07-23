import { test as base } from '@playwright/test'

export const test = base.extend({
  // Add auth fixture
  authenticatedPage: async ({ page }, use) => {
    // Login flow
    await page.goto('/login')
    await page.fill('input[name="email"]', 'demo@ubuntufund.com')
    await page.fill('input[name="password"]', 'ubuntu2026')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page)
  },
})

export { expect } from '@playwright/test'
