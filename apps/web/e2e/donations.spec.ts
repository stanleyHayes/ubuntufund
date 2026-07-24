import { test, expect } from './fixtures'

test.describe('Donations', () => {
  test('user can fund a wallet and donate to an active campaign', async ({
    authenticatedPage: page,
  }) => {
    // An active campaign must exist (seeded locally / by CI's seed script).
    const list = await page
      .request.get('/api/v1/campaigns?page=1&pageSize=50')
      .then((r) => r.json())
    const active = list.data.items.find(
      (c: { status: string; currency: string }) => c.status === 'active' && c.currency === 'GHS'
    )
    test.skip(!active, 'no active GHS campaign available to donate to')

    // Fund the freshly registered user's wallet through the API.
    const tokens = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('uf_tokens') ?? '{}')
    )
    const auth = { Authorization: `Bearer ${tokens.accessToken}` }
    const wallets = await page.request
      .get('/api/v1/wallets', { headers: auth })
      .then((r) => r.json())
    const wallet = wallets.data[0]
    const deposit = await page.request.post(`/api/v1/wallets/${wallet.id}/deposit`, {
      headers: auth,
      data: { amount: 500, currency: 'GHS' },
    })
    expect(deposit.status()).toBe(200)

    // Donate through the real UI.
    await page.goto(`/campaigns/${active.id}`)
    await page.getByRole('button', { name: 'Donate Now' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/^Amount/).fill('50')
    await dialog.getByText(/wallet/i).first().click()
    await dialog.getByRole('button', { name: 'Confirm Donation' }).click()

    await expect(page.getByText('Donation submitted successfully!')).toBeVisible()
  })
})
