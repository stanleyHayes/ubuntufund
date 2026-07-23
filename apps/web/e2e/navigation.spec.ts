import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('all main pages load', async ({ page }) => {
    const pages = ['/', '/campaigns', '/about', '/login', '/register']
    for (const url of pages) {
      await page.goto(url)
      await expect(page).toHaveTitle(/UbuntuFund/)
    }
  })
})
