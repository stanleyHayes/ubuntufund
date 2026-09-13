import { test, expect } from '@playwright/test'
test('applicant can answer a saved verification request on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'applicant', name: 'Applicant', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  let answered = false
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    if (path.endsWith('/kyc/status')) data = { kycStatus: 'pending', kycLevel: 0, verifications: [{ id: 'verification-1', type: 'identity', status: answered ? 'pending' : 'in_review', informationRequests: [{ id: 'request-1', prompt: 'Please clarify the address on your identity document.', requestedAt: '2026-09-13T00:00:00Z', ...(answered ? { response: 'The address on my document is current.', respondedAt: '2026-09-13T01:00:00Z' } : {}) }] }] }
    if (path.endsWith('/respond-info')) {
      expect(route.request().postDataJSON()).toEqual({ requestId: 'request-1', response: 'The address on my document is current.', documents: [] })
      answered = true; data = { status: 'pending' }
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/kyc')
  await page.getByLabel('Your response').fill('The address on my document is current.')
  await page.getByRole('button', { name: 'Submit response', exact: true }).click()
  await expect(page.getByText('Status: pending', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Your response')).toHaveCount(0)
  await page.screenshot({ path: '/tmp/ujimora-kyc-information-response-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
