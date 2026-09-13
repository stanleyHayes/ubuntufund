import { test, expect } from '@playwright/test'
test('guest public message requires an unchecked terms acknowledgement on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/payments/crypto/assets', route => route.fulfill({ json: { data: { enabled: false, assets: [] } } }))
  await page.route('**/api/v1/campaigns/slug/message-test/public', route => route.fulfill({ json: { data: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', slug: 'message-test', title: 'Community fundraiser', status: 'active', endDate: new Date(Date.now() + 86400000).toISOString(), currency: 'GHS', raisedAmount: 100, goalAmount: 1000, imageUrls: [] } } }))
  let calls = 0
  await page.route('**/api/v1/donation-intents', route => {
    calls++
    expect(route.request().postDataJSON()).toMatchObject({ message: 'Wishing the project well.', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } })
    return route.fulfill({ status: 503, json: { message: 'Checkout is unavailable for this test.' } })
  })
  await page.goto('/c/message-test/donate?amount=25')
  await page.getByLabel('Email address').fill('guest@example.com')
  await page.getByLabel('Leave a message (optional)').fill('Wishing the project well.')
  const agreement = page.getByRole('checkbox', { name: 'I am at least 18 and agree to the terms for posting this public message.' })
  await expect(agreement).not.toBeChecked()
  const pay = page.getByRole('button', { name: /^Donate / })
  await expect(pay).toBeDisabled()
  expect(calls).toBe(0)
  await agreement.check()
  await expect(pay).toBeEnabled()
  await agreement.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-message-agreement-phone.png', animations: 'disabled' })
  await pay.click()
  await expect(page.getByText('Checkout is unavailable for this test.')).toBeVisible()
  expect(calls).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
