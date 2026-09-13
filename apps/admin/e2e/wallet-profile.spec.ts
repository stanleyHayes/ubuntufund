import { test, expect } from '@playwright/test'
const id = '507f1f77bcf86cd799439011'
for (const width of [390, 1440]) test(`wallet and focused profile layouts at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript((mode) => {
    localStorage.setItem('uf_admin_color_mode', mode)
    const user = { id: '507f1f77bcf86cd799439011', name: 'Stanley Hayford', email: 'admin@example.test', role: 'admin' }
    localStorage.setItem('uf_admin_user', JSON.stringify(user))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem(`uf.admin.tourSeen.${user.id}`, '1')
  }, width === 1440 ? 'light' : 'dark')
  let failed = false, empty = false, slow = false
  let donationUser = ''
  let donationFailed = true
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['users:read', 'wallets:read', 'donations:read'], roleName: 'Administrator' }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.includes('/admin/wallets')) {
      if (slow) await new Promise(resolve => setTimeout(resolve, 700))
      if (failed) return route.fulfill({ status: 503, json: { message: 'Wallet records temporarily unavailable' } })
      const tx = path.endsWith('/transactions')
      data = { total: empty ? 0 : 1, items: empty ? [] : [tx ? { id: 'tx', userId: id, walletId: 'wallet', type: 'donation', status: 'completed', amount: 50, currency: 'GHS', reference: 'wallet-donation-reference', createdAt: '2026-09-12' } : { id: 'wallet', userId: id, memberName: 'Stanley Hayford', type: 'local', balance: 123.45, currency: 'GHS', updatedAt: '2026-09-12' }] }
    } else if (path.endsWith(`/users/${id}`) || path.endsWith('/profile')) data = { id, name: 'Stanley Hayford', email: 'admin@example.test', role: 'admin', trustScore: 50, verificationLevel: 0, createdAt: '2025-01-01', notificationPreferences: { email: false, push: false } }
    else if (path.endsWith('/admin/donations')) {
      donationUser = url.searchParams.get('donorId') ?? ''
      if (donationFailed) return route.fulfill({ status: 503, json: { message: 'Donation service unavailable' } })
      data = { total: 1, items: [{ id: 'd1', donorId: id, campaignId: 'campaign', campaignTitle: 'Community learning', amount: 50, currency: 'GHS', createdAt: '2026-09-12' }] }
    } else if (path.endsWith('/campaigns')) data = { total: 0, items: [] }
    else if (path.includes('/mfa')) data = { enabled: false }
    await route.fulfill({ json: { data } })
  })
  await page.goto(`/users/${id}`)
  await expect(page.getByText('GHS 123.45')).toBeVisible()
  await expect(page.getByText('How to build trust')).toBeVisible()
  await expect(page.getByText(/Donation service unavailable/)).toBeVisible()
  donationFailed = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('Community learning')).toBeVisible()
  expect(donationUser).toBe(id)
  const campaign = await page.getByText('Recent campaigns by this member').boundingBox()
  const donation = await page.getByText('Recent contributions by this member').boundingBox()
  expect(donation!.y).toBeGreaterThan(campaign!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `/tmp/ujimora-member-wallet-${width}.png`, fullPage: true, animations: 'disabled' })
  await page.goto('/wallets')
  await expect(page.getByText('GHS 123.45')).toBeVisible()
  await page.getByRole('button', { name: 'Export Wallet balances', exact: true }).first().click()
  await expect(page.getByText('Branded PDF', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  failed = true
  await page.getByRole('button', { name: 'Refresh', exact: true }).first().click()
  await expect(page.getByText('Wallet records temporarily unavailable')).toBeVisible()
  failed = false; empty = true; slow = true
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Loading wallet balances' })).toBeVisible()
  await expect(page.getByText('No wallets yet', { exact: true })).toBeVisible()
  await page.goto('/profile')
  await expect(page.getByLabel('Full Name')).toBeVisible()
  await page.getByLabel('Full Name').fill('Draft name retained')
  await page.getByRole('tab', { name: 'Security', exact: true }).click()
  await expect(page.getByLabel('Current Password', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Full Name')).not.toBeVisible()
  await page.getByRole('tab', { name: 'Preferences', exact: true }).click()
  await expect(page.getByText('Notification Preferences', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Current Password', { exact: true })).not.toBeVisible()
  await page.getByRole('tab', { name: 'Personal details', exact: true }).click()
  await expect(page.getByLabel('Full Name')).toHaveValue('Draft name retained')
  await expect(page.getByRole('tab', { name: 'Personal details', exact: true })).toHaveAttribute('aria-selected', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `/tmp/ujimora-admin-profile-${width}.png`, fullPage: true, animations: 'disabled' })
})
