import { test, expect } from '@playwright/test'

test('refreshes supporter visibility without resetting an in-progress tip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  let restricted = false
  let creatorHidden = false
  await page.route('**/api/v1/creators/privacy-fixture', route => creatorHidden
    ? route.fulfill({ status: 404, json: { message: 'Creator not found' } })
    : route.fulfill({ json: { data: { userId: 'aaaaaaaaaaaaaaaaaaaaaaaa', displayName: 'Privacy Creator', handle: 'privacy-fixture', tipsEnabled: true, presetAmounts: [10, 25], currency: 'GHS', supporterCount: 1, totalReceived: 90, recentTips: restricted ? [] : [{ id: 'tip', supporterName: 'Supporter to hide', amount: 100, message: 'Supporter message to hide' }] } } }))
  await page.goto('/creators/privacy-fixture')
  await expect(page.getByText(/Supporter to hide/)).toBeVisible()
  await page.getByRole('button', { name: 'Custom', exact: true }).click()
  await page.getByLabel('Your amount (GHS)', { exact: true }).fill('37.5')
  await page.getByLabel('Say something nice (optional)', { exact: true }).fill('Keep my draft message')
  restricted = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText(/Supporter to hide/)).toHaveCount(0)
  await expect(page.getByText(/Supporter message to hide/)).toHaveCount(0)
  await expect(page.getByLabel('Your amount (GHS)', { exact: true })).toHaveValue('37.5')
  await expect(page.getByLabel('Say something nice (optional)', { exact: true })).toHaveValue('Keep my draft message')
  creatorHidden = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await expect(page).not.toHaveTitle(/Privacy Creator/)
  const metadata = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(metadata.join('')).not.toContain('Privacy Creator')
  await page.getByRole('heading', { name: 'Page not found', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-creator-supporter-privacy-phone.png', animations: 'disabled' })
})
