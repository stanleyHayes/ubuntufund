import { test, expect, type Locator, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Screenshots go to /tmp like the other specs, or to PUBREVIEW_SHOTS_DIR when set (one per run).
const shots = process.env.PUBREVIEW_SHOTS_DIR ?? '/tmp'
const day = 86400000
const now = Date.now()
const iso = (days: number) => new Date(now + days * day).toISOString()
const cover = 'https://res.cloudinary.com/ujimora/image/upload/v1/campaigns/neurodyne-cover.jpg'
const photo = 'https://res.cloudinary.com/ujimora/image/upload/v1/avatars/ama-reads.jpg'
const creatorCover = 'https://res.cloudinary.com/ujimora/image/upload/v1/covers/ama-reads.jpg'
const svg = (width: number, height: number, fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`

const title = 'Neurodyne assistive tablets for schools'
const story = [
  'Neurodyne Health builds low-cost assistive tablets for children with speech and motor disabilities in northern Ghana.',
  'Over the last two years we piloted 40 tablets in three schools in Tamale. Teachers report that children who could not answer in class now take part in lessons, and parents say their children talk to them through the tablets at home.',
  'This campaign will fund 400 more tablets, protective cases and solar chargers, plus two years of training for teachers and parents. Every tablet carries Dagbani, Twi and English voice packs recorded by local volunteers.',
  '<b>Important:</b> we will publish a full breakdown of costs at https://evil.test/claim and share receipts with every donor who asks.',
  'How the money will be used:\n- 400 tablets at GH₵1,600 each\n- 400 cases and solar chargers at GH₵450 each\n- Teacher and parent training across 12 schools\n- Repairs and replacement parts for two years',
  'We are a registered social enterprise and every purchase is approved by our board. If we raise more than our goal, the extra will fund tablets for a fourth district, chosen with the regional education office.',
  'Each school receives a visit every term. Our two field officers check every tablet, replace worn cases and record which lessons the children use most, so the next voice packs follow what teachers actually need.',
  'Families keep the tablets over the holidays. A child who used to point at pictures can now ask for water, greet a neighbour and tell a teacher when something hurts. That is the change we want for 400 more children.',
  'We will post an update every month with photos from the schools, the number of tablets delivered and what each district still needs.',
  'Thank you for reading, and for supporting children who deserve to be heard.',
].join('\n\n')
const authorId = '6abd48b1c2d3e4f5a6b7c8d9', creatorId = '6abd48b1c2d3e4f5a6b7c8e0', campaignId = '66f1c0de0a1b2c3d4e5f6071'
const author = { id: authorId, name: 'Kofi Mensah', email: 'kofi@example.test', accountType: 'user', verificationLevel: 2, emailVerified: true, closed: false }
const creator = { id: creatorId, name: 'Ama Owusu', email: 'ama@example.test', accountType: 'user', verificationLevel: 1, emailVerified: true, closed: false }
const water = { id: campaignId, title: 'Clean water for Tamale', slug: 'tamale-water', status: 'active', creatorId, deleted: false }
const publications = [
  { id: '66f1c0de0a1b2c3d4e5f6101', actorId: authorId, resourceId: authorId, action: 'campaign.create', author, status: 'pending', reason: 'media', createdAt: iso(-2), purgeAt: iso(28), mediaUrls: [cover],
    text: JSON.stringify({ title, description: story, category: 'business', priority: 'critical', beneficiaries: ['Neurodyne'], goalAmount: 1000000, currency: 'GHS', endDate: '2026-10-31T00:00:00.000Z' }) },
  { id: '66f1c0de0a1b2c3d4e5f6102', actorId: creatorId, resourceId: creatorId, action: 'creator.profile', baseVersion: 'new', author: creator, status: 'pending', reason: 'media', createdAt: iso(-1), purgeAt: iso(29), mediaUrls: [photo, creatorCover],
    text: JSON.stringify({ handle: 'ama-reads', displayName: 'Ama Reads', tagline: 'Books for every child in Tamale', bio: 'I run a reading club for 60 children.\nTips buy books and lamps.', avatarUrl: photo, coverUrl: creatorCover, tipsEnabled: true, presetAmounts: [10, 25, 50, 100], currency: 'GHS', thankYouMessage: 'Thank you! Every cedi becomes a book.' }) },
  { id: '66f1c0de0a1b2c3d4e5f6103', actorId: creatorId, resourceId: campaignId, action: 'thank_you.send', author: creator, campaign: water, status: 'pending', reason: 'staff_requested', createdAt: iso(-0.2), purgeAt: iso(29.8), mediaUrls: [],
    text: JSON.stringify({ subject: 'The water point is open', body: 'Dear donors,\n\nThe borehole in Kanvili now serves 300 families.\nThank you for making it happen.', signature: 'Ama and the Tamale water team' }) },
]
const donation = { id: '66f1c0de0a1b2c3d4e5f6201', version: 'a'.repeat(64), actorId: 'Guest', action: 'donation.public_content', status: 'pending', reason: 'staff_requested', createdAt: iso(-3), mediaUrls: [], ownerId: creatorId, recipient: { kind: 'campaign', id: campaignId, name: water.title },
  text: JSON.stringify({ donorName: 'Akosua', message: 'Keep going! My grandmother grew up in Kanvili and walked hours for water.' }) }

async function open(page: Page, skin: string, mode: string, items: unknown[] = publications) {
  const errors: string[] = [], hosts = new Set<string>()
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { const { host } = new URL(request.url()); if (host) hosts.add(host) })
  await page.addInitScript(({ skin, mode }) => {
    localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'pubreview-admin', name: 'Reviewer', role: 'admin' }))
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
    localStorage.setItem('uf_admin_token', 'test')
    localStorage.setItem('uf.admin.tourSeen.pubreview-admin', '1')
    localStorage.setItem('uf_admin_skin', skin)
    localStorage.setItem('uf_admin_color_mode', mode)
  }, { skin, mode })
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.route('https://res.cloudinary.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: route.request().url().includes('cover') ? svg(1200, 630, '#2f6f5e') : svg(400, 400, '#c9772b') }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/rbac/me')) data = { permissions: ['reports:read', 'reports:update', 'users:read', 'campaigns:read', 'audit_log:read'], roleName: 'Administrator' }
    else if (path.endsWith('/admin/action-center')) data = { items: [] }
    else if (path.endsWith('/notifications/unread-count')) data = { count: 0 }
    else if (path.endsWith('/auth/refresh')) data = { accessToken: 'test', refreshToken: 'test' }
    else if (path.endsWith('/admin/publication-reviews')) data = { items, total: items.length, campaignReviewGoalGhs: 250000 }
    else if (path.endsWith('/admin/donation-content-reviews')) data = { items: [donation], total: 1 }
    return route.fulfill({ json: { data } })
  })
  return { errors, hosts }
}

const tile = (scope: Locator, label: string) => scope.locator('dl > div').filter({ has: scope.page().locator(`dt:text-is("${label}")`) })

/** Full-page captures from the top, so the fixed app bar and sidebar are not painted over the cards. */
async function capture(page: Page, name: string, element?: Locator) {
  mkdirSync(shots, { recursive: true })
  await page.evaluate(() => window.scrollTo(0, 0))
  const clip = element ? await element.evaluate(node => { const box = node.getBoundingClientRect(); return { x: box.left + window.scrollX, y: box.top + window.scrollY, width: box.width, height: box.height } }) : undefined
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true, clip, animations: 'disabled' })
}

/** What a reviewer reads must never contain placeholders of broken data or raw timestamps. */
async function expectCleanText(page: Page) {
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/undefined|NaN|\[object Object\]|Invalid Date/)
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
}

async function expectDecisionNeedsNotes(card: Locator) {
  const notes = card.getByLabel('Review notes (at least 20 characters)')
  const approve = card.getByRole('button', { name: 'Approve this version', exact: true })
  const decline = card.getByRole('button', { name: 'Decline this version', exact: true })
  await expect(approve).toBeDisabled()
  await expect(decline).toBeDisabled()
  await notes.fill('Nineteen characters')
  await expect(approve).toBeDisabled()
  await expect(decline).toBeDisabled()
  await notes.fill('Twenty characters ok')
  await expect(approve).toBeEnabled()
  await expect(decline).toBeEnabled()
}

const themes = [{ skin: 'neumorphism', mode: 'light' }, { skin: 'glassmorphism', mode: 'dark' }]
for (const width of [1280, 390]) for (const { skin, mode } of themes) test(`publication review cards show every submitted field at ${width}px in ${skin} ${mode}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 })
  const { errors, hosts } = await open(page, skin, mode)
  await page.goto('/publication-reviews')

  const proposal = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  await expect(proposal).toBeVisible()
  await expect(proposal.getByText('New campaign proposal', { exact: true })).toBeVisible()
  await expect(proposal.getByText('Proposed campaign · not created yet')).toBeVisible()
  await expect(proposal.getByText('Waiting for review')).toBeVisible()
  await expect(proposal.getByText('Has media')).toBeVisible()
  await expect(tile(proposal, 'Goal')).toContainText('GH₵1,000,000')
  await expect(tile(proposal, 'Goal')).toContainText('Above the GH₵250,000 campaign-review limit')
  await expect(tile(proposal, 'End date')).toContainText('31 Oct 2026')
  await expect(tile(proposal, 'Category')).toContainText('Business')
  await expect(tile(proposal, 'Priority')).toContainText('Critical')
  await expect(tile(proposal, 'Beneficiaries').getByRole('listitem')).toHaveText(['Neurodyne'])
  await expect(proposal.getByRole('link', { name: 'Kofi Mensah' })).toHaveAttribute('href', `/users/${authorId}`)
  await expect(proposal.getByText(/within 7 days; only then does the campaign appear under Campaigns/)).toBeVisible()
  await expect(proposal.getByAltText('Cover image preview')).toHaveAttribute('src', cover)
  await expect(page.locator('article b')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /evil/ })).toHaveCount(0)
  await expect(proposal.getByText(/https:\/\/evil\.test\/claim/)).toHaveCount(1)
  const more = proposal.getByRole('button', { name: /^Show full story \([\d,]+ characters\)$/ })
  await expect(more).toHaveAttribute('aria-expanded', 'false')

  const profile = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'New creator page', exact: true }) })
  for (const [label, value] of [['Handle', 'ama-reads'], ['Display name', 'Ama Reads'], ['Tagline', 'Books for every child in Tamale'], ['Tips', 'On'], ['Profile photo', 'New, shown below'], ['Cover image', 'New, shown below']]) await expect(tile(profile, label)).toContainText(value)
  await expect(tile(profile, 'Suggested amounts').getByRole('listitem')).toHaveText(['GH₵10', 'GH₵25', 'GH₵50', 'GH₵100'])
  await expect(profile.getByText('I run a reading club for 60 children.', { exact: false })).toBeVisible()
  await expect(profile.getByText('Thank you! Every cedi becomes a book.')).toBeVisible()
  await expect(profile.getByAltText('Photo preview')).toHaveAttribute('src', photo)
  await expect(profile.getByAltText('Cover preview')).toHaveAttribute('src', creatorCover)

  const thanks = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Donor thank-you message', exact: true }) })
  await expect(thanks.getByText(/^Subject: The water point is open/)).toBeVisible()
  await expect(thanks.getByRole('link', { name: 'Clean water for Tamale' })).toHaveAttribute('href', `/campaigns/${campaignId}`)

  const columns = await page.locator('img[alt="Cover image preview"]').evaluate(image => { let grid = image.parentElement; while (grid && getComputedStyle(grid).display !== 'grid') grid = grid.parentElement; return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0 })
  expect(columns).toBe(width < 600 ? 1 : 2)
  await expect.poll(() => page.locator('img[alt$=" preview"]').count()).toBe(3)
  await expectCleanText(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

  await more.click()
  await expect(proposal.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('"goalAmount"')).toHaveCount(0)
  await proposal.getByRole('button', { name: 'Show submitted text' }).click()
  await expect(page.getByText('"goalAmount"')).toHaveCount(1)
  await expect(proposal.getByText('campaign.create', { exact: true })).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await proposal.getByRole('button', { name: 'Hide submitted text' }).click()
  await proposal.getByRole('button', { name: 'Show less' }).click()
  await expectDecisionNeedsNotes(proposal)
  await expectDecisionNeedsNotes(profile)
  await expect(proposal.getByText('20/2,000 characters · Visible to the author')).toBeVisible()
  if (width >= 600) await capture(page, `ujimora-pubreview-${width}-${skin}-${mode}`)
  else if (skin === 'neumorphism') await capture(page, `ujimora-pubreview-${width}-${skin}-${mode}-proposal`, proposal)

  await page.goto('/publication-reviews?queue=donation-content-reviews')
  const message = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Donor name and message', exact: true }) })
  await expect(tile(message, 'Public name')).toContainText('Akosua')
  await expect(message.getByText(/^Keep going! My grandmother grew up in Kanvili/)).toBeVisible()
  await expect(tile(message, 'Sent to')).toContainText('Clean water for Tamale')
  await expect(tile(message, 'Submitted by')).toContainText('Guest (no account)')
  await expect(message.getByText('Staff requested')).toHaveCount(0)
  await expectDecisionNeedsNotes(message)
  await expect(message.getByText(/not shown to the donor$/)).toBeVisible()
  await expectCleanText(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  if (width < 600 && skin === 'glassmorphism') await capture(page, `ujimora-pubreview-${width}-${skin}-${mode}-donor-message`)

  const appHost = new URL(page.url()).host
  expect([...hosts].filter(host => ![appHost, 'res.cloudinary.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host))).toEqual([])
  expect(errors).toEqual([])
})

// Every skin and mode, both widths: the cards fit, keep one heading outline and add no duplicate landmarks.
for (const width of [1280, 390]) for (const skin of ['neumorphism', 'claymorphism', 'glassmorphism', 'minimal']) for (const mode of ['light', 'dark']) {
  test(`publication review cards keep their layout and outline at ${width}px in ${skin} ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 })
    const { errors } = await open(page, skin, mode)
    await page.goto('/publication-reviews')
    const proposal = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true, level: 2 }) })
    await expect(proposal).toBeVisible()
    await expect.poll(() => page.locator('img[alt$=" preview"]').count()).toBe(3)
    // h2 per card, h3 per section, h4 per attachment: nothing skips a level.
    await expect(proposal.getByRole('heading', { name: 'Image', exact: true, level: 3 })).toBeVisible()
    await expect(proposal.getByRole('heading', { name: 'Cover image', exact: true, level: 4 })).toBeVisible()
    await expect(page.locator('article h5, article h6')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Your decision' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Your decision', level: 3 })).toHaveCount(publications.length)
    // Static guidance and warnings are notes; nothing on a freshly loaded queue is an alert.
    await expect(page.locator('main [role="alert"]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await capture(page, `ujimora-pubreview-layout-${width}-${skin}-${mode}`)
    expect(errors).toEqual([])
  })
}

test('a refused decision keeps its Refresh button on one line and keyboard focus in the card at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { errors } = await open(page, 'minimal', 'dark')
  await page.route('**/api/v1/admin/publication-reviews/*/review', route => route.fulfill({ status: 409, json: { message: 'Another reviewer already decided this submission', errors: { review: ['decided'] } } }))
  await page.goto('/publication-reviews')
  const proposal = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true, level: 2 }) })
  await proposal.getByLabel('Review notes (at least 20 characters)').fill('Reviewed every field of this proposal.')
  await proposal.getByRole('button', { name: 'Approve this version', exact: true }).click()
  const alert = proposal.getByRole('alert')
  await expect(alert).toContainText('Already decided')
  await expect(alert).toContainText('Another reviewer already decided this submission')
  // The buttons were disabled while saving; focus is on the explanation, not the page body.
  await expect(alert).toBeFocused()
  const refresh = alert.getByRole('button', { name: 'Refresh', exact: true })
  const box = (await refresh.boundingBox())!
  // A one-line label: the card's "anywhere" wrapping used to squeeze it to 64×121 px, a letter or two per line.
  expect(box.height).toBeLessThan(48)
  expect(box.width).toBeGreaterThan(56)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await capture(page, 'ujimora-pubreview-390-minimal-dark-refused', proposal)
  await refresh.focus()
  await page.keyboard.press('Enter')
  // The reload replaces the card: focus returns to its title.
  await expect(page.getByRole('heading', { name: title, exact: true, level: 2 })).toBeFocused()
  expect(errors).toEqual([])
})

test('an author-controlled name cannot reorder the labels beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  const orgId = '6abd48b1c2d3e4f5a6b7c8f1'
  // An unmatched U+2069 then a right-to-left override: enough to escape a plain <bdi> in Chromium.
  const organization = { id: orgId, name: 'Acme', email: 'team@acme.test', accountType: 'organization', organizationName: 'Acme Foundation\u2069\u202e', verificationLevel: 0, emailVerified: false, closed: false }
  const item = { id: '66f1c0de0a1b2c3d4e5f6301', actorId: orgId, resourceId: orgId, action: 'organization.profile', author: organization, status: 'pending', reason: 'staff_requested', createdAt: iso(-0.1), purgeAt: iso(29), mediaUrls: [], text: JSON.stringify({ organizationName: 'Acme Foundation', website: 'https://acme.test' }) }
  const { errors } = await open(page, 'neumorphism', 'light', [item])
  await page.goto('/publication-reviews')
  const card = page.getByRole('article')
  const line = tile(card, 'Submitted by').locator('dd p').nth(1)
  await expect(line).toContainText('Email not verified')
  // The characters in the order they are painted: line by line, left to right.
  const painted = await line.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const chars: { char: string; x: number; middle: number; line: number }[] = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      for (let index = 0; index < text.length; index++) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + 1)
        const rect = range.getBoundingClientRect()
        if (rect.width > 0) chars.push({ char: text[index], x: rect.left, middle: (rect.top + rect.bottom) / 2, line: 0 })
      }
    }
    chars.sort((a, b) => a.middle - b.middle)
    let line = 0, top = chars[0]?.middle ?? 0
    for (const entry of chars) { if (entry.middle - top > 8) { line++; top = entry.middle } entry.line = line }
    return chars.sort((a, b) => a.line - b.line || a.x - b.x).map(entry => entry.char).join('')
  })
  // Spaces at a line break may not be painted, so compare without them.
  const squash = (text: string) => text.replace(/\s+/g, '')
  expect(squash(painted)).toBe(squash('team@acme.test · Organization account · Acme Foundation · Verification: None · Email not verified'))
  await expect(card.getByText(/^The names on this card contain 2 invisible or text-direction characters/)).toBeVisible()
  expect(errors).toEqual([])
})
