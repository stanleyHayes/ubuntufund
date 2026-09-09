import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'test', name: 'Test', role: 'user' }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
})

test('address choices validate, reset dependent locations and submit GPS without an upload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/kyc')
  await page.getByRole('combobox', { name: 'Nationality' }).fill('Ghana')
  await page.getByRole('option', { name: 'Ghana', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
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
  const request = page.waitForRequest('**/kyc/identity')
  await page.getByRole('button', { name: 'Submit Verification' }).click()
  const body = (await request).postDataJSON()
  expect(body.personalInfo.address).toMatchObject({ country: 'Ghana', city: 'Accra', gpsAddress: 'GA-183-8164', proofMethod: 'ghana_post_gps' })
  expect(body.documents).toEqual([])
  await expect(page.getByText('Verification Submitted!')).toBeVisible()
})

test('changing country clears region, city and the Ghana-only proof method', async ({ page }) => {
  await page.goto('/kyc')
  await page.getByRole('combobox', { name: 'Nationality' }).fill('Ghana')
  await page.getByRole('option', { name: 'Ghana', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
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
