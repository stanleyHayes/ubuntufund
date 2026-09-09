import { test, expect } from '@playwright/test'
const walletId = '507f1f77bcf86cd799439011'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'test', name: 'Test', role: 'user' }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'test', refreshToken: 'test' } : route.request().url().endsWith('/topups/config') ? { enabled: true, mode: 'test' } : route.request().url().endsWith('/wallets') ? [{ id: walletId, type: 'local', balance: 0, currency: 'GHS', updatedAt: new Date().toISOString() }] : [] } }))
})

test('top-up sends idempotency key and waits for provider confirmation before displaying money', async ({ page }) => {
  let key: string | undefined
  await page.route('**/api/v1/wallets/topups', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
    key = route.request().headers()['idempotency-key']
    expect(route.request().headers().authorization).toBe('Bearer test')
    expect(route.request().postDataJSON()).toEqual({ walletId, amount: 100 })
    return route.fulfill({ json: { data: { status: 'pending', reference: 'wtop-test', authorizationUrl: 'https://checkout.example.test/fund' } } })
  })
  await page.route('https://checkout.example.test/fund', route => route.fulfill({ contentType: 'text/html', body: '<p>Test checkout</p>' }))
  await page.goto('/wallet')
  await page.getByLabel('Top-up amount (GHS)').fill('100')
  await page.getByRole('button', { name: 'Fund wallet' }).click()
  await expect(page).toHaveURL('https://checkout.example.test/fund')
  expect(key).toMatch(/^[a-f0-9-]{36}$/)
  let completed = false
  await page.route('**/api/v1/wallets/topups/wtop-test', route => route.fulfill({ json: { data: { status: completed ? 'completed' : 'pending' } } }))
  await page.goto('/wallet?reference=wtop-test')
  await expect(page.getByText(/Payment is awaiting confirmation/)).toBeVisible()
  await expect(page.getByText('Your wallet has been funded.')).toHaveCount(0)
  completed = true
  await expect(page.getByText('Your wallet has been funded.')).toBeVisible({ timeout: 10000 })
})

test('top-up initialization failure is visible and does not change the wallet', async ({ page }) => {
  await page.route('**/api/v1/wallets/topups', route => route.fulfill({ status: 503, json: { message: 'Wallet top-ups are not configured' } }))
  await page.goto('/wallet')
  await page.getByLabel('Top-up amount (GHS)').fill('100')
  await page.getByRole('button', { name: 'Fund wallet' }).click()
  await expect(page.getByText('Wallet top-ups are not configured')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fund wallet' })).toBeEnabled()
})
