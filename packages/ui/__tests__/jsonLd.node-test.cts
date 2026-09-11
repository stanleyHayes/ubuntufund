import { test } from 'node:test'
import assert from 'node:assert/strict'

const { breadcrumbList, organization } = require('../src/jsonLd.ts') as typeof import('../src/jsonLd')

const ORIGIN = 'https://app.ujimora.com'

test('breadcrumb positions start at 1 and run in order', () => {
  const crumb = breadcrumbList(ORIGIN, [
    { name: 'Home', path: '/' },
    { name: 'Explore', path: '/explore' },
    { name: 'Help Ama finish school' },
  ]) as { itemListElement: { position: number; name: string }[] }

  assert.deepEqual(
    crumb.itemListElement.map((item) => item.position),
    [1, 2, 3],
    'Google reads position literally; a 0-based list drops the trail'
  )
  assert.equal(crumb.itemListElement[2].name, 'Help Ama finish school')
})

test('the last crumb carries no item — it is the page itself', () => {
  const crumb = breadcrumbList(ORIGIN, [
    { name: 'Home', path: '/' },
    { name: 'Current page' },
  ]) as { itemListElement: Record<string, unknown>[] }

  assert.equal(crumb.itemListElement[0].item, `${ORIGIN}/`)
  assert.ok(
    !('item' in crumb.itemListElement[1]),
    'a self-link on the final crumb is redundant and flagged by validators'
  )
})

test('crumb URLs are absolute on the origin they were built for', () => {
  // The two apps live on different hosts. A trail emitted on app.ujimora.com
  // that links to ujimora.com would describe a path the page is not on.
  const crumb = breadcrumbList('https://ujimora.com', [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: 'A post' },
  ]) as { itemListElement: { item?: string }[] }

  assert.equal(crumb.itemListElement[1].item, 'https://ujimora.com/blog')
})

test('organization omits fields it has no value for rather than emitting blanks', () => {
  // `"description": ""` is a claim that the organization has no description.
  // Structured data is read literally, so absent must mean absent.
  const node = organization({ name: 'Hope Foundation', url: `${ORIGIN}/organizations/hope` })

  assert.deepEqual(Object.keys(node).sort(), ['@context', '@type', 'name', 'url'].sort())
})

test('organization drops a sameAs entry that is not an absolute URL', () => {
  // A profile's website field is free text: users type "hopefoundation.org" or
  // leave a placeholder. sameAs asserts "this is the same entity", so a value
  // that is not a resolvable URL is a broken claim, not a harmless one.
  const node = organization({
    name: 'Hope Foundation',
    url: `${ORIGIN}/organizations/hope`,
    sameAs: ['hopefoundation.org', 'https://hopefoundation.org'],
  }) as { sameAs?: string[] }

  assert.deepEqual(node.sameAs, ['https://hopefoundation.org'])
})

test('organization emits no sameAs key when every candidate is unusable', () => {
  const node = organization({
    name: 'Hope Foundation',
    url: `${ORIGIN}/organizations/hope`,
    sameAs: ['not a url'],
  })

  assert.ok(!('sameAs' in node), 'an empty sameAs array is still a claim about the entity')
})
