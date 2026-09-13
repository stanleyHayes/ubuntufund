import { test, expect } from '@playwright/test'
test('keeps a failed KYC decision pending and reflects a confirmed retry in the detail dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'kyc-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.kyc-admin', '1')
  })
  let writes = 0
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['verifications:read', 'verifications:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/kyc/pending')) data = [{ id: 'kyc-test', reviewVersion: 'a'.repeat(64), userId: 'user', userName: 'Applicant', status: 'pending', verificationType: 'identity', riskLevel: 'low', documents: [], createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z' }]
    else if (path.endsWith('/kyc/kyc-test/approve')) {
      writes++
      if (writes === 1) return route.fulfill({ status: 503, json: { message: 'Review service unavailable.' } })
      data = { status: 'approved' }
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/kyc-review')
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Internal review findings').fill('Identity documents reviewed against the application.')
  await dialog.getByRole('checkbox', { name: /I reviewed the application/ }).check()
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(dialog.getByText('Review service unavailable.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled()
  await page.screenshot({ path: '/tmp/ujimora-kyc-save-failure-phone.png', animations: 'disabled' })
  await dialog.getByLabel('Internal review findings').fill('Identity documents reviewed against the application.')
  await dialog.getByRole('checkbox', { name: /I reviewed the application/ }).check()
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  expect(writes).toBe(2)
  expect(errors).toEqual([])
})
