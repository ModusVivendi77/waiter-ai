export type StoredOrder = {
  trackingToken: string
  submittedAt: string
}

export function lastOrderKey(token: string) {
  return `waiter-ai:last-order:${token}`
}

export function readStoredOrder(token: string): StoredOrder | null {
  try {
    const raw = window.localStorage.getItem(lastOrderKey(token))
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<StoredOrder>
    return typeof parsed.trackingToken === 'string'
      ? { trackingToken: parsed.trackingToken, submittedAt: parsed.submittedAt || '' }
      : null
  } catch {
    return null
  }
}

export function writeStoredOrder(token: string, order: StoredOrder) {
  try {
    window.localStorage.setItem(lastOrderKey(token), JSON.stringify(order))
  } catch {
    // localStorage unavailable (private browsing, storage disabled, ...) — the
    // success box still links to the tracking page, so nothing is lost.
  }
}

export function clearStoredOrder(token: string) {
  try {
    window.localStorage.removeItem(lastOrderKey(token))
  } catch {
    // ignore
  }
}
