import { test, expect } from '@playwright/test'

test('removes an opted-out donor and their board total on phone focus refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  let hidden = false
  let reads = 0
  const donor = { rank: 1, userId: 'aaaaaaaaaaaaaaaaaaaaaaaa', userRole: 'user', name: 'Privacy fixture donor', totalDonated: 50, donationCount: 1, currency: 'GHS', campaignsSupported: 1, isAnonymous: false }
  await page.route('**/api/v1/leaderboard?*', route => { reads++; return route.fulfill({ json: { data: hidden ? [] : [donor] } }) })
  await page.route('**/api/v1/leaderboard/stats?*', route => route.fulfill({ json: { data: hidden ? { totalAmount: 0, totalDonations: 0, totalDonors: 0 } : { totalAmount: 50, totalDonations: 1, totalDonors: 1 } } }))
  await page.goto('/leaderboard')
  await expect(page.getByText(donor.name, { exact: true }).first()).toBeVisible()
  hidden = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => reads).toBeGreaterThan(1)
  await expect(page.getByText('Every act of generosity matters', { exact: true })).toBeVisible()
  await expect(page.getByText('GH₵ 0', { exact: true })).toBeVisible()
  await expect(page.getByText(donor.name, { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Only public GHS gifts to published campaigns count here/)).toBeVisible()
  expect(errors).toEqual([])
  await page.screenshot({ path: '/tmp/ujimora-leaderboard-privacy-phone.png', animations: 'disabled' })
})
