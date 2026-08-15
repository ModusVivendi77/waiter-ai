import { afterEach, describe, expect, it } from 'vitest'

import { clearRateLimits, envInt, getRateLimitHeaders, rateLimit } from '@/lib/utils/rateLimit'

describe('envInt', () => {
  const TEST_ENV = 'TEST_RATE_LIMIT_INT'

  afterEach(() => {
    delete process.env[TEST_ENV]
  })

  it('reads a valid positive integer from the environment', () => {
    process.env[TEST_ENV] = '150'
    expect(envInt(TEST_ENV, 30)).toBe(150)
  })

  it('falls back when the variable is unset', () => {
    expect(envInt(TEST_ENV, 30)).toBe(30)
  })

  it('falls back when the value is not a positive integer', () => {
    process.env[TEST_ENV] = 'not-a-number'
    expect(envInt(TEST_ENV, 30)).toBe(30)
    process.env[TEST_ENV] = '0'
    expect(envInt(TEST_ENV, 30)).toBe(30)
    process.env[TEST_ENV] = '-5'
    expect(envInt(TEST_ENV, 30)).toBe(30)
  })
})

describe('rateLimit', () => {
  afterEach(() => {
    clearRateLimits()
  })

  it('allows the first request', () => {
    const result = rateLimit('client-1', 3, 10_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('allows requests up to the limit', () => {
    rateLimit('client-2', 3, 10_000)
    rateLimit('client-2', 3, 10_000)
    const result = rateLimit('client-2', 3, 10_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('blocks requests beyond the limit', () => {
    rateLimit('client-3', 3, 10_000)
    rateLimit('client-3', 3, 10_000)
    rateLimit('client-3', 3, 10_000)
    const result = rateLimit('client-3', 3, 10_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('tracks clients independently', () => {
    rateLimit('client-a', 2, 10_000)
    rateLimit('client-a', 2, 10_000)
    const blocked = rateLimit('client-a', 2, 10_000)
    expect(blocked.allowed).toBe(false)

    const allowed = rateLimit('client-b', 2, 10_000)
    expect(allowed.allowed).toBe(true)
  })

  it('resets the window after it expires', () => {
    rateLimit('client-4', 1, 100)
    rateLimit('client-4', 1, 100)
    expect(rateLimit('client-4', 1, 100).allowed).toBe(false)
  })

  it('uses default limits when not specified', () => {
    const result = rateLimit('client-5')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(19)
  })

  it('returns a future reset time', () => {
    const result = rateLimit('client-6', 5, 60_000)
    expect(result.resetTime).toBeGreaterThan(Date.now())
  })

  it('builds headers with a remaining quota on allowed requests', () => {
    const limit = rateLimit('client-7', 5, 60_000)
    const headers = getRateLimitHeaders(limit)
    expect(headers['X-RateLimit-Remaining']).toBe('4')
    expect(headers['Retry-After']).toBeUndefined()
  })

  it('builds headers with Retry-After when the request is blocked', () => {
    const max = 2
    rateLimit('client-8', max, 60_000)
    rateLimit('client-8', max, 60_000)
    const blocked = rateLimit('client-8', max, 60_000)
    expect(blocked.allowed).toBe(false)
    const headers = getRateLimitHeaders(blocked)
    expect(headers['X-RateLimit-Remaining']).toBe('0')
    expect(headers['Retry-After']).toMatch(/^\d+$/)
  })
})
