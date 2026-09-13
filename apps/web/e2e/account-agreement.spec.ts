import { test, expect } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`agreement is readable and keeps consent explicit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(() => {
      localStorage.setItem('uf_user', JSON.stringify({ id: 'agreement-fixture', name: 'Test Member', role: 'user' }))
      localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test-token', refreshToken: 'test-refresh' }))
    })
    await page.route('**/api/v1/**', route => route.fulfill({ json: { data: {} } }))
    let requestBody: unknown
    await page.route('**/api/v1/profile/legal-acceptance', async route => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({ json: { data: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date().toISOString() } } })
    })
    await page.goto('/account-agreement')
    await expect(page.getByRole('heading', { name: 'Your account agreement', exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Account policies' }).getByRole('link')).toHaveCount(4)
    const save = page.getByRole('button', { name: 'Save agreement', exact: true })
    await expect(save).toBeDisabled()
    await expect(page.getByRole('checkbox').first()).not.toBeChecked()
    await page.screenshot({ path: `/tmp/ujimora-agreement-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('checkbox').first().check()
    await expect(save).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('checkbox').nth(1).check()
    await save.click()
    await expect(page.getByText('Your agreement has been saved.', { exact: true })).toBeVisible()
    expect(requestBody).toEqual({ version: '2026-09-12', acceptedTerms: true, ageConfirmed: true })
  })
}
