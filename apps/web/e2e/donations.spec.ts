import { test, expect } from './fixtures'

test.describe('Donations', () => {
  test('user can donate to campaign', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/campaigns')
    // Click first campaign
    await authenticatedPage.locator('[data-testid="campaign-card"]').first().click()
    // Donate flow
    await authenticatedPage.fill('input[name="amount"]', '50')
    await authenticatedPage.click('button:has-text("Donate")')
    await expect(authenticatedPage.locator('text=/success|thank/i')).toBeVisible()
  })
})
