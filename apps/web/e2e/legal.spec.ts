import { test, expect } from '@playwright/test'
const policies = ['terms', 'privacy', 'organizer-agreement', 'contributor-terms', 'refund-policy', 'acceptable-use', 'cookies', 'billing-terms', 'delete-account']
test('every policy is public, readable and linked from the legal hub', async ({ page }) => {
  for (const slug of policies) {
    await page.goto(`/${slug}`)
    await expect(page.locator('article')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Need clarification?' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible()
    await expect(page.getByText('Unexpected Application Error!')).toHaveCount(0)
  }
  await page.goto('/legal')
  for (const slug of policies) await expect(page.locator(`main a[href="/${slug}"]`)).toHaveCount(1)
})
test('legal reading layout fits a narrow phone and section links work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/privacy')
  await page.getByRole('navigation', { name: 'On this page' }).locator('a').last().click()
  await expect(page).toHaveURL(/#section-/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto('/terms')
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/ujimora-legal-phone.png', fullPage: false })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/legal')
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/ujimora-legal-desktop.png', fullPage: false })
})
test('legal pages follow every saved appearance in light and dark', async ({ page }) => {
  for (const skin of ['neumorphism', 'claymorphism', 'glassmorphism', 'minimal']) {
    for (const mode of ['light', 'dark']) {
      await page.goto('/legal')
      await page.evaluate(({ skin, mode }) => { localStorage.setItem('uf_skin', skin); localStorage.setItem('uf_color_mode', mode) }, { skin, mode })
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-skin', skin)
      await expect(page.getByRole('heading', { name: 'Know where you stand.' })).toBeVisible()
      if (skin === 'claymorphism' && mode === 'dark') {
        await page.waitForTimeout(800)
        await page.screenshot({ path: '/tmp/ujimora-legal-dark-clay.png' })
      }
    }
  }
})

test('account deletion is accessible without signing in or reinstalling the app', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/delete-account')
  await expect(page.getByRole('heading', { name: 'Delete your Ujimora account', exact: true })).toBeVisible()
  const request = page.getByRole('link', { name: 'Request account and data deletion by email' })
  await expect(request).toHaveAttribute('href', /^mailto:legal@ujimora.com\?subject=/)
  await expect(page.getByRole('link', { name: 'Open account settings on the website' })).toHaveAttribute('href', 'https://app.ujimora.com/settings')
  await expect(page.getByText(/Account closure alone does not mean/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
