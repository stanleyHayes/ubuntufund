import { test, expect } from '@playwright/test'
const photo = 'https://res.cloudinary.com/ujimora/image/upload/v1/avatars/photo.jpg', cover = 'https://res.cloudinary.com/ujimora/image/upload/v1/covers/cover.jpg'
const svg = (width: number, height: number, fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`
const items = [
  { id: 'own', actorId: 'pubreview-admin', action: 'comment.create', text: 'A comment I wrote on a campaign.', mediaUrls: [], status: 'pending', reason: 'staff_requested' },
  { id: 'profile', actorId: 'creator-account', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama Mensah', bio: 'Supporting school feeding in Tamale.', avatarUrl: photo, coverUrl: cover }), mediaUrls: [photo, cover], status: 'pending', reason: 'staff_requested' },
  { id: 'external', actorId: 'community-member', action: 'comment.create', text: 'See the attached picture.', mediaUrls: ['https://media.example.test/uploads/very-long-file-name-for-an-external-attachment.jpg'], status: 'pending', reason: 'staff_requested' },
]
for (const width of [390, 1280]) test(`publication reviews preview media and flag own submissions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'pubreview-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.pubreview-admin', '1')
  })
  const errors: string[] = [], external: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().startsWith('https://media.example.test/')) external.push(request.url()) })
  await page.route('https://res.cloudinary.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: route.request().url().includes('cover') ? svg(1200, 400, '#2f6f5e') : svg(400, 400, '#c9772b') }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['reports:read', 'reports:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/publication-reviews')) data = { items, total: items.length }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/publication-reviews')
  await expect(page.getByAltText('Photo preview')).toHaveAttribute('src', photo)
  await expect(page.getByAltText('Cover preview')).toHaveAttribute('src', cover)
  await expect.poll(() => page.locator('img[alt$=" preview"]').evaluateAll(images => images.map(image => (image as HTMLImageElement).naturalWidth))).toEqual([400, 1200])
  await expect(page.getByText(/not hosted in Ujimora image storage/)).toBeVisible()
  await expect(page.getByText('You submitted this. Another administrator must review it.', { exact: true })).toHaveCount(1)
  const approve = page.getByRole('button', { name: 'Approve this version', exact: true })
  await page.getByLabel('Review notes (at least 20 characters)').nth(0).fill('Trying to review my own comment here.')
  await page.getByLabel('Review notes (at least 20 characters)').nth(1).fill('Reviewed the proposed photo and cover.')
  await expect(approve.nth(0)).toBeDisabled()
  await expect(approve.nth(1)).toBeEnabled()
  const columns = await page.locator('img[alt="Photo preview"]').evaluate(image => { let grid = image.parentElement; while (grid && getComputedStyle(grid).display !== 'grid') grid = grid.parentElement; return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0 })
  expect(columns).toBe(width < 600 ? 1 : 2)
  await page.screenshot({ path: `/tmp/ujimora-admin-pubreview-${width}.png`, fullPage: true, animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(external).toEqual([])
  expect(errors).toEqual([])
})
