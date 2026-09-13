import { expect, test } from '@playwright/test'

for (const path of ['/c/privacy-campaign', '/c/privacy-campaign/donate']) {
  test(`removes blocked campaign content and metadata on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    let blocked = false
    await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
    await page.route('**/api/v1/campaigns/slug/privacy-campaign/public', route => blocked
      ? route.fulfill({ status: 404, json: { message: 'Campaign not found' } })
      : route.fulfill({ json: { data: { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', slug: 'privacy-campaign', title: 'Previously published campaign', description: 'This campaign story must disappear when access is withdrawn.', creatorId: 'aaaaaaaaaaaaaaaaaaaaaaaa', status: 'active', currency: 'GHS', goalAmount: 1000, raisedAmount: 100, category: 'education', priority: 'normal', imageUrls: [], beneficiaries: [], startDate: '2026-09-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z', socialPreview: { title: 'Previously published campaign', summary: 'Campaign story', canonicalUrl: 'https://app.ujimora.com/c/privacy-campaign' } } } }))
    await page.goto(path)
    await expect(page.getByText('Previously published campaign', { exact: true })).toBeVisible()
    blocked = true
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByText('Previously published campaign', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Explore campaigns', exact: true })).toBeVisible()
    await expect(page).not.toHaveTitle(/Previously published campaign/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    expect(errors).toEqual([])
    await page.screenshot({ path: path.endsWith('/donate') ? '/tmp/ujimora-private-campaign-checkout.png' : '/tmp/ujimora-private-campaign-share.png', animations: 'disabled' })
  })
}
