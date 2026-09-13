import { test, expect } from '@playwright/test'
test('requires a refreshed staff screen after an evidence-version conflict', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'kyc-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.kyc-admin', '1')
  })
  let writes = 0
  let changed = false
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['verifications:read', 'verifications:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/kyc/pending')) data = [{ id: 'kyc-test', reviewVersion: (changed ? 'b' : 'a').repeat(64), userId: 'user', userName: 'Applicant', status: 'pending', verificationType: 'identity', riskLevel: 'low', documents: [], createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z' }]
    else if (path.endsWith('/kyc/kyc-test/approve')) {
      writes++
      expect(route.request().postDataJSON()).toEqual({ reviewVersion: (writes === 1 ? 'a' : 'b').repeat(64), evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.' })
      if (writes === 1) { changed = true; return route.fulfill({ status: 409, json: { message: 'This application has changed. Refresh the queue.' } }) }
      data = { status: 'approved' }
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/kyc-review?application=kyc-test')
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Internal review findings').fill('Identity documents reviewed against the application.')
  await dialog.getByRole('checkbox', { name: /I reviewed the application/ }).check()
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(dialog.getByText('This application has changed. Refresh the queue.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh queue' }).click()
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  await dialog.getByLabel('Internal review findings').fill('Identity documents reviewed against the application.')
  await dialog.getByRole('checkbox', { name: /I reviewed the application/ }).check()
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  expect(writes).toBe(2)
  expect(errors).toEqual([])
})
