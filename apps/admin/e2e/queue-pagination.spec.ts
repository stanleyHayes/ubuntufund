import { test, expect } from '@playwright/test'

const queues = ['publication-reviews', 'safety-reports', 'privacy-requests', 'data-rights', 'refund-operations', 'store-billing']
const fixture = { id: 'review', _id: 'review', userId: 'account', actorId: 'account', action: 'comment.create', text: 'A community contribution awaiting review.', mediaUrls: [], status: 'pending', reason: 'staff_requested', targetType: 'comment', priority: 'standard', description: 'Review the reported contribution.', evidence: 'Reported content', createdAt: '2026-09-12', requestedAt: '2026-09-12', nextReviewAt: '2026-10-12', reviewNotes: '', dueAt: '2026-10-12', contactEmail: 'review@example.test', kind: 'access', details: 'Please provide my account information.', response: '', revision: 0, provider: 'paystack', amount: 125, currency: 'GHS', state: 'provider_pending', store: 'apple', reviewRequired: true }
for (const width of [390, 1440]) for (const queue of queues) test(`${queue} follows shared pagination at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'pagination-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.pagination-admin', '1')
  })
  const errors: string[] = [], reads: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['reports:read', 'reports:update', 'users:read', 'users:update', 'donations:read', 'donations:update', 'subscriptions:read'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (queues.some(name => path.endsWith(`/${name}`))) {
      const selected = path.endsWith(`/${queue}`)
      if (selected) reads.push(url.search)
      data = path.endsWith('/store-billing') ? { enabled: true, purchases: [fixture], notifications: [], purchaseTotal: 27, notificationTotal: 0 } : { items: selected ? [fixture] : [], total: selected ? 27 : 0, page: Number(url.searchParams.get('page')), pageSize: Number(url.searchParams.get('pageSize')), pendingLiveCleanup: 0 }
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto(`/${queue === 'data-rights' ? 'privacy-requests' : queue === 'refund-operations' ? 'refund-recovery' : queue}`)
  const bar = page.getByRole('navigation', { name: 'Pagination', exact: true })
  await expect(bar).toBeVisible()
  await expect(bar.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled()
  await bar.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(bar.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(reads.some(read => read.includes('page=2') && read.includes('pageSize=12'))).toBe(true)
  await bar.getByRole('combobox', { name: 'Items per page' }).click()
  await page.getByRole('option', { name: '24', exact: true }).click()
  await expect(bar.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(reads.some(read => read.includes('page=1') && read.includes('pageSize=24'))).toBe(true)
  await bar.getByRole('button', { name: 'Last page', exact: true }).click()
  await expect(bar.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await bar.screenshot({ path: `/tmp/ujimora-${queue}-${width}-pagination.png`, animations: 'disabled' })
  if (queue === 'refund-operations') await page.screenshot({ path: `/tmp/ujimora-refund-toolbar-${width}.png`, fullPage: true, animations: 'disabled' })
  expect(errors).toEqual([])
})
