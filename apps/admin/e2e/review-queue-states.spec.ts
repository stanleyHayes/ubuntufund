import { test, expect } from '@playwright/test'

const queues = [
  { path: 'publication-reviews', title: 'Publication reviews', empty: 'No submissions in this queue.', loading: 'Loading publication reviews' },
  { path: 'safety-reports', title: 'Community safety reports', empty: 'No reports in this queue.', loading: 'Loading safety reports' },
  { path: 'privacy-requests', title: 'Privacy requests', empty: 'No account deletion requests.', loading: 'Loading account deletion requests' },
  { path: 'refund-recovery', title: 'Refund recovery', empty: 'No unresolved refund operations.', loading: 'Loading refund recovery' },
  { path: 'store-billing', title: 'Store billing recovery', empty: 'No pending billing recovery work.', loading: 'Loading store billing recovery' },
]
for (const width of [390, 1440]) for (const queue of queues) {
  test(`${queue.path} has branded loading, empty and error states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(() => {
      localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'queue-admin', name: 'Reviewer', role: 'admin' }))
      localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
      localStorage.setItem('uf_admin_token', 'test')
      localStorage.setItem('uf.admin.tourSeen.queue-admin', '1')
    })
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let failed = false
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname
      let data: unknown = []
      if (path.endsWith('/rbac/me')) data = { permissions: ['reports:read', 'reports:update', 'users:read', 'users:update', 'donations:read', 'donations:update', 'subscriptions:read'], roleName: 'Administrator' }
      else if (path.endsWith('/admin/action-center')) data = { items: [] }
      else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
      else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
      else if (/\/(publication-reviews|safety-reports|privacy-requests|data-rights|refund-operations|store-billing)$/.test(path)) {
        await held
        if (failed) return route.fulfill({ status: 503, json: { message: 'Queue temporarily unavailable' } })
        data = path.endsWith('/store-billing') ? { enabled: true, purchases: [], notifications: [], purchaseTotal: 0, notificationTotal: 0 } : { items: [], total: 0, page: 1, pageSize: 25, pendingLiveCleanup: 0 }
      }
      await route.fulfill({ json: { data } })
    })
    await page.goto(`/${queue.path}`)
    await expect(page.getByRole('status', { name: queue.loading, exact: true })).toBeVisible()
    await expect(page.getByText(queue.empty, { exact: true })).toHaveCount(0)
    const header = page.locator('header').filter({ has: page.getByRole('heading', { name: queue.title, exact: true }) })
    await expect(header.locator('[aria-hidden] svg')).not.toHaveCount(0)
    await page.screenshot({ path: `/tmp/ujimora-${queue.path}-${width}-loading.png`, fullPage: true, animations: 'disabled' })
    release()
    await expect(page.getByText(queue.empty, { exact: true })).toBeVisible()
    await expect(page.getByRole('status', { name: queue.loading, exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: `/tmp/ujimora-${queue.path}-${width}-empty.png`, fullPage: true, animations: 'disabled' })
    failed = true
    await page.reload()
    await expect(page.getByRole('alert').filter({ hasText: /unavailable|Could not load/ }).first()).toBeVisible()
    await expect(page.getByText(queue.empty, { exact: true })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
