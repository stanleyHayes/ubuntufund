import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('mobile bottom tabs navigate and keep campaign creation in the center', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link')).toHaveCount(5)
    await expect(nav.getByRole('link').nth(2)).toHaveAccessibleName('Start a campaign')
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: 'Explore', exact: true }).click()
    await expect(page).toHaveURL(/\/explore$/)
    await expect(nav.getByRole('link', { name: 'Explore', exact: true })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: 'Start a campaign' }).click()
    await expect(page).toHaveURL(/\/campaigns\/new$/)
    await expect(nav.getByRole('link', { name: 'Start a campaign' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: 'Explore', exact: true })).not.toHaveAttribute('aria-current', 'page')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const bounds = await nav.boundingBox()
    expect(bounds!.y + bounds!.height).toBe(832)
    expect(bounds!.x).toBe(12)
    expect(bounds!.width).toBe(366)
    const footerBounds = await page.getByRole('contentinfo').boundingBox()
    expect(Math.abs(footerBounds!.y + footerBounds!.height - 844)).toBeLessThan(1)
    const footerTextBounds = await page.getByText('Made with Ujima, across Ghana.').boundingBox()
    expect(footerTextBounds!.y + footerTextBounds!.height).toBeLessThan(bounds!.y)
    await page.setViewportSize({ width: 320, height: 568 })
    await expect(nav).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(nav).toBeHidden()
  })

  test('all main pages load', async ({ page }) => {
    const pages = ['/', '/campaigns', '/about', '/login', '/register']
    for (const url of pages) {
      await page.goto(url)
      await expect(page).toHaveTitle(/Ujimora/)
    }
  })
})
