import { test, expect } from '@playwright/test'
test('saves a staff information request and shows applicant history after refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'kyc-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.kyc-admin', '1')
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let exchange: { id: string; prompt: string; requestedAt: string; response?: string; respondedAt?: string } | null = null
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['verifications:read', 'verifications:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/kyc/pending')) data = [{ id: 'kyc-test', reviewVersion: 'a'.repeat(64), userId: 'user', userName: 'Applicant', status: exchange && !exchange.respondedAt ? 'in_review' : 'pending', verificationType: 'identity', riskLevel: 'low', documents: [], informationRequests: exchange ? [exchange] : [], createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z' }]
    else if (path.endsWith('/request-info')) {
      expect(route.request().postDataJSON()).toEqual({ prompt: 'Please clarify the address on your document.', reviewVersion: 'a'.repeat(64) })
      exchange = { id: 'request-1', prompt: 'Please clarify the address on your document.', requestedAt: '2026-09-13T00:00:00Z' }
      data = exchange
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/kyc-review')
  await page.getByRole('button', { name: 'Request', exact: true }).click()
  const requestDialog = page.getByRole('dialog', { name: 'Request more information' })
  await requestDialog.getByLabel('Information needed').fill('Please clarify the address on your document.')
  await requestDialog.getByRole('button', { name: 'Save request' }).click()
  await expect(requestDialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByText('Please clarify the address on your document.')).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Request More', exact: true })).toBeDisabled()
  await detail.getByRole('button', { name: 'Close', exact: true }).click()
  exchange = { id: 'request-1', prompt: 'Please clarify the address on your document.', requestedAt: '2026-09-13T00:00:00Z', response: 'My address is unchanged.', respondedAt: '2026-09-13T01:00:00Z' }
  await page.getByRole('button', { name: 'Refresh queue' }).click()
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  await expect(detail.getByText('My address is unchanged.')).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled()
  await detail.getByLabel('Internal review findings').fill('Identity documents reviewed against the application.')
  await detail.getByRole('checkbox', { name: /I reviewed the application/ }).check()
  await expect(detail.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled()
  await detail.getByText('My address is unchanged.').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-kyc-information-staff-phone.png', animations: 'disabled' })
  expect(errors).toEqual([])
})
