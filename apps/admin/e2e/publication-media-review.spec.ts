import { test, expect } from '@playwright/test'
const photo = 'https://res.cloudinary.com/ujimora/image/upload/v1/avatars/photo.jpg', cover = 'https://res.cloudinary.com/ujimora/image/upload/v1/covers/cover.jpg'
const svg = (width: number, height: number, fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`
const items = [
  { id: 'own', actorId: 'pubreview-admin', action: 'comment.create', text: 'A comment I wrote on a campaign.', mediaUrls: [], status: 'pending', reason: 'staff_requested' },
  { id: 'profile', actorId: 'creator-account', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama Mensah', bio: 'Supporting school feeding in Tamale.', avatarUrl: photo, coverUrl: cover }), mediaUrls: [photo, cover], status: 'pending', reason: 'staff_requested' },
  { id: 'external', actorId: 'community-member', action: 'comment.create', text: 'See the attached picture.', mediaUrls: ['https://media.example.test/uploads/very-long-file-name-for-an-external-attachment.jpg'], status: 'pending', reason: 'staff_requested' },
]
for (const width of [390, 1280]) test(`publication reviews preview media and flag own submissions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'pubreview-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.pubreview-admin', '1')
  })
  const errors: string[] = [], external: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().startsWith('https://media.example.test/')) external.push(request.url()) })
  await page.route('https://res.cloudinary.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: route.request().url().includes('cover') ? svg(1200, 400, '#2f6f5e') : svg(400, 400, '#c9772b') }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['reports:read', 'reports:update'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/publication-reviews')) data = { items, total: items.length }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/publication-reviews')
  await expect(page.getByAltText('Photo preview')).toHaveAttribute('src', photo)
  await expect(page.getByAltText('Cover preview')).toHaveAttribute('src', cover)
  await expect.poll(() => page.locator('img[alt$=" preview"]').evaluateAll(images => images.map(image => (image as HTMLImageElement).naturalWidth))).toEqual([400, 1200])
  await expect(page.getByText(/not hosted in Ujimora image storage/)).toBeVisible()
  await expect(page.getByText('You submitted this. Another administrator must review it.', { exact: true })).toHaveCount(1)
  const approve = page.getByRole('button', { name: 'Approve this version', exact: true })
  await page.getByLabel('Review notes (at least 20 characters)').nth(0).fill('Trying to review my own comment here.')
  await page.getByLabel('Review notes (at least 20 characters)').nth(1).fill('Reviewed the proposed photo and cover.')
  await expect(approve.nth(0)).toBeDisabled()
  await expect(approve.nth(1)).toBeEnabled()
  const columns = await page.locator('img[alt="Photo preview"]').evaluate(image => { let grid = image.parentElement; while (grid && getComputedStyle(grid).display !== 'grid') grid = grid.parentElement; return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0 })
  expect(columns).toBe(width < 600 ? 1 : 2)
  await page.screenshot({ path: `/tmp/ujimora-admin-pubreview-${width}.png`, fullPage: true, animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

// ─── Publishing on approval ──────────────────────────────────────────────────

const minute = 60000
/** Fresh for each test: a worker runs several tests from one module, minutes apart. */
function publishingFixtures() {
  const at = (minutes: number) => new Date(Date.now() + minutes * minute).toISOString()
  const waiting = [
    { id: '66f1c0de0a1b2c3d4e5f6401', actorId: 'community-member', action: 'comment.create', status: 'pending', reason: 'staff_requested', publishOnApproval: true, createdAt: at(-30), purgeAt: at(29 * 1440), mediaUrls: [],
      text: JSON.stringify({ authorName: 'Ama Mensah', comment: 'Thank you for the books. My daughter reads every evening now.' }) },
    { id: '66f1c0de0a1b2c3d4e5f6402', actorId: 'creator-account', action: 'thank_you.send', status: 'pending', reason: 'staff_requested', publishOnApproval: true, createdAt: at(-20), purgeAt: at(29 * 1440), mediaUrls: [],
      text: JSON.stringify({ subject: 'The water point is open', body: 'Dear donors,\n\nThe borehole in Kanvili now serves 300 families.', signature: 'Ama and the Tamale water team' }) },
    { id: '66f1c0de0a1b2c3d4e5f6403', actorId: 'creator-account', action: 'update.create', status: 'pending', reason: 'staff_requested', publishOnApproval: false, createdAt: at(-3000), purgeAt: at(27 * 1440), mediaUrls: [],
      text: JSON.stringify(['Week one', 'We delivered 40 tablets to three schools.', 'general']) },
  ]
  const decision = { status: 'approved', reviewedBy: 'admin', reviewer: { id: 'admin', name: 'Abena Owusu', automated: false }, reviewedAt: at(-90), approvalExpiresAt: at(6 * 1440), reviewNotes: 'Reviewed the complete text and the account.', reason: 'staff_requested', mediaUrls: [] }
  const decided = [
    { ...decision, id: '66f1c0de0a1b2c3d4e5f6501', actorId: 'community-member', action: 'comment.create', text: JSON.stringify({ authorName: 'Kofi', comment: 'Well done, team.' }), publishOnApproval: true, publication: { state: 'published', at: at(-89), via: 'approval', attempts: 1, resourceId: '66f1c0de0a1b2c3d4e5f6601' } },
    { ...decision, id: '66f1c0de0a1b2c3d4e5f6502', actorId: 'creator-account', action: 'update.create', text: JSON.stringify(['Week two', 'Solar chargers arrived.', 'milestone']), publishOnApproval: true, applyOptions: { isPinned: true }, publication: { state: 'queued', attempts: 2, nextAttemptAt: at(30) } },
    { ...decision, id: '66f1c0de0a1b2c3d4e5f6503', actorId: 'creator-account', action: 'creator.profile', baseVersion: '4', text: JSON.stringify({ handle: 'ama-reads', displayName: 'Ama Reads' }), publishOnApproval: true, publication: { state: 'not_published', reason: 'credentials_changed', at: at(-88), attempts: 1 } },
    { ...decision, id: '66f1c0de0a1b2c3d4e5f6504', actorId: 'creator-account', action: 'campaign.slug', text: 'tamale-water-2026', publishOnApproval: true, publication: { state: 'superseded', reason: 'newer_version_submitted', at: at(-60) }, supersededBy: '66f1c0de0a1b2c3d4e5f6505' },
    { ...decision, id: '66f1c0de0a1b2c3d4e5f6506', actorId: 'community-member', action: 'comment.create', text: JSON.stringify({ authorName: 'Esi', comment: 'An earlier comment.' }) },
  ]
  return { waiting, decided }
}

async function openPublishing(page: import('@playwright/test').Page, skin: string, mode: string) {
  const errors: string[] = [], decisions: string[] = []
  const { waiting, decided } = publishingFixtures()
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ skin, mode }) => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'pubreview-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.pubreview-admin', '1')
    localStorage.setItem('uf_admin_skin', skin)
    localStorage.setItem('uf_admin_color_mode', mode)
  }, { skin, mode })
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (route.request().method() === 'PUT' && path.endsWith('/review')) {
      const id = path.split('/').at(-2)!
      decisions.push(id)
      // The thank-you is for a campaign the reviewer manages: another administrator must decide it.
      if (id === waiting[1].id) return route.fulfill({ status: 403, json: { message: 'Another administrator must review content for a campaign or organization you manage', errors: { review: ['conflict'] } } })
      return route.fulfill({ json: { data: { reviewed: true, publishOnApproval: true, publication: { state: 'published', at: new Date().toISOString() } } } })
    }
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['reports:read', 'reports:update', 'audit_log:read'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/admin/publication-reviews')) {
      const items = url.searchParams.get('status') === 'approved' ? decided : waiting.filter(item => !decisions.includes(item.id) || item.id === waiting[1].id)
      data = { items, total: items.length, campaignReviewGoalGhs: 250000 }
    }
    return route.fulfill({ json: { data } })
  })
  return { errors, decisions, waiting, decided }
}

