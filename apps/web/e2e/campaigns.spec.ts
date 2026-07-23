import { test, expect } from './fixtures'

test.describe('Campaigns', () => {
  test('user can view campaign list', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page.locator('text=/campaign|explore/i')).toBeVisible()
  })

  test('authenticated user can create campaign', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/campaigns/create')
    await authenticatedPage.fill('input[name="title"]', 'Test Campaign')
    await authenticatedPage.fill('textarea[name="description"]', 'This is a test campaign')
    await authenticatedPage.fill('input[name="goalAmount"]', '1000')
    // Submit and verify
  })
})
