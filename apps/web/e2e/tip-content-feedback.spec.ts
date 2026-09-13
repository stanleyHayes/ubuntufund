import { test, expect } from '@playwright/test'
test('keeps payment confirmed while supporter content waits for review or is declined', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let contentReviewStatus = 'pending'
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/creators/tips/verify', route => route.fulfill({ json: { data: { status: 'SUCCEEDED', contentReviewStatus, amount: 25, currency: 'GHS', handle: 'fixture', displayName: 'Fixture Creator' } } }))
  await page.goto('/tip/callback?reference=tip-feedback-fixture')
  const confirmed = page.getByRole('heading', { name: 'Thank you for your support!' })
  await expect(confirmed).toBeVisible()
  await expect(page.getByText('Your payment is confirmed. Your public name and message are waiting for staff review.')).toBeVisible()
  await page.screenshot({ path: '/tmp/ujimora-tip-review-pending-phone.png', animations: 'disabled' })
  contentReviewStatus = 'approved'
  await page.reload()
  await expect(confirmed).toBeVisible()
  await expect(page.getByText('Your public name and message passed review. Your anonymity choice still applies.')).toBeVisible()
  contentReviewStatus = 'rejected'
  await page.reload()
  await expect(confirmed).toBeVisible()
  await expect(page.getByText(/Your payment is confirmed. Your public name and message were not approved/)).toBeVisible()
  await expect(page.getByText('Reference: tip-feedback-fixture')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '/tmp/ujimora-tip-review-declined-phone.png', animations: 'disabled' })
  expect(errors).toEqual([])
})
