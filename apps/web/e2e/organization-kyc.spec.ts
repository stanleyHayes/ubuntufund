import { test, expect } from '@playwright/test'

for (const viewport of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }]) {
test(`organization ${viewport.name} intake preserves a failed application and submits private evidence`, async ({ page }) => {
  await page.setViewportSize(viewport)
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Organization fixture', role: 'organization', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('503')) errors.push(message.text()) })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/kyc/status', route => route.fulfill({ json: { data: { verifications: [] } } }))
  let uploads = 0
  await page.route('**/api/v1/uploads/image?folder=kyc', route => route.fulfill({ json: { data: { url: `kyc://${String(++uploads).padStart(24, '0')}` } } }))
  const submissions: Array<Record<string, unknown>> = []
  await page.route('**/api/v1/kyc/business', route => {
    submissions.push(route.request().postDataJSON())
    return submissions.length === 1 ? route.fulfill({ status: 503, json: { message: 'Review service unavailable. Please retry.' } }) : route.fulfill({ status: 201, json: { data: { id: 'business-fixture', status: 'pending' } } })
  })
  await page.goto('/kyc')
  await expect(page.getByRole('heading', { name: 'Organization verification', exact: true })).toBeVisible()
  for (const [label, value] of Object.entries({ 'Legal organization name': 'Synthetic charity', 'Registration number': 'REG-SYNTHETIC', 'Organization legal type': 'Charity', 'Registered street address': 'Synthetic street', 'Registered city': 'Accra', 'Representative full name': 'Synthetic representative', 'Representative ID number': 'SYNTHETIC-ID', 'Role and authority to act': 'Authorized director', 'Person 1 full name': 'Synthetic controller', 'Explain ownership and control': 'The declared directors control this organization.' })) await page.getByRole('textbox', { name: label, exact: true }).fill(value)
  await page.getByRole('spinbutton', { name: 'Day', exact: true }).fill('01')
  await page.getByRole('spinbutton', { name: 'Month', exact: true }).fill('01')
  await page.getByRole('spinbutton', { name: 'Year', exact: true }).fill('1990')
  await page.getByRole('button', { name: 'Add controlling person' }).click()
  await page.getByRole('textbox', { name: 'Person 2 full name', exact: true }).fill('Second controller')
  await page.getByRole('button', { name: 'Remove person 2' }).click()
  for (let index = 0; index < 3; index++) {
    await page.locator('input[type=file]').nth(index).setInputFiles({ name: 'synthetic-evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nsynthetic private evidence fixture') })
    await expect(page.getByRole('button', { name: 'Preview private document', exact: true })).toHaveCount(index + 1)
  }
  const submit = page.getByRole('button', { name: 'Submit organization verification', exact: true })
  await expect(submit).toBeDisabled()
  await page.getByRole('checkbox', { name: /I am authorized/ }).check()
  await page.getByRole('checkbox', { name: /accurate and complete/ }).check()
  await submit.click()
  await expect(page.getByText('Review service unavailable. Please retry.', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Legal organization name', exact: true })).toHaveValue('Synthetic charity')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `/tmp/ujimora-organization-kyc-${viewport.name}.png`, fullPage: true })
  await page.screenshot({ path: `/tmp/ujimora-organization-kyc-retry-${viewport.name}.png` })
  await submit.click()
  await expect(page.getByText(/Organization verification submitted for review/)).toBeVisible()
  expect(submissions[1]).toEqual(submissions[0])
  expect(submissions[1].documents).toEqual([{ type: 'business_registration', url: 'kyc://000000000000000000000001' }, { type: 'authorization_letter', url: 'kyc://000000000000000000000002' }, { type: 'id_card', url: 'kyc://000000000000000000000003' }])
  expect(errors).toEqual([])
})

}
