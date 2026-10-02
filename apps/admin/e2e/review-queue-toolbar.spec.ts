import { test, expect, type Locator } from '@playwright/test'

// Every page that renders the shared ReviewQueueToolbar, with the buttons that anchor its toolbars.
// The donation queue selects the longest option ("Campaign donor names and messages"), which used to widen
// the toolbar's wrapping column past its clipped edge at phone width.
const userId = '6abd48b1c2d3e4f5a6b7c8d9'
const pages = [
  { path: '/publication-reviews', anchors: ['Refresh publication reviews'] },
  { path: '/publication-reviews?queue=donation-content-reviews', anchors: ['Refresh publication reviews'] },
  { path: '/safety-reports', anchors: ['Refresh queue'] },
  { path: '/donor-thank-yous', anchors: ['Refresh'] },
  { path: '/campaign-reports', anchors: ['Refresh reports'] },
  { path: '/privacy-requests', anchors: ['Retry pending cleanup', 'Refresh data requests'] },
  { path: '/wallets', anchors: ['Refresh', 'Refresh'] },
  { path: `/users/${userId}`, anchors: ['Refresh', 'Refresh'] },
  { path: '/store-billing', anchors: ['Refresh queue'] },
  { path: '/refund-recovery', anchors: ['Refresh refunds'] },
  { path: '/refund-requests', anchors: ['Refresh requests'] },
  { path: '/provider-events', anchors: ['Refresh events'] },
  { path: '/payments', anchors: ['Search payments'] },
  { path: '/activity-email-review', anchors: ['Refresh'] },
  { path: '/content/blog', anchors: ['Refresh'] },
]
const permissions = ['reports', 'users', 'donations', 'subscriptions', 'wallets', 'settings', 'content', 'campaigns'].flatMap(resource => [`${resource}:read`, `${resource}:update`])

/** The toolbar holding this button: its content box, its hidden overflow and every control in it. */
function measure(button: Locator) {
  return button.evaluate(node => {
    let root = node.parentElement
    while (root && !(root.classList.contains('MuiStack-root') && getComputedStyle(root).overflow === 'hidden')) root = root.parentElement
    if (!root) throw new Error('No review queue toolbar around this button')
    const box = root.getBoundingClientRect(), style = getComputedStyle(root)
    const controls = [...root.querySelectorAll('.MuiFormControl-root, .MuiButton-root, .MuiToggleButtonGroup-root')]
      .filter(control => !control.parentElement?.closest('.MuiFormControl-root, .MuiToggleButtonGroup-root'))
      .map(control => {
        const rect = control.getBoundingClientRect()
        // A toggle group shows only its buttons, so it reaches as far as its last button does.
        const right = control.classList.contains('MuiToggleButtonGroup-root') && control.lastElementChild ? control.lastElementChild.getBoundingClientRect().right : rect.right
        return { name: control.getAttribute('aria-label') || control.querySelector('label')?.textContent || control.textContent, left: rect.left, right, top: rect.top, bottom: rect.bottom }
      })
    return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight), hiddenOverflow: root.scrollWidth - root.clientWidth, controls }
  })
}

for (const width of [390, 1280]) for (const { path, anchors } of pages) {
  test(`review queue toolbar on ${path} fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'toolbar-admin', name: 'Reviewer', role: 'admin' }))
      localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
      localStorage.setItem('uf_admin_token', 'test')
      localStorage.setItem('uf.admin.tourSeen.toolbar-admin', '1')
      localStorage.setItem('uf_admin_skin', 'neumorphism')
      localStorage.setItem('uf_admin_color_mode', 'light')
    })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/v1/**', route => {
      const routePath = new URL(route.request().url()).pathname
      let data: unknown = { items: [], total: 0, page: 1, pageSize: 25, pendingLiveCleanup: 0 }
      if (routePath.endsWith('/rbac/me')) data = { permissions, roleName: 'Administrator' }
      else if (routePath.endsWith('/admin/action-center')) data = { items: [] }
      else if (routePath.endsWith('/notifications/unread-count')) data = { count: 0 }
      else if (routePath.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
      else if (routePath.endsWith(`/users/${userId}`)) data = { id: userId, name: 'Kofi Mensah', email: 'kofi@example.test', role: 'user', accountType: 'user', verificationLevel: 2, emailVerified: true, createdAt: '2026-01-02T10:00:00.000Z' }
      else if (routePath.endsWith('/admin/store-billing')) data = { enabled: true, purchases: [], notifications: [], purchaseTotal: 0, notificationTotal: 0 }
      else if (/\/(admin\/payments\/provider-events|admin\/payments|blog\/admin\/posts|campaigns|admin\/donations)$/.test(routePath)) data = []
      return route.fulfill({ json: { data } })
    })
    await page.goto(path)
    const buttons: Locator[] = []
    for (const name of new Set(anchors)) {
      const named = page.getByRole('button', { name, exact: true })
      await expect(named).toHaveCount(anchors.filter(anchor => anchor === name).length)
      buttons.push(...await named.all())
    }
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    for (const button of buttons) {
      const toolbar = await measure(button)
      // The toolbar clips its overflow, so a page-level scrollWidth check cannot see controls cut off inside it.
      expect(toolbar.hiddenOverflow).toBe(0)
      for (const control of toolbar.controls) {
        expect(control.left, `${control.name} left edge`).toBeGreaterThanOrEqual(toolbar.left - 0.5)
        expect(control.right, `${control.name} right edge`).toBeLessThanOrEqual(toolbar.right + 0.5)
        if (width < 600) expect(control.right - control.left, `${control.name} width`).toBeCloseTo(toolbar.right - toolbar.left, 0)
      }
      const [first, second] = toolbar.controls
      if (width < 600) toolbar.controls.slice(1).forEach((control, index) => expect(control.top, `${control.name} sits below ${toolbar.controls[index].name}`).toBeGreaterThanOrEqual(toolbar.controls[index].bottom - 0.5))
      else if (second) expect(second.top, `${second.name} shares a row with ${first.name}`).toBeLessThan(first.bottom)
    }
    await buttons[0].evaluate(node => node.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: `/tmp/ujimora-review-toolbar-${path.replace(/\W+/g, '-').replace(/^-/, '')}-${width}.png`, animations: 'disabled' })
    expect(errors).toEqual([])
  })
}
