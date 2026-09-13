import { test, expect } from '@playwright/test'

for (const width of [390, 1440]) for (const path of ['/', '/users', '/coupons', '/settings', '/newsletter', '/profile', '/content/contact']) {
  test(`export belongs to page actions on ${path} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(() => {
      localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'placement-admin', name: 'Reviewer', email: 'review@example.test', role: 'admin' }))
      localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
      localStorage.setItem('uf_admin_token', 'test')
      localStorage.setItem('uf.admin.tourSeen.placement-admin', '1')
    })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/v1/**', route => {
      const routePath = new URL(route.request().url()).pathname
      let data: unknown = []
      if (routePath.endsWith('/rbac/me')) data = { permissions: ['users:read', 'coupons:read', 'coupons:create', 'settings:read', 'settings:update', 'content:read', 'content:update', 'analytics:read', 'newsletter:read', 'reports:read', 'campaigns:read'], roleName: 'Administrator' }
      else if (routePath.endsWith('/admin/action-center')) data = { items: [] }
      else if (routePath.endsWith('/notifications/unread-count')) data = { count: 0 }
      else if (routePath.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
      else if (routePath.endsWith('/profile')) data = { name: 'Reviewer', email: 'review@example.test' }
      else if (routePath.endsWith('/analytics/overview')) data = { totalUsers: 12, totalCampaigns: 4, totalDonations: 20, totalAmountRaised: 100, activeCampaigns: 2, successRate: 50 }
      else if (routePath.endsWith('/kyc/stats')) data = { pending: 0, approvedToday: 0, rejectedToday: 0 }
      return route.fulfill({ json: { data } })
    })
    await page.goto(path)
    const actions = page.getByRole('group', { name: 'Page actions', exact: true })
    const exportButton = actions.getByRole('button', { name: /^Export / })
    await expect(exportButton).toBeVisible()
    await expect(exportButton).toBeEnabled()
    if (path === '/coupons') await expect(actions.getByRole('link', { name: 'New Coupon' })).toBeVisible()
    if (path === '/settings') await expect(actions.getByRole('button', { name: 'Save Changes' })).toBeVisible()
    if (path === '/content/contact') await expect(actions.getByRole('button', { name: 'Save changes' })).toBeVisible()
    await exportButton.click()
    await expect(page.getByRole('menuitem', { name: 'Branded PDF' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Branded PDF' })).toHaveAccessibleDescription('Ready to share, with Ujimora branding.')
    await expect(page.getByRole('menuitem', { name: 'Excel (.xlsx)' })).toHaveAccessibleDescription('Organized worksheets for analysis.')
    await expect(page.getByRole('menuitem', { name: 'CSV (.csv)' })).toHaveAccessibleDescription('Plain tabular data for imports and tools.')
    const menu = page.getByRole('menu')
    const bounds = await menu.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    if (path === '/users') await menu.screenshot({ path: `/tmp/ujimora-export-format-menu-${width}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator('header').filter({ has: actions }).screenshot({ path: `/tmp/ujimora-export-placement-${path.replaceAll('/', '-') || 'dashboard'}-${width}.png`, animations: 'disabled' })
    expect(errors).toEqual([])
  })
}
