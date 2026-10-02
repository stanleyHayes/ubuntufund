import { test, expect } from '@playwright/test'
test('saves a campaign that needs a person’s check as Pending review, with nothing to resubmit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'test', name: 'Organizer', role: 'user' }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const submissions: Record<string, unknown>[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    if (path.endsWith('/creation-options')) data = { plan: { name: 'Pro', campaignCollaboration: true, maxCollaboratorsPerCampaign: 2 }, maxGoal: 1000, canCreate: true, canSplit: false, splitEnabled: false }
    // The success screen offers payout setup straight away.
    if (path.endsWith('/payout-accounts')) data = { accounts: [] }
    if (path.endsWith('/payout-options')) data = { eligible: 0, currency: 'GHS', fees: { earlyMaxWithdrawalPercent: 80, earlyFeePercent: 1, earlyMinFee: 20 } }
    if (path.endsWith('/campaigns') && route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON())
      // Without screening consent the API creates it for a person to check first.
      return route.fulfill({ status: 201, json: { data: { id: 'created', status: 'pending_review', contentReviewReason: 'no_screening_consent' }, message: 'Campaign created successfully', status: 201 } })
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
  await expect(page.getByText(/saved as Pending review: a person on our team checks them/)).toBeVisible()
  await page.getByRole('button', { name: 'Publish campaign', exact: true }).click()
  // Saved as Pending review: a status, never a red alert or a "held" notice.
  await expect(page.getByText('Saved · Pending review', { exact: true })).toBeVisible()
  await expect(page.getByText(/You chose not to use automated screening/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to my campaigns' })).toHaveAttribute('href', '/my-campaigns')
  await expect(page.getByText(/Waiting for safety review|couldn.t publish/)).toHaveCount(0)
  expect(submissions).toHaveLength(1)
  expect(submissions[0].automatedReviewConsent).toBe(false)
  // Still the success screen once the payout section has loaded, not an error page.
  await expect(page.getByText('No payout requests yet')).toBeVisible()
  await expect(page.getByText(/We couldn.t open this page/)).toHaveCount(0)
  await expect(page.getByText('Saved · Pending review', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/ujimora-campaign-pending-review-phone.png', animations: 'disabled', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})
