import { test, expect } from '@playwright/test'

test('creation respects caps, stops for review, and retries setup without duplicating the campaign', async ({ page }) => {
  let creates = 0
  let invites = 0
  let splits = 0
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'test', name: 'Test', role: 'user' }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/creation-options')) data = {
      plan: { name: 'Pro', campaignCollaboration: true, maxCollaboratorsPerCampaign: 2 },
      maxGoal: 1000, canCreate: true, canSplit: true, splitEnabled: true,
    }
    if (path.endsWith('/campaigns') && route.request().method() === 'POST') {
      creates++
      data = { id: 'created', status: 'active' }
    }
    if (path.endsWith('/invite')) {
      invites++
      if (invites === 1) return route.fulfill({ status: 503, json: { message: 'Temporary failure' } })
    }
    if (path.endsWith('/split')) { splits++; data = { version: 1, status: 'draft' } }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/campaigns/new')
  await page.getByLabel('Campaign title').fill('Test campaign')
  await page.getByLabel('Short summary').fill('Test description for a campaign')
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
  expect(creates).toBe(0)
  await page.getByLabel('Invite collaborators by email (optional)').fill('friend@example.com')
  await page.getByLabel('Set up split proceeds').check()
  for (const [label, value] of [['Name 1', 'Ama'], ['Email 1', 'ama@example.com'], ['Name 2', 'Kofi'], ['Email 2', 'kofi@example.com']]) {
    await page.getByLabel(label, { exact: true }).fill(value)
  }
  await page.getByRole('button', { name: 'Publish campaign', exact: true }).click()
  await page.getByRole('button', { name: 'Retry unfinished setup', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Retry unfinished setup', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Share Test campaign', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'WhatsApp', exact: true })).toBeVisible()
  expect({ creates, invites, splits }).toEqual({ creates: 1, invites: 2, splits: 1 })
})
