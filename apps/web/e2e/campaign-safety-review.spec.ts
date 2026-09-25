import { test, expect } from '@playwright/test'
test('keeps a campaign draft through private safety review and resubmits the exact version', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'test', name: 'Organizer', role: 'user' }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  let approved = false
  const submissions: Record<string, unknown>[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    if (path.endsWith('/creation-options')) data = { plan: { name: 'Pro', campaignCollaboration: true, maxCollaboratorsPerCampaign: 2 }, maxGoal: 1000, canCreate: true, canSplit: false, splitEnabled: false }
    if (path.endsWith('/publication-reviews')) data = { total: 1, items: [{ id: 'review-fixture', action: 'campaign.create', status: approved ? 'approved' : 'pending', text: JSON.stringify(Object.fromEntries(Object.entries(submissions[0] ?? {}).filter(([key]) => !['summary', 'automatedReviewConsent', 'imageUrls'].includes(key)))), reviewNotes: approved ? 'Complete campaign version reviewed.' : undefined }] }
    if (path.endsWith('/campaigns') && route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON())
      if (!approved) return route.fulfill({ status: 409, json: { message: 'Saved privately for safety review. Your content has not been published.' } })
      data = { id: 'created', status: 'pending_review' }
    }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/campaigns/new')
  await page.getByLabel('Campaign title').fill('Test campaign')
  await page.getByRole('button', { name: 'Education', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Your story').fill('Test campaign story for a new library.')
  await page.getByLabel('Who will this help?').fill('Community')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Goal amount').fill('1001')
  await page.getByLabel('Goal amount').blur()
  await expect(page.getByText(/Your current limit is/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await page.getByLabel('Goal amount').fill('1000')
  await page.getByRole('button', { name: 'Choose date', exact: true }).click()
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  // MUI retains the outgoing calendar during its slide animation.
  await expect(page.getByRole('gridcell', { name: '15', exact: true })).toHaveCount(1)
  await page.getByRole('gridcell', { name: '15', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByLabel('Invite collaborators by email (optional)')).toBeVisible()
  expect(submissions).toHaveLength(0)
  const consent = page.getByRole('checkbox', { name: /Use OpenAI to check/ })
  await expect(consent).not.toBeChecked()
  await page.getByRole('button', { name: 'Publish campaign', exact: true }).click()
  await expect(page.getByText('campaign create · pending')).toBeVisible()
  await expect(page.getByText(/Saved privately for safety review/)).toBeVisible()
  expect(submissions[0].automatedReviewConsent).toBe(false)
  await consent.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-campaign-safety-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  approved = true
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByText('campaign create · approved')).toBeVisible()
  await page.getByRole('button', { name: 'Publish campaign', exact: true }).click()
  await expect(page.getByText('Campaign submitted', { exact: true })).toBeVisible()
  expect(submissions).toHaveLength(2)
  expect(submissions[1]).toEqual(submissions[0])
  expect(errors).toEqual([])
})
