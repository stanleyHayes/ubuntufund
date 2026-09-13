import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'

async function session(page: Page) {
  await page.addInitScript(() => {
    const user = { id: 'export-admin', name: 'Export admin', email: 'export@example.test', role: 'admin' }
    localStorage.setItem('uf_admin_user', JSON.stringify(user))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.export-admin', '1')
  })
  const users = Array.from({ length: 105 }, (_, index) => ({ id: `user-${index}`, name: index === 0 || index === 104 ? `Selected ${index}` : `Member ${index}`, email: `member-${index}@example.test`, role: 'user', verificationLevel: 0, trustScore: 50, needsWebsite: index === 104, createdAt: '2026-09-12T12:30:00Z' }))
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data: unknown = []
    if (url.pathname.endsWith('/rbac/me')) data = { permissions: ['users:read'], roleName: 'Administrator' }
    else if (url.pathname.endsWith('/admin/action-center')) data = { items: [] }
    else if (url.pathname.endsWith('/users/export-admin')) data = { id: 'export-admin', role: 'admin' }
    else if (url.pathname.endsWith('/users')) {
      const pageSize = Number(url.searchParams.get('pageSize') ?? 100), current = Number(url.searchParams.get('page') ?? 1)
      data = { items: users.slice((current - 1) * pageSize, current * pageSize), total: users.length, page: current, pageSize }
    } else if (url.pathname.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (url.pathname.endsWith('/notifications/unread-count')) data = { count: 0 }
    await route.fulfill({ json: { data } })
  })
}

test('downloads filtered CSV, typed Excel and branded PDF across server pagination at phone width', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 390, height: 844 })
  await session(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/users')
  await expect(page.getByText('105 users', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search users...' }).fill('Selected')
  await expect(page.getByText('2 users', { exact: true })).toBeVisible()
  for (const [label, extension] of [['CSV (.csv)', 'csv'], ['Excel (.xlsx)', 'xlsx'], ['Branded PDF', 'pdf']]) {
    await page.getByRole('button', { name: 'Export Users' }).click()
    const pending = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: label }).click()
    const download = await pending
    expect(download.suggestedFilename()).toMatch(new RegExp(`^ujimora-users-.*\\.${extension}$`))
    const bytes = await readFile((await download.path())!)
    if (extension === 'csv') {
      expect(bytes.toString()).toContain('Selected 104')
      expect(bytes.toString()).toContain('Selected 0')
      expect(bytes.toString()).not.toContain('Member 50')
    } else if (extension === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(bytes)
      const sheet = workbook.getWorksheet('Users')!
      expect(sheet.rowCount).toBe(3)
      expect(sheet.getCell('B3').value).toBe('Selected 104')
      expect(sheet.getCell('F3').value).toBe(50)
      expect(sheet.getCell('H3').value).toEqual(new Date('2026-09-12T12:30:00Z'))
    } else {
      expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
      await download.saveAs('/tmp/ujimora-admin-browser-export.pdf')
    }
  }
  await page.screenshot({ path: '/tmp/ujimora-admin-exports-phone.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

test('blocks an export when staff access is revoked', async ({ page }) => {
  await session(page)
  await page.goto('/users')
  await expect(page.getByText('105 users', { exact: true })).toBeVisible()
  await page.route('**/api/v1/users/export-admin', route => route.fulfill({ status: 403, json: { message: 'Staff access was revoked.' } }))
  const downloads: string[] = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  await page.getByRole('button', { name: 'Export Users' }).click()
  await page.getByRole('menuitem', { name: 'CSV (.csv)' }).click()
  await expect(page.getByText('Staff access was revoked.')).toBeVisible()
  expect(downloads).toEqual([])
})

test('exports the selected campaign donor review queue across its 25-row pages', async ({ page }) => {
  test.setTimeout(90000)
  await session(page)
  await page.route('**/api/v1/rbac/me', route => route.fulfill({ json: { data: { permissions: ['reports:read', 'reports:update'], roleName: 'Administrator' } } }))
  const rows = Array.from({ length: 26 }, (_, index) => ({ id: `donation-${index}`, action: 'donation.public_content', actorId: 'Guest', status: 'pending', reason: 'staff_requested', text: JSON.stringify({ donorName: `Donor ${index}`, message: `Community support ${index}` }), mediaUrls: [] }))
  const requests: string[] = []
  await page.route('**/api/v1/admin/donation-content-reviews?*', route => {
    const url = new URL(route.request().url())
    requests.push(url.search)
    const current = Number(url.searchParams.get('page') ?? 1)
    return route.fulfill({ json: { data: { items: rows.slice((current - 1) * 25, current * 25), total: rows.length } } })
  })
  await page.goto('/publication-reviews?queue=donation-content-reviews')
  await expect(page.getByRole('button', { name: 'Export Publication reviews' })).toBeEnabled()
  for (const [label, extension] of [['CSV (.csv)', 'csv'], ['Excel (.xlsx)', 'xlsx'], ['Branded PDF', 'pdf']]) {
    await page.getByRole('button', { name: 'Export Publication reviews' }).click()
    const pending = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: label }).click()
    const download = await pending
    const bytes = await readFile((await download.path())!)
    if (extension === 'csv') {
      expect(bytes.toString()).toContain('donation-25')
      expect(bytes.toString()).toContain('Community support 25')
      expect(bytes.toString()).toContain('donation.public_content')
    } else if (extension === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(bytes)
      const sheet = workbook.getWorksheet('Publication reviews')!
      expect(sheet.rowCount).toBe(27)
      expect(sheet.getCell('A27').value).toBe('donation-25')
      expect(sheet.getCell('F27').value).toContain('Community support 25')
    } else {
      expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
      await download.saveAs('/tmp/ujimora-donor-review-export.pdf')
    }
  }
  expect(requests.filter(search => new URLSearchParams(search).get('page') === '2')).toHaveLength(3)
  expect(requests.every(search => new URLSearchParams(search).get('status') === 'pending')).toBe(true)
})
