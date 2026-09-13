import { test, expect } from '@playwright/test'
test('saves an applicant-facing rejection reason on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'kyc-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.kyc-admin', '1')
  })
  let saved = false
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['verifications:read', 'verifications:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/kyc/pending')) data = [{ id: 'kyc-test', reviewVersion: 'a'.repeat(64), userId: 'user', userName: 'Applicant', status: 'pending', verificationType: 'identity', riskLevel: 'low', documents: [], createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z' }]
    else if (path.endsWith('/reject')) {
      expect(route.request().postDataJSON()).toEqual({ reviewVersion: 'a'.repeat(64), rejectionReason: 'Please submit a readable front and back image of your ID.' })
      saved = true; data = { status: 'rejected' }
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/kyc-review')
  await page.getByRole('button', { name: 'Review verification for Applicant' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reject', exact: true }).click()
  const reason = page.getByRole('dialog', { name: 'Explain the verification decision' })
  await expect(reason.getByRole('button', { name: 'Save rejection' })).toBeDisabled()
  await reason.getByLabel('Reason for the applicant').fill('Please submit a readable front and back image of your ID.')
  await page.screenshot({ path: '/tmp/ujimora-kyc-rejection-reason-phone.png', animations: 'disabled' })
  await reason.getByRole('button', { name: 'Save rejection' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(saved).toBe(true)
})
