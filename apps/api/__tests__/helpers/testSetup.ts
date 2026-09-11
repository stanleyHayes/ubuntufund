import { beforeEach } from 'vitest'
import { resetRateLimiters } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js'

// The rate limiters are process-wide and keyed by IP; the suite runs as one
// process from one address, so without this a long file exhausts the 300/15min
// budget and later tests fail with 429s unrelated to what they assert.
beforeEach(() => {
  resetRateLimiters()
})
