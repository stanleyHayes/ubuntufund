import { test, expect } from '@playwright/test'

const organization = {
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Public visibility fixture', slug: 'public-visibility-fixture',
  description: 'A community organization for this local visibility check.', logoUrl: '', coverUrl: '',
  country: 'Ghana', city: 'Accra', verified: false, founded: 2026,
  impactStatement: 'Supporting our community.', campaignCount: 0, totalRaised: 0,
  currency: 'GHS', followerCount: 0, categories: [],
}

test('removes an organization and its SEO identity when focus refresh is denied', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  let hidden = false
  await page.route('**/api/v1/organizations/public-visibility-fixture', route => hidden
    ? route.fulfill({ status: 404, json: { message: 'Organization not found' } })
    : route.fulfill({ json: { data: organization } }))
  await page.goto('/organizations/public-visibility-fixture')
  await expect(page.getByRole('heading', { name: organization.name, exact: true })).toBeVisible()
  await expect(page).toHaveTitle(/Public visibility fixture/)
  hidden = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: organization.name, exact: true })).toHaveCount(0)
  await expect(page).not.toHaveTitle(/Public visibility fixture/)
  const metadata = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(metadata.join('')).not.toContain(organization.name)
  await page.screenshot({ path: '/tmp/ujimora-organization-hidden-phone.png', animations: 'disabled' })
})

test('removes newly hidden organizations from an already open directory', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  let hidden = false
  await page.route('**/api/v1/organizations', route => route.fulfill({ json: { data: hidden ? [] : [organization] } }))
  await page.goto('/organizations')
  await expect(page.getByText(organization.name, { exact: true })).toBeVisible()
  hidden = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText(organization.name, { exact: true })).toHaveCount(0)
  await expect(page.getByText('No organizations found', { exact: true })).toBeVisible()
})
