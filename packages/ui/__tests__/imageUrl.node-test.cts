const { test } = require('node:test')
const assert = require('node:assert/strict')
const { sizedImageUrl } = require('../src/imageUrl.ts')

const RAW = 'https://res.cloudinary.com/demo/image/upload/v1712345678/campaigns/cover.jpg'

test('sizes and re-encodes a Cloudinary upload URL', () => {
  const out = sizedImageUrl(RAW, { width: 320 })
  assert.equal(
    out,
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_320,dpr_2.0/v1712345678/campaigns/cover.jpg',
  )
})

test('omits dpr when retina is off', () => {
  assert.match(sizedImageUrl(RAW, { width: 100, retina: false }), /w_100\/v1712345678/)
})

test('leaves non-Cloudinary URLs alone', () => {
  const other = 'https://images.unsplash.com/photo-123'
  assert.equal(sizedImageUrl(other, { width: 320 }), other)
})

test('is idempotent — never stacks a second transformation', () => {
  const once = sizedImageUrl(RAW, { width: 320 })
  assert.equal(sizedImageUrl(once, { width: 640 }), once)
})

test('passes undefined through, so callers need no guard', () => {
  assert.equal(sizedImageUrl(undefined, { width: 320 }), undefined)
})
