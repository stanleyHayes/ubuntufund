const assert = require('node:assert/strict')
const test = require('node:test')
const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { BrandedTextField } = require('../src/components/BrandedTextField.tsx')

const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(BrandedTextField, props))

test('email fields receive a decorative email icon and retain their label', () => {
  const html = render({ label: 'Email address', type: 'email', required: true })
  assert.match(html, /EmailOutlinedIcon/)
  assert.match(html, /type="email"/)
  assert.match(html, /Email address/)
})

test('existing currency adornment is preserved without a duplicate icon', () => {
  const html = render({ label: 'Amount', InputProps: { startAdornment: createElement('span', null, 'GH₵') } })
  assert.match(html, /GH₵/)
  assert.doesNotMatch(html, /PaymentsOutlinedIcon/)
})

test('passwords have an accessible visibility action unless one already exists', () => {
  assert.match(render({ label: 'Password', type: 'password' }), /aria-label="Show password"/)
  const html = render({ label: 'Password', type: 'password', slotProps: { input: () => ({ endAdornment: createElement('button', null, 'Existing action') }) } })
  assert.match(html, /Existing action/)
  assert.doesNotMatch(html, /aria-label="Show password"/)
})

test('multiline fields keep their text area and disabled state', () => {
  const html = render({ label: 'Message', multiline: true, disabled: true })
  assert.match(html, /<textarea/)
  assert.match(html, /NotesOutlinedIcon/)
  assert.match(html, /disabled=""/)
})

test('missing placeholders get a prompt and explicit examples stay intact', () => {
  assert.match(render({ label: 'Full name' }), /placeholder="Enter full name"/)
  assert.match(render({ label: 'Email', type: 'email' }), /placeholder="you@example.com"/)
  assert.match(render({ label: 'Amount', type: 'number', placeholder: 'e.g. 50' }), /placeholder="e.g. 50"/)
})

test('empty controlled selects show a choice prompt', () => {
  const html = render({ label: 'Category', select: true, value: '', children: [] })
  assert.match(html, /Select category/)
})