async function expectCleanPage(page: import('@playwright/test').Page, width: number) {
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/undefined|NaN|\[object Object\]|Invalid Date/)
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
}

for (const width of [390, 1280]) for (const skin of ['neumorphism', 'claymorphism', 'glassmorphism', 'minimal']) for (const mode of ['light', 'dark']) {
  test(`publishing on approval reads clearly at ${width}px in ${skin} ${mode}`, async ({ page }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 })
    const { errors, decisions, waiting, decided } = await openPublishing(page, skin, mode)
    await page.goto('/publication-reviews')
    await expect(page.getByText(/^Check every field and every image, then approve or decline this exact version\. Approving publishes it straight away/)).toBeVisible()
    const card = (heading: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: heading, exact: true, level: 2 }) })
    const comment = card('Campaign comment')
    await expect(comment.getByText(/^Approving posts this comment on the campaign now\. If the author changed it since submitting/)).toBeVisible()
    const thanks = card('Donor thank-you message')
    await expect(thanks.getByRole('note').filter({ hasText: /^Approving emails this message to the campaign’s eligible donors now\. It can’t be recalled/ })).toBeVisible()
    await expect(card('Week one').getByText(/^Submitted before automatic publishing: the update is posted only when the author submits it again by /)).toBeVisible()
    // Guidance is static: nothing is announced until a decision is refused.
    await expect(page.locator('main [role="alert"]')).toHaveCount(0)
    await expectCleanPage(page, width)
    if (skin === 'neumorphism' || skin === 'glassmorphism') await page.screenshot({ path: `/tmp/ujimora-pubreview-autopublish-pending-${width}-${skin}-${mode}.png`, fullPage: true, animations: 'disabled' })

    // A refusal stays on its card, named; the button labels never change.
    await thanks.getByLabel('Review notes (at least 20 characters)').fill('Checked the message and the donors list.')
    await thanks.getByRole('button', { name: 'Approve this version', exact: true }).click()
    const refused = thanks.getByRole('alert')
    await expect(refused).toContainText('Conflict of interest')
    await expect(refused).toContainText('Another administrator must review content for a campaign or organization you manage')
    await expect(refused).toBeFocused()
    await expectCleanPage(page, width)

    // An approval that publishes answers with the outcome.
    await comment.getByLabel('Review notes (at least 20 characters)').fill('Reviewed the complete comment text.')
    await comment.getByRole('button', { name: 'Approve this version', exact: true }).click()
    const confirmation = page.getByRole('status').filter({ hasText: 'Approved and published.' })
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toBeFocused()
    await expect(card('Campaign comment')).toHaveCount(0)
    expect(decisions).toEqual([waiting[1].id, waiting[0].id])

    // Approved versions say where they stand.
    await page.getByRole('combobox', { name: 'Review status' }).click()
    await page.getByRole('option', { name: 'Approved', exact: true }).click()
    const decidedCard = (id: string) => page.locator(`article[data-review-id="${id}"]`)
    await expect(decidedCard(decided[0].id).getByText(/^Published .+ · by approval$/)).toBeVisible()
    await expect(decidedCard(decided[1].id).getByText(/^Publishing… attempt 2, next try .+ \(in \d+ minutes\)$/)).toBeVisible()
    await expect(decidedCard(decided[2].id).getByText("Not published: the author's password or two-step verification changed after they submitted it")).toBeVisible()
    await expect(decidedCard(decided[3].id).getByText('Replaced by a newer version')).toBeVisible()
    await expect(decidedCard(decided[4].id).getByText('Not published by its approval: the author publishes it by submitting it again.')).toBeVisible()
    // Used or closed approvals show no expiry.
    for (const index of [0, 3]) await expect(decidedCard(decided[index].id).getByText(/^Approval valid until/)).toHaveCount(0)
    for (const index of [1, 2, 4]) await expect(decidedCard(decided[index].id).getByText(/^Approval valid until/)).toBeVisible()
    await expectCleanPage(page, width)
    await page.screenshot({ path: `/tmp/ujimora-pubreview-autopublish-decided-${width}-${skin}-${mode}.png`, fullPage: true, animations: 'disabled' })
    expect(errors).toEqual([])
  })
}
