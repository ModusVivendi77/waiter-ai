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