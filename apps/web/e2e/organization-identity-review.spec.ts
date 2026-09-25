import { test, expect } from '@playwright/test'

test('holds organization identity changes and resubmits the same approved version at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Team administrator', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const org = 'bbbbbbbbbbbbbbbbbbbbbbbb', other = 'cccccccccccccccccccccccc'
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'test', refreshToken: 'test' } : [] } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  let name = 'Original foundation', website = 'https://original.example.test', approved = false
  const submissions: unknown[] = []
  await page.route('**/api/v1/organization-team/mine', route => route.fulfill({ json: { data: [{ organizationId: org, name, role: 'admin', status: 'active' }, { organizationId: other, name: 'Other foundation', role: 'admin', status: 'active' }] } }))
  await page.route(`**/api/v1/organization-team/${org}`, route => route.fulfill({ json: { data: { organizationId: org, name, website, role: 'admin', members: [], campaigns: [] } } }))
  await page.route(`**/api/v1/organization-team/${other}`, route => route.fulfill({ json: { data: { organizationId: other, name: 'Other foundation', website: '', role: 'admin', members: [], campaigns: [] } } }))
  await page.route(`**/api/v1/organization-team/${org}/profile`, route => {
    const input = route.request().postDataJSON()
    submissions.push(input)
    if (!approved) return route.fulfill({ status: 409, json: { message: 'Saved privately for safety review. Your content has not been published.' } })
    name = input.organizationName; website = input.website
    return route.fulfill({ json: { data: { updated: true } } })
  })
  await page.route('**/api/v1/publication-reviews?*', route => route.fulfill({ json: { data: { total: 1, items: [{ id: 'org-review', action: 'organization.profile', status: approved ? 'approved' : 'pending', text: JSON.stringify({ organizationName: 'Reviewed foundation', website: 'https://reviewed.example.test' }), ...(approved ? { reviewNotes: 'Organization name and website reviewed.' } : {}) }] } } }))
  await page.goto('/organization-team')
  await expect(page.getByLabel('Organization name')).toHaveValue('Original foundation')
  await page.getByLabel('Organization name').fill('Reviewed foundation')
  await page.getByLabel('Website', { exact: true }).fill('https://reviewed.example.test')
  await expect(page.getByRole('checkbox', { name: /Use OpenAI/ })).not.toBeChecked()
  await page.getByRole('button', { name: 'Save organization details' }).click()
  await expect(page.getByText(/Saved privately for safety review/)).toBeVisible()
  // Being held for review is expected, not a failure: an info status notice, never a red alert.
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for safety review' })).toHaveClass(/MuiAlert-colorInfo/)
  await expect(page.getByLabel('Organization name')).toHaveValue('Reviewed foundation')
  expect(name).toBe('Original foundation')
  expect(submissions[0]).toEqual({ organizationName: 'Reviewed foundation', website: 'https://reviewed.example.test', automatedReviewConsent: false })
  approved = true
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByText('Review response: Organization name and website reviewed.')).toBeVisible()
  await page.screenshot({ path: '/tmp/ujimora-org-identity-review-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Save organization details' }).click()
  await expect(page.getByText('Organization profile updated.')).toBeVisible()
  expect(submissions[1]).toEqual(submissions[0])
  await page.getByRole('checkbox', { name: /Use OpenAI/ }).check()
  await page.getByRole('combobox', { name: 'Workspace' }).click()
  await page.getByRole('option', { name: 'Other foundation' }).click()
  await expect(page.getByLabel('Organization name')).toHaveValue('Other foundation')
  await expect(page.getByRole('checkbox', { name: /Use OpenAI/ })).not.toBeChecked()
  expect(errors).toEqual([])
})
