import { test, expect } from '@playwright/test'

for (const width of [390, 1280]) {
  test(`crypto contribution flow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 })
    let confirmed = false
    let fiatAmount = 100
    const quote = () => ({ quoteId: 'quote-test', asset: 'USDT', network: 'TRON', fiatCurrency: 'GHS', fiatAmount, cryptoAmount: fiatAmount / 10, rate: 10, expiresAt: new Date(Date.now() + 120000).toISOString() })
    await page.route('**/api/v1/**', async route => {
      const url = route.request().url()
      let data: unknown = {}
      if (url.includes('/payments/crypto/assets')) data = { enabled: true, assets: [{ asset: 'USDT', label: 'Tether', networks: [{ id: 'TRON', label: 'Tron (TRC-20)' }] }] }
      else if (url.includes('/campaigns/slug/')) data = { id: 'campaign-test', slug: 'test', title: 'Community learning fund', status: 'active', goalAmount: 10000, raisedAmount: 1200, currency: 'GHS', imageUrls: [] }
      else if (url.endsWith('/crypto/quote')) { fiatAmount = route.request().postDataJSON().fiatAmount; data = quote() }
      else if (url.endsWith('/donations/crypto')) data = { ...quote(), donationIntentId: 'intent-test', walletAddress: 'TEST-ADDRESS-DO-NOT-SEND', addressTag: '12345', status: 'pending' }
      else if (url.includes('/donation-intents/')) data = { status: confirmed ? 'SUCCEEDED' : 'PENDING' }
      await route.fulfill({ json: { data } })
    })
    await page.goto('/c/test/donate?amount=100')
    await page.locator('#donor-email').fill('donor@example.com')
    await page.getByRole('button', { name: 'Crypto', exact: true }).click()
    await page.getByRole('button', { name: /USDT Tether/ }).click()
    await page.getByRole('button', { name: 'Tron (TRC-20)', exact: true }).click()
    await page.getByRole('button', { name: 'Review quote', exact: true }).click()
    await expect(page.getByText('Review your contribution', { exact: true })).toBeVisible()
    await page.getByText('Review your contribution', { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/crypto-review-${width}.png` })
    await page.locator('#donation-amount').fill('200')
    await expect(page.getByRole('button', { name: 'Get payment address' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Refresh quote' }).click()
    await page.getByRole('button', { name: 'Get payment address' }).click()
    await expect(page.getByText('Required memo / tag', { exact: true })).toBeVisible()
    await expect(page.getByText('12345', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.getByText('Complete your transfer').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/crypto-transfer-${width}.png` })
    confirmed = true
    await expect(page.getByText('Your contribution is confirmed')).toBeVisible({ timeout: 10000 })
  })
}

test('crypto stays hidden when the server disables it', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().includes('/payments/crypto/assets') ? { enabled: false, assets: [] } : { id: 'test', title: 'Test campaign', status: 'active', raisedAmount: 0, goalAmount: 1000 } } }))
  await page.goto('/c/test/donate')
  await expect(page.locator('#donor-email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crypto', exact: true })).toHaveCount(0)
})
