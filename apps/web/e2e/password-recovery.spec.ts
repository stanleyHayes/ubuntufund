import { test, expect } from '@playwright/test'

test('a recovery email link opens a usable phone form without putting its token in requests', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const token = 'a'.repeat(64)
  const requestUrls: string[] = []
  page.on('request', request => requestUrls.push(request.url()))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/reset-password', route => {
    expect(route.request().postDataJSON()).toEqual({ token, newPassword: 'RecoveredSecurePass123' })
    return route.fulfill({ json: { data: null, message: 'Password reset' } })
  })
  await page.goto(`/reset-password#token=${token}`)
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel(/^New password/).fill('RecoveredSecurePass123')
  await page.getByLabel(/^Confirm new password/).fill('RecoveredSecurePass123')
  await page.screenshot({ path: '/tmp/ujimora-password-recovery-phone.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'previous sessions have ended' })).toBeVisible()
  expect(requestUrls.every(url => !url.includes(token))).toBe(true)
})
