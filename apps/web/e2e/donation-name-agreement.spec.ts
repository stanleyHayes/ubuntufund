import { test, expect } from '@playwright/test'

for (const anonymous of [false, true]) {
  test(`fiat name-only donation consent with anonymous=${anonymous}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const submissions: Record<string, unknown>[] = []
    await page.route('**/api/v1/**', async route => {
      const url = route.request().url()
      if (url.endsWith('/donation-intents')) {
        submissions.push(route.request().postDataJSON())
        return route.fulfill({ status: 503, json: { message: 'Fixture checkout unavailable' } })
      }
      const data = url.includes('/campaigns/slug/')
        ? { id: 'campaign-test', slug: 'test', title: 'Community learning fund', status: 'active', endDate: new Date(Date.now() + 86400000).toISOString(), goalAmount: 10000, raisedAmount: 1200, currency: 'GHS', imageUrls: [] }
        : url.includes('/payments/crypto/assets') ? { enabled: false, assets: [] } : {}
      await route.fulfill({ json: { data } })
    })
    await page.goto('/c/test/donate?amount=100')
    await page.locator('#donor-email').fill('donor@example.com')
    await page.locator('#donor-name').fill('Public donor')
    const submit = page.getByRole('button', { name: /^Donate GH/ })
    const agreement = page.getByRole('checkbox', { name: 'I am at least 18 and agree to the terms for posting my public name and message.' })
    await expect(agreement).not.toBeChecked()
    await expect(submit).toBeDisabled()
    expect(submissions).toEqual([])
    if (anonymous) {
      await page.getByRole('checkbox', { name: /anonymous/i }).check()
      await expect(agreement).toHaveCount(0)
    } else {
      await agreement.check()
    }
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect.poll(() => submissions.length).toBe(1)
    expect(submissions[0]).toMatchObject({ donorName: 'Public donor', isAnonymous: anonymous })
    if (anonymous) expect(submissions[0].legalAcceptance).toBeUndefined()
    else expect(submissions[0].legalAcceptance).toEqual({ version: '2026-09-12', acceptedTerms: true, ageConfirmed: true })
    await expect(page.getByText('Fixture checkout unavailable')).toBeVisible()
  })
}
