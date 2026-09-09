import { test, expect } from '@playwright/test'

const campaign = { id: 'example', creatorId: 'test', title: 'Test community campaign', summary: 'A community campaign', description: 'A campaign description', category: 'business', priority: 'critical', status: 'active', goalAmount: 5000, raisedAmount: 0, currency: 'GHS', imageUrls: [], beneficiaries: [], endDate: '2027-01-01', createdAt: '2026-09-01', updatedAt: '2026-09-01', donorCount: 0 }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'test', name: 'Test', email: 'test@example.com', role: 'user' }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_color_mode', 'light')
  })
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/campaigns/mine') ? [campaign] : path.endsWith('/campaigns/example') ? campaign : path.endsWith('/profile') ? {} : path.endsWith('/users/test') ? { id: 'test', name: 'Test' } : []
    return route.fulfill({ json: { data } })
  })
})

test('dashboard supporter count follows API data', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('0 supporters', { exact: true })).toBeVisible()
  await expect(page.getByText('147 supporters', { exact: true })).toHaveCount(0)
  await page.route('**/api/v1/campaigns/mine', route => route.fulfill({ json: { data: [{ ...campaign, donorCount: 1 }] } }))
  await page.reload()
  await expect(page.getByText('1 supporter', { exact: true })).toBeVisible()
})

test('critical badge has dark text on the light skin', async ({ page }) => {
  await page.goto('/campaigns/example')
  const badge = page.locator('.MuiChip-colorError').filter({ hasText: 'Critical' })
  await expect(badge).toBeVisible()
  await expect(badge).toHaveCSS('color', 'rgb(165, 67, 47)')
  await page.screenshot({ path: '/tmp/ubuntu-campaign-urgency.png', fullPage: false })
})

test('profile and cover use the campaign uploader and persist uploaded images', async ({ page }) => {
  const imageUrl = 'https://images.example.test/profile.png'
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
  await page.route(imageUrl, route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/v1/uploads/image?folder=profiles', route => route.fulfill({ json: { data: { url: imageUrl } } }))
  await page.goto('/profile')
  for (const [button, kind] of [['Change cover', 'coverUrl'], ['Change profile image', 'avatarUrl']]) {
    await page.getByRole('button', { name: button, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Image URL')).toHaveCount(0)
    await dialog.locator('input[type=file]').setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: png })
    await expect(dialog.getByRole('button', { name: 'Replace', exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save image' })).toBeEnabled()
    if (kind === 'coverUrl') await page.screenshot({ path: '/tmp/ubuntu-profile-image-editor.png', fullPage: false })
    const save = page.waitForRequest(req => req.method() === 'PUT' && req.url().endsWith('/profile'))
    await dialog.getByRole('button', { name: 'Save image' }).click()
    expect((await save).postDataJSON()).toEqual({ [kind]: imageUrl })
    await expect(dialog).toHaveCount(0)
  }
})


test('campaign donation instructions rebrand legacy wallet provider names', async ({ page }) => {
  await page.route('**/api/v1/payment-providers/enabled', route => route.fulfill({ json: { data: [{ id: 'wallet', name: 'UbuntuFund Wallet', slug: 'wallet', type: 'wallet', isDefault: true, feePercent: 0 }] } }))
  await page.goto('/campaigns/example')
  const instructions = page.getByRole('region', { name: 'How to donate' })
  await expect(instructions.getByText('Ujimora Wallet', { exact: true })).toBeVisible()
  await expect(page.getByText(/UbuntuFund Wallet/i)).toHaveCount(0)
})

for (const slug of ['community-fund', undefined]) {
  test(`campaign checkout is reachable without wallet providers (${slug ?? 'legacy ID'})`, async ({ page }) => {
    const id = '507f1f77bcf86cd799439011'
    const record = { ...campaign, id, slug }
    await page.route(`**/api/v1/campaigns/${id}`, route => route.fulfill({ json: { data: record } }))
    await page.route('**/api/v1/campaigns/slug/*/public', route => route.fulfill({ json: { data: record } }))
    await page.route('**/api/v1/payments/crypto/assets', route => route.fulfill({ json: { data: { enabled: false, assets: [] } } }))
    await page.goto(`/campaigns/${id}`)
    await page.getByRole('link', { name: 'Donate now', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/c/${slug ?? id}/donate$`))
    await expect(page.locator('#donor-email')).toBeVisible()
    await expect(page.getByText('You can pay with', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crypto', exact: true })).toHaveCount(0)
  })
}
