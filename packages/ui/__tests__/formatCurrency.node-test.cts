const { test } = require('node:test')
const assert = require('node:assert/strict')
const { formatCurrency } = require('../src/components/CurrencyDisplay.tsx')

test('whole cedis show no decimals and are grouped', () => {
  assert.equal(formatCurrency(3990), 'GH₵3,990')
  assert.equal(formatCurrency(149), 'GH₵149')
  assert.equal(formatCurrency(0), 'GH₵0')
})

test('anything else shows exactly two decimals, never one', () => {
  assert.equal(formatCurrency(332.5), 'GH₵332.50')
  assert.equal(formatCurrency(9.99), 'GH₵9.99')
  assert.equal(formatCurrency(9999.9), 'GH₵9,999.90')
  assert.equal(formatCurrency(24.916666), 'GH₵24.92')
})

test('float noise around a whole amount still reads as whole cedis', () => {
  assert.equal(formatCurrency(29.999999999999996), 'GH₵30')
  assert.equal(formatCurrency(0.1 + 0.2), 'GH₵0.30')
})
