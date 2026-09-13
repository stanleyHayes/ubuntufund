import { test, expect } from '@playwright/test'
for (const width of [390, 1440])
  test(`blog draft and reviewed publication at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'uf_admin_user',
        JSON.stringify({
          id: 'blog-admin',
          name: 'Editor',
          email: 'editor@example.test',
          role: 'admin',
        }),
      )
      localStorage.setItem(
        'uf_admin_tokens',
        JSON.stringify({ accessToken: 'test', refreshToken: 'test' }),
      )
      localStorage.setItem('uf_admin_token', 'test')
      localStorage.setItem('uf.admin.tourSeen.blog-admin', '1')
    })
    let record: any = null,
      published = false
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname,
        method = route.request().method()
      let data: any = []
      if (path.endsWith('/rbac/me'))
        data = {
          permissions: ['content:read', 'content:update', 'content:create'],
          roleName: 'Administrator',
        }
      else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
      else if (path.endsWith('/admin/action-center')) data = { items: [] }
      else if (path.endsWith('/uploads/image')) data = { url: 'https://example.test/cover.png' }
      else if (path.endsWith('/publish')) {
        published = true
        record = { ...record, revision: record.revision + 1, published: { ...record.draft } }
        data = record
      } else if (path.includes('/blog/admin/posts')) {
        if (method === 'POST' || method === 'PUT')
          record = {
            id: '507f1f77bcf86cd799439011',
            draft: route.request().postDataJSON().draft,
            revision: (record?.revision ?? 0) + 1,
            updatedAt: new Date().toISOString(),
          }
        data = path.endsWith('/posts') && method === 'GET' ? (record ? [record] : []) : record
      }
      await route.fulfill({ json: { data } })
    })
    await page.route('https://example.test/cover.png', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#8eac96"/><circle cx="400" cy="225" r="90" fill="#c7a349"/></svg>',
      }),
    )
    await page.goto('/content/blog/new')
    await page.getByRole('textbox', { name: 'Article title' }).fill('Community field notes')
    await page.getByRole('textbox', { name: 'Short summary' }).fill('A guide to giving together.')
    await page.getByRole('textbox', { name: 'Category', exact: true }).fill('Community')
    await page.getByRole('textbox', { name: 'Author name' }).fill('Ujimora Editorial')
    await page.getByRole('button', { name: 'Continue to write' }).click()
    await expect(page.getByRole('toolbar', { name: 'Article formatting' })).toBeVisible()
    await page.getByRole('button', { name: 'Markdown', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Markdown source' })
      .fill(
        '## Together\n\n**Every gift matters.**\n\n| Goal | Impact |\n| --- | --- |\n| Water | Health |\n\n<script>window.unsafe=true</script>',
      )
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Together', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Health', exact: true })).toBeVisible()
    expect(await page.evaluate(() => (window as any).unsafe)).toBeUndefined()
    await page.getByRole('button', { name: 'Continue to media' }).click()
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: 'cover.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=',
          'base64',
        ),
      })
    await expect(page.getByRole('button', { name: 'Replace', exact: true })).toBeVisible()
    await page
      .getByRole('textbox', { name: 'Cover image description' })
      .fill('Community artwork in sage and gold')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page).toHaveURL(/\/content\/blog\/507f/)
    expect(published).toBe(false)
    await page.getByRole('button', { name: 'Continue to review' }).click()
    await expect(page.getByRole('button', { name: 'Publish article', exact: true })).toBeDisabled()
    await page
      .getByRole('checkbox', { name: 'I have reviewed this article and its media.' })
      .check()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `/tmp/ujimora-blog-review-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Publish article', exact: true }).click()
    await expect(page.getByText('Article published to the Ujimora blog.')).toBeVisible()
    expect(published).toBe(true)
    expect(record.draft.body).toContain('**Every gift matters.**')
  })
