import { test, expect } from './fixtures'

test.describe('Campaigns', () => {
  test('anyone can browse the campaign explorer', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.getByRole('heading', { name: /explore campaigns/i })).toBeVisible()
    // The category filter proves the page rendered past its skeleton state.
    await expect(page.getByText(/^Category$/i)).toBeVisible()
  })

  test('authenticated user can fill in the campaign form', async ({ authenticatedPage: page }) => {
    // The create flow is a multi-step wizard; the first step ("Basics") collects
    // the title and summary. Filling them proves the form renders and accepts input.
    await page.goto('/campaigns/new')
    await page.getByLabel(/^Campaign title/i).fill('Playwright Test Campaign')
    await page
      .getByLabel(/^Short summary/i)
      .fill('An automated end-to-end test campaign that verifies the create form works.')

    await expect(page.getByLabel(/^Campaign title/i)).toHaveValue('Playwright Test Campaign')
    await expect(page.getByLabel(/^Short summary/i)).toHaveValue(
      'An automated end-to-end test campaign that verifies the create form works.',
    )
  })
})
