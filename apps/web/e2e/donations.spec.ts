import { test, expect } from './fixtures'

test.describe('Donations', () => {
  test('an unfunded user cannot mint balance or complete a donation', async ({
    authenticatedPage: page,
  }) => {
    // An active campaign must exist (seeded locally / by CI's seed script).
    const list = await page
      .request.get('/api/v1/campaigns?page=1&pageSize=50')
      .then((r) => r.json())
    const active = list.data.items.find(
      (c: { status: string; currency: string }) => c.status === 'active' && c.currency === 'GHS'
    )
    expect(active, 'The E2E seed must provide an active GHS campaign').toBeTruthy()

    // The public API deliberately exposes no balance-minting endpoint. An
    // unfunded launch account should receive the real insufficient-balance
    // response when attempting a wallet-backed contribution.
    await page.goto(`/campaigns/${active.id}`)
    await page.getByRole('button', { name: 'Donate with wallet', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/^Amount/).fill('50')
    await dialog.getByText(/wallet/i).first().click()
    await dialog.getByRole('button', { name: 'Confirm Donation' }).click()

    await expect(page.getByText(/insufficient wallet balance/i)).toBeVisible()
  })
})
