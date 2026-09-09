import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'test', name: 'Ama', role: 'user' }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'test', refreshToken: 'test' } : [] } }))
})

test('Free accounts see the upgrade action and cannot enable a creator page', async ({ page }) => {
  await page.route('**/api/v1/creators/me', route => route.fulfill({ json: { data: { profile: null, balance: null, policy: { eligible: false, planName: 'Community', feePercent: 3.5 } } } }))
  await page.goto('/creator')
  await expect(page.getByText(/Creator donations require an active paid plan/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'View plans' })).toHaveAttribute('href', '/subscription')
  await expect(page.getByRole('button', { name: 'Create my page' })).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Accept tips' })).toBeDisabled()
})

test('paid creators review the fee and net amount and submit the quoted rate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/creators/me', route => route.fulfill({ json: { data: {
    profile: { handle: 'ama', displayName: 'Ama', tipsEnabled: true, presetAmounts: [10, 25, 50], currency: 'GHS' },
    balance: { availableBalance: 100, totalReceived: 100, paidOutBalance: 0, currency: 'GHS' },
    policy: { eligible: true, planName: 'Plus', feePercent: 3 },
  } } }))
  let submitted: unknown
  await page.route('**/api/v1/creators/withdraw', route => {
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: { data: { status: 'PROCESSING', amount: 100, fee: 3, netAmount: 97 } } })
  })
  await page.goto('/creator')
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/Fee: GH₵3.00 · You receive: GH₵97.00/)).toBeVisible()
  await dialog.getByLabel('Phone number').fill('0551234567')
  await dialog.getByLabel('Network code (e.g. MTN)').fill('MTN')
  await dialog.getByLabel('Account name').fill('Ama')
  await dialog.getByRole('button', { name: 'Withdraw', exact: true }).click()
  await expect(page.getByText('Withdrawal started')).toBeVisible()
  expect(submitted).toEqual({ amount: 100, expectedFeePercent: 3, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'Ama' } })
})
