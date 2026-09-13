import { test, expect } from '@playwright/test'
const cases = [
  { path: 'kyc-review', choices: ['Pending', 'Identity'] },
  { path: 'campaigns', choices: ['Active', 'Education'] },
  { path: 'disputes', choices: ['Under Review'] },
  { path: 'subscriptions', choices: ['Pro', 'Past due'] },
  { path: 'contact-submissions', choices: ['In Progress', 'Partnership'] },
  { path: 'users', choices: ['Organization'] },
  { path: 'publication-reviews', choices: ['Campaign donor names and messages', 'Approved'] },
]
for (const width of [390, 1440]) for (const item of cases) test(`${item.path} described choices at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 })
  await page.addInitScript(mode => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'dropdown-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.dropdown-admin', '1')
    localStorage.setItem('uf_admin_color_mode', mode)
  }, width === 1440 ? 'light' : 'dark')
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = { items: [], total: 0, page: 1, pageSize: 12 }
    if (path.endsWith('/rbac/me')) data = { permissions: ['verifications:read', 'campaigns:read', 'disputes:read', 'subscriptions:read', 'contact_submissions:read', 'users:read', 'reports:read'], roleName: 'Administrator' }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/plans')) data = []
    await route.fulfill({ json: { data } })
  })
  await page.goto(`/${item.path}`)
  for (const [index, title] of item.choices.entries()) {
    const field = page.getByRole('combobox').nth(index)
    await field.click()
    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible()
    for (const option of await options.all()) {
      expect(await option.locator('svg').count()).toBeGreaterThan(0)
      const desc = await option.getAttribute('aria-describedby')
      expect(desc).toBeTruthy()
      expect((await page.locator(`[id="${desc}"]`).innerText()).length).toBeGreaterThan(12)
    }
    const bounds = await page.getByRole('listbox').boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    await page.screenshot({ path: `/tmp/ujimora-${item.path}-dropdown-${index}-${width}.png`, animations: 'disabled' })
    await page.getByRole('option', { name: title, exact: true }).click()
    await expect(field).toHaveText(title)
    await field.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(field).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
