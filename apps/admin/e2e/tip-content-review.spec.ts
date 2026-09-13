import { test, expect } from '@playwright/test'
for (const queue of ['tip-content-reviews', 'donation-content-reviews']) {
test(`reviews changed ${queue} content after a conflict at phone width`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'review-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.review-admin', '1')
  })
  let version = 'a'.repeat(64), approved = false
  const submissions: Record<string, unknown>[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['reports:read', 'reports:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith(`/${queue}`)) data = { items: approved ? [] : [{ id: 'tip', version, actorId: 'Guest', action: queue === 'tip-content-reviews' ? 'tip.public_content' : 'donation.public_content', text: JSON.stringify({ ...(queue === 'tip-content-reviews' ? { supporterName: 'Guest supporter' } : { donorName: 'Guest donor' }), message: version.startsWith('a') ? 'Original message' : 'Changed message for review' }), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: approved ? 0 : 1 }
    else if (path.endsWith('/tip/review') && route.request().method() === 'PUT') {
      submissions.push(route.request().postDataJSON())
      if (submissions.length === 1) { version = 'b'.repeat(64); return route.fulfill({ status: 409, json: { message: 'The content changed. Refresh before reviewing.' } }) }
      approved = true; data = { reviewed: true }
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto(`/publication-reviews?queue=${queue}`)
  const approve = page.getByRole('button', { name: 'Approve this version', exact: true })
  await expect(approve).toBeDisabled()
  await page.getByLabel('Review notes (at least 20 characters)').fill('Reviewed the exact supporter name and message.')
  await approve.click()
  await expect(page.getByText('The content changed. Refresh before reviewing.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByText(/Changed message for review/)).toBeVisible()
  await approve.click()
  await expect(page.getByText('No submissions in this queue.')).toBeVisible()
  expect(submissions.map(input => input.version)).toEqual(['a'.repeat(64), 'b'.repeat(64)])
  await page.screenshot({ path: `/tmp/ujimora-${queue}-phone.png`, animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

}
