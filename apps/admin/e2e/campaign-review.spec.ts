import { test, expect } from '@playwright/test'
test('reviews the exact campaign version and reloads a conflict before approving at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'review-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.review-admin', '1')
  })
  let version = 'a'.repeat(64), status = 'pending_review', attempts = 0
  const submissions: Record<string, unknown>[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['campaigns:read', 'campaigns:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/campaigns/review-campaign')) data = { id: 'review-campaign', creatorId: 'organizer', title: 'School review fixture', description: 'Review the full classroom improvement story and beneficiary authority.', status, reviewVersion: version, category: 'education', priority: 'normal', currency: 'GHS', goalAmount: 300000, raisedAmount: 35.5, beneficiaries: ['School community'], imageUrls: [], startDate: '2026-09-01T00:00:00Z', endDate: '2027-12-31T00:00:00Z' }
    else if (path.endsWith('/reviews')) data = { items: status === 'active' ? [{ id: 'decision', version: 'b'.repeat(64), actorId: 'review-admin', action: 'approve', reason: 'Reviewed full content and fundraising evidence.', beforeStatus: 'pending_review', afterStatus: 'active', createdAt: '2026-09-12T23:00:00Z' }] : [], total: status === 'active' ? 1 : 0 }
    else if (path.endsWith('/review') && route.request().method() === 'PUT') {
      submissions.push(route.request().postDataJSON()); attempts++
      if (attempts === 1) { version = 'b'.repeat(64); return route.fulfill({ status: 409, json: { message: 'The campaign changed. Reload and review the current version.' } }) }
      status = 'active'; version = 'c'.repeat(64); data = { status }
    }
    else if (path.endsWith('/split')) data = null
    return route.fulfill({ json: { data } })
  })
  await page.goto('/campaigns/review-campaign')
  const approve = page.getByRole('button', { name: 'Approve campaign', exact: true })
  await expect(approve).toBeDisabled()
  async function review() {
    await page.getByLabel('Decision notes (at least 20 characters)').fill('Reviewed full content and fundraising evidence.')
    await page.getByRole('checkbox', { name: /complete public content/ }).check()
    await page.getByRole('checkbox', { name: /organizer verification/ }).check()
  }
  await review(); await approve.click()
  await expect(page.getByText(/The campaign changed/)).toBeVisible()
  await page.getByRole('button', { name: 'Reload', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /complete public content/ })).not.toBeChecked()
  await review(); await approve.click()
  await expect(page.getByText('approve · pending_review → active')).toBeVisible()
  await page.getByRole('heading', { name: 'Review history', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-staff-review-phone.png', animations: 'disabled' })
  expect(submissions.map(input => input.expectedVersion)).toEqual(['a'.repeat(64), 'b'.repeat(64)])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})
