import { test, expect } from '@playwright/test'

test('retains identity edits and requires separate approval before making the profile public', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Account user', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [] } } }))
  await page.route('**/api/v1/profile/activity-alerts', route => route.fulfill({ json: { data: { preferences: Object.fromEntries(['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'].map(category => [category, { inApp: false, email: false }])), emailVerified: false, emailConfigured: false } } }))
  await page.route('**/api/v1/newsletter/preference', route => route.fulfill({ json: { data: { status: 'off' } } }))
  let stored = { name: 'Current account name', phone: '0551234567', bio: 'Private biography', country: '', avatarUrl: '', coverUrl: '', publicProfile: false, language: 'English' }
  let approved = false
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/profile', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: stored } })
    const body = route.request().postDataJSON()
    writes.push(body)
    if (!approved) return route.fulfill({ status: 409, json: { message: 'Saved privately for safety review. Your content has not been published.' } })
    stored = { ...stored, ...body }
    return route.fulfill({ json: { data: stored } })
  })
  await page.route('**/api/v1/publication-reviews?*', route => route.fulfill({ json: { data: { total: 1, items: [{ id: 'account-review', action: 'account.profile', text: JSON.stringify({ name: 'Reviewed account name', publicProfile: stored.name === 'Reviewed account name' }), status: approved ? 'approved' : 'pending', ...(approved ? { reviewNotes: 'Complete public account identity reviewed.', approvalExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() } : {}) }] } } }))
  await page.goto('/profile')
  const name = page.getByLabel('Full Name', { exact: true })
  await expect(name).toHaveValue('Current account name')
  await name.fill('Reviewed account name')
  await expect(page.getByRole('checkbox', { name: /Use OpenAI/ })).not.toBeChecked()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByText(/Saved privately for safety review/)).toBeVisible()
  // Being held for review is expected, not a failure: an info status notice, never a red alert.
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for safety review' })).toHaveClass(/MuiAlert-colorInfo/)
  await expect(name).toHaveValue('Reviewed account name')
  await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('Private biography')
  expect(stored.name).toBe('Current account name')
  expect(writes[0].automatedReviewConsent).toBe(false)
  approved = true
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByRole('list', { name: 'Review status: Approved' })).toBeVisible()
  await expect(page.getByText("Reviewer's note: Complete public account identity reviewed.")).toBeVisible()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect.poll(() => stored.name).toBe('Reviewed account name')
  expect(writes[1]).toEqual(writes[0])
  approved = false
  await page.goto('/settings')
  const visibility = page.getByRole('switch', { name: 'Allow profile to be public', exact: true })
  await expect(visibility).not.toBeChecked()
  // Going public is held for review, so the switch must stay off: click, don't check().
  await visibility.click()
  await expect(page.getByText(/Check Publication reviews above/)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for safety review' })).toHaveClass(/MuiAlert-colorInfo/)
  await expect(visibility).not.toBeChecked()
  expect(stored.publicProfile).toBe(false)
  expect(writes[2]).toEqual({ publicProfile: true, automatedReviewConsent: false })
  approved = true
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByText("Reviewer's note: Complete public account identity reviewed.")).toBeVisible()
  await visibility.check()
  await expect(page.getByText('Settings saved', { exact: true })).toBeVisible()
  expect(writes[3]).toEqual(writes[2])
  expect(stored.publicProfile).toBe(true)
  await page.screenshot({ path: '/tmp/ujimora-account-publication-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

test('publishes held identity edits once approved, saves the rest at once, and withdraws a waiting version at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Account user', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  let stored = { name: 'Current account name', phone: '0551234567', bio: 'Private biography', country: '', avatarUrl: '', coverUrl: '', publicProfile: false, language: 'English' }
  const writes: Record<string, unknown>[] = []
  type Review = Record<string, unknown> & { id: string }
  let review: Review | null = null
  const withdrawals: string[] = []
  await page.route('**/api/v1/profile', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: stored } })
    const body = route.request().postDataJSON()
    writes.push(body)
    // The private settings are saved now; the new name waits for review, and its approval publishes it.
    stored = { ...stored, phone: body.phone, bio: body.bio }
    review = { id: `account-review-${writes.length}`, action: 'account.profile', text: JSON.stringify({ name: body.name, publicProfile: false }), mediaUrls: [], status: 'pending', createdAt: new Date().toISOString(), publishOnApproval: true, canWithdraw: true }
    return route.fulfill({ status: 409, json: { message: 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.', errors: { publication: ['held', 'publishes_on_approval'], saved: ['private'] } } })
  })
  await page.route('**/api/v1/publication-reviews?*', route => route.fulfill({ json: { data: { total: review ? 1 : 0, items: review ? [review] : [] } } }))
  await page.route('**/api/v1/publication-reviews/*/withdraw', route => {
    withdrawals.push(new URL(route.request().url()).pathname)
    review = { ...review!, status: 'withdrawn', publication: { state: 'withdrawn', reason: 'withdrawn_by_author', at: new Date().toISOString() }, canWithdraw: false }
    return route.fulfill({ json: { data: { withdrawn: true } } })
  })
  await page.goto('/profile')
  const name = page.getByLabel('Full Name', { exact: true })
  await expect(name).toHaveValue('Current account name')
  await name.fill('Reviewed account name')
  await page.getByLabel('Bio', { exact: true }).fill('A new private biography')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  const notice = page.getByRole('status').filter({ hasText: 'Waiting for safety review' })
  await expect(notice).toContainText("Your other changes are saved. Saved privately for safety review. It isn't public yet. Once a reviewer approves it, it's published automatically, so you don't need to submit it again. Check Publication reviews below for the decision; you can withdraw it there.")
  expect(stored).toMatchObject({ name: 'Current account name', bio: 'A new private biography' })
  await expect(page.getByRole('list', { name: 'Review status: In review' }).getByRole('listitem')).toHaveCount(4)

  // Taken back before anyone decides.
  await page.getByRole('button', { name: 'Withdraw Profile · Reviewed account name' }).click()
  const dialog = page.getByRole('dialog', { name: 'Withdraw this version?' })
  await expect(dialog).toContainText("It won't be published. You can submit it again later for a new review.")
  await dialog.getByRole('button', { name: 'Withdraw', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('list', { name: 'Review status: Withdrawn' })).toBeVisible()
  await expect(page.getByText("You withdrew it. It won't be published.")).toBeVisible()
  expect(withdrawals).toEqual(['/api/v1/publication-reviews/account-review-1/withdraw'])

  // Submitted again, then approved: published without saving it a third time.
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Review status: In review' })).toBeVisible()
  await expect(notice).toContainText('you can withdraw it there')
  review = { ...review!, status: 'approved', reviewNotes: 'Complete public account identity reviewed.', approvalExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), publication: { state: 'published', at: new Date().toISOString() }, canWithdraw: false }
  stored = { ...stored, name: 'Reviewed account name' }
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByRole('list', { name: 'Review status: Published' })).toBeVisible()
  await expect(page.getByText('Approved and now on your public profile.')).toBeVisible()
  await expect(page.getByText("Held changes stay private until they're approved.")).toBeVisible()
  expect(writes).toHaveLength(2)
  await page.screenshot({ path: '/tmp/ujimora-account-publication-published-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})
