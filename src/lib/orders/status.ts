/**
 * Shared order status vocabulary used by every order surface (home dashboard
 * live orders/history, the Orders workspace tabs, filtering and sorting).
 * Keeping these in one place guarantees "live" means the same thing on the
 * home tab and in the Orders tab.
 */

/** Orders that are still in progress and should appear under "Live orders". */
export const OPEN_STATUSES = ['NEW', 'ACCEPTED', 'PREPARING', 'READY']

/** Terminal orders that belong in "Order history". */
export const HISTORY_STATUSES = ['SERVED', 'REJECTED', 'CANCELLED']

/** The full lifecycle (used for per-status groupings). */
export const STATUS_FLOW = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'REJECTED', 'CANCELLED']

/** Status tabs in the Orders workspace. */
export const STATUS_TABS = ['ALL', 'NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CLOSED'] as const

/** Status-change buttons offered in the Orders workspace. */
export const STATUS_OPTIONS = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'REJECTED', 'CANCELLED'] as const

/** Statuses that appear under the workspace's "Closed" tab. */
export const CLOSED_STATUSES = new Set(['REJECTED', 'CANCELLED'])

/** Workflow order used for "sort by status". */
export const STATUS_PRIORITY: Record<string, number> = {
  NEW: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY: 3,
  SERVED: 4,
  REJECTED: 5,
  CANCELLED: 6,
}
