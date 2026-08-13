type RateLimitRecord = {
  count: number
  resetTime: number
}

const requestCounts = new Map<string, RateLimitRecord>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetTime: number
}

export function rateLimit(
  clientKey: string,
  maxRequests = 20,
  windowMs = 10 * 60 * 1000
): RateLimitResult {
  const now = Date.now()
  const record = requestCounts.get(clientKey)

  if (!record || now > record.resetTime) {
    requestCounts.set(clientKey, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime }
}

export function clearRateLimits() {
  requestCounts.clear()
}

/**
 * Builds HTTP rate-limit headers for a rateLimit() result.
 * `X-RateLimit-Remaining` is included on every response so clients can
 * track their remaining quota; `Retry-After` is only meaningful when the
 * request was blocked (429).
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(result.remaining),
  }

  if (!result.allowed) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000)))
  }

  return headers
}
