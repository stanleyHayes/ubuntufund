import { test, expect } from './fixtures'

test.describe('Campaigns', () => {
  test('anyone can browse the campaign explorer', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.getByRole('heading', { name: /explore campaigns/i })).toBeVisible()
    // The category filter proves the page rendered past its skeleton state.
    await expect(page.getByText(/^Category$/i)).toBeVisible()
  })

  test('authenticated user can fill in the campaign form', async ({ authenticatedPage: page }) => {
    await page.goto('/campaigns/new')
    await page.getByLabel(/^Campaign Title/).fill('Playwright Test Campaign')
    await page
      .getByLabel(/^Description/)
      .fill('An automated end-to-end test campaign that verifies the create form works.')
    await page.getByLabel(/^Goal Amount/).fill('10000')

    await expect(page.getByLabel(/^Campaign Title/)).toHaveValue('Playwright Test Campaign')
    await expect(page.getByLabel(/^Goal Amount/)).toHaveValue('10000')
  })
})