for (const mode of ['light', 'dark'])
  test(`contact dialog and saved photo preview in ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: mode === 'light' ? 390 : 1440, height: 1000 })
    await page.addInitScript((mode) => {
      localStorage.setItem('uf_admin_color_mode', mode)
      localStorage.setItem(
        'uf_admin_user',
        JSON.stringify({
          id: 'blog-admin',
          name: 'Editor',
          email: 'editor@example.test',
          role: 'admin',
        }),
      )
      localStorage.setItem(
        'uf_admin_tokens',
        JSON.stringify({ accessToken: 'test', refreshToken: 'test' }),
      )
      localStorage.setItem('uf_admin_token', 'test')
      localStorage.setItem('uf.admin.tourSeen.blog-admin', '1')
    }, mode)
    const contact = {
      id: 'contact1',
      name: 'Community member',
      email: 'member@example.test',
      subject: 'Payout Duration',
      message: 'How long does it take for a payout to reflect?',
      inquiryType: 'general',
      status: 'new',
      createdAt: '2026-09-12T10:39:04Z',
    }
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      let data: any = []
      if (path.endsWith('/rbac/me'))
        data = {
          permissions: [
            'content:read',
            'content:update',
            'contact_submissions:read',
            'contact_submissions:update',
          ],
          roleName: 'Administrator',
        }
      else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
      else if (path.endsWith('/admin/action-center')) data = { items: [] }
      else if (path.endsWith('/contact/stats'))
        data = { total: 1, new: 1, inProgress: 0, resolved: 0, archived: 0 }
      else if (path.endsWith('/contact')) data = { items: [contact], total: 1 }
      else if (path.endsWith('/contact/contact1/status'))
        return route.fulfill({ status: 500, json: { message: 'Could not update' } })
      else if (path.endsWith('/content/about'))
        data = {
          key: 'about',
          type: 'page',
          updatedAt: '2026-09-12',
          data: {
            hero: { title: 'About', subtitle: 'Our story' },
            mission: {},
            vision: {},
            philosophy: {},
            team: [
              {
                name: 'Example Member',
                role: 'Founder',
                initials: 'EM',
                bio: 'Community giving',
                image: '/images/about/stanley.png',
                socials: [],
              },
            ],
          },
        }
      await route.fulfill({ json: { data } })
    })
    await page.route('https://ujimora.com/images/about/stanley.png', (route) => route.abort())
    await page.goto('/contact-submissions')
    await page.getByText('Payout Duration', { exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('textbox', { name: 'Admin Notes' }).fill('Follow up with the payout team.')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Could not update the submission. Please try again.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Admin Notes' })).toHaveValue(
      'Follow up with the payout team.',
    )
    await page.screenshot({ path: `/tmp/ujimora-contact-dialog-${mode}.png` })
    await page.getByRole('button', { name: 'Close submission' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.goto('/content/about')
    await expect(page.getByRole('button', { name: 'Retry preview' })).toBeVisible()
    await page.getByRole('button', { name: 'Retry preview' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/ujimora-photo-preview-${mode}.png` })
    let retried = false
    await page.unroute('https://ujimora.com/images/about/stanley.png')
    await page.route('https://ujimora.com/images/about/stanley.png', (route) => {
      retried = true
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="green"/></svg>',
      })
    })
    await page.getByRole('button', { name: 'Retry preview' }).click()
    await expect(page.getByRole('button', { name: 'Retry preview' })).toBeHidden()
    expect(retried).toBe(true)
  })
for (const width of [390, 1440]) test(`blog list loading, error and empty states at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'blog-admin', name: 'Editor', email: 'editor@example.test', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.blog-admin', '1')
  })
  let release!: () => void, failed = true
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/blog/admin/posts')) {
      await gate
      return route.fulfill(failed ? { status: 503, json: { message: 'Journal unavailable. Try again.' } } : { json: { data: [] } })
    }
    const data = path.endsWith('/rbac/me') ? { permissions: ['content:read'], roleName: 'Administrator' } : path.endsWith('/notifications/unread-count') ? { count: 0 } : path.endsWith('/admin/action-center') ? { items: [] } : []
    await route.fulfill({ json: { data } })
  })
  await page.goto('/content/blog')
  await expect(page.getByRole('status', { name: 'Loading articles' })).toBeVisible()
  await page.screenshot({ path: `/tmp/ujimora-blog-list-loading-${width}.png`, fullPage: true })
  release()
  await expect(page.getByRole('alert')).toContainText('Journal unavailable')
  await expect(page.getByText('Your next story starts here')).toBeHidden()
  failed = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('Your next story starts here')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: `/tmp/ujimora-blog-list-empty-${width}.png`, fullPage: true })
})
