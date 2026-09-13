import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Test', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/kyc/status', route => route.fulfill({ json: { data: { verifications: [] } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  let uploads = 0
  await page.route('**/api/v1/uploads/image?folder=kyc', route => route.fulfill({ json: { data: { url: `kyc://${String(++uploads).padStart(24, '0')}` } } }))
  await page.route('**/api/v1/kyc/identity', route => route.fulfill({ status: 201, json: { data: { id: 'identity-fixture', status: 'pending' } } }))
})

async function reachAddressStep(page: Page) {
  await page.goto('/kyc')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Enter your full name and ID number.', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Full Name (as on ID)' }).fill('Synthetic applicant')
  await page.getByRole('textbox', { name: 'ID Number' }).fill('SYNTHETIC-ID')
  for (const [name, value] of [['Day', '01'], ['Month', '01'], ['Year', '1990']]) await page.getByRole('spinbutton', { name, exact: true }).fill(value)
  await page.getByRole('combobox', { name: 'Nationality' }).fill('Ghana')
  await page.getByRole('option', { name: 'Ghana', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Upload the front and back of your ID.', { exact: true })).toBeVisible()
  for (let index = 0; index < 2; index++) {
    await page.locator('input[type=file]').nth(index).setInputFiles({ name: 'synthetic-id.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nsynthetic private evidence fixture') })
    await expect(page.getByRole('button', { name: 'Preview private document', exact: true })).toHaveCount(index + 1)
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click()
}

test('address choices validate, reset dependent locations and submit GPS without an address-proof upload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await reachAddressStep(page)
  await page.getByRole('combobox', { name: 'Region' }).fill('Greater Accra')
  await page.getByRole('option', { name: /Greater Accra/ }).click()
  await page.getByRole('combobox', { name: 'City / Town' }).fill('Accra')
  await page.getByRole('option', { name: 'Accra', exact: true }).click()
  await page.getByRole('button', { name: 'Upload document', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Enter your street address and upload proof of address.')).toBeVisible()
  await page.getByRole('button', { name: 'GhanaPost GPS', exact: true }).click()
  await page.getByRole('textbox', { name: /GhanaPost GPS address/ }).fill('bad')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Enter a GhanaPost GPS address, for example GA-183-8164.')).toBeVisible()
  await page.getByRole('textbox', { name: /GhanaPost GPS address/ }).fill('ga-183-8164')
  await page.screenshot({ path: '/tmp/ubuntu-kyc-address-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Submit Verification' }).click()
  await expect(page.getByText('Upload a clear selfie holding your ID.', { exact: true })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-selfie.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') })
  await expect(page.getByRole('button', { name: 'Preview private document', exact: true })).toHaveCount(1)
  const request = page.waitForRequest('**/kyc/identity')
  await page.getByRole('button', { name: 'Submit Verification' }).click()
  const body = (await request).postDataJSON()
  expect(body.personalInfo.address).toMatchObject({ country: 'Ghana', city: 'Accra', gpsAddress: 'GA-183-8164', proofMethod: 'ghana_post_gps' })
  expect(body.documents).toEqual([{ type: 'id_card', url: 'kyc://000000000000000000000001' }, { type: 'id_card', url: 'kyc://000000000000000000000002' }, { type: 'selfie', url: 'kyc://000000000000000000000003' }])
  await expect(page.getByText('Verification Submitted!')).toBeVisible()
})

test('changing country clears region, city and the Ghana-only proof method', async ({ page }) => {
  await reachAddressStep(page)
  await page.getByRole('combobox', { name: 'Region' }).fill('Greater Accra')
  await page.getByRole('option', { name: /Greater Accra/ }).click()
  await page.getByRole('combobox', { name: 'City / Town' }).fill('Unlisted town')
  await page.getByRole('combobox', { name: 'Country', exact: true }).fill('Canada')
  await page.getByRole('option', { name: 'Canada', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'State / Province' })).toHaveValue('')
  await expect(page.getByRole('combobox', { name: 'City / Town' })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'GhanaPost GPS', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Street Address')).toBeVisible()
})

test('dashboard quick actions navigate to real destinations', async ({ page }) => {
  for (const [label, path] of [['New Campaign', '/campaigns/new'], ['Invite Friends', '/affiliate'], ['My Donations', '/donations']]) {
    await page.goto('/dashboard')
    await page.getByText('Quick Actions', { exact: true }).locator('..').getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }
})
