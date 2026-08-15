'use client'

/**
 * Client-side "new order" notifications.
 *
 * Keeps an in-memory list of unacknowledged new orders and drives every
 * notification surface from it:
 *  - browser tab title badge: "(2) 🔔 New order — Waiter AI"
 *  - the top-nav "Orders" link badge: "Orders (2)"
 *  - the Home dashboard's expandable new-order lines (Accept / Dismiss)
 *  - an optional short chime via the Web Audio API (opt-out in localStorage)
 *
 * Orders are deduplicated by id (`markOrderSeen` seeds the set on the initial
 * fetch; the 15s re-sync poll and realtime both call `recordNewOrder`), so a
 * dropped websocket payload still produces a notification within one poll.
 */

export type PendingNewOrder = {
  orderId: string
  orderNumber: number | null
  tableName: string
  total: number
  currency: string
}

type Listener = (pending: PendingNewOrder[]) => void

const SOUND_STORAGE_KEY = 'waiter-ai-new-order-sound'
const MAX_PENDING = 20

let pending: PendingNewOrder[] = []
const seenOrderIds = new Set<string>()
const listeners = new Set<Listener>()
let originalTitle: string | null = null
let labelForTitle = 'New order'
let audioCtx: AudioContext | null = null

export function isNewOrderSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'
}

export function setNewOrderSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off')
}

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) {
    try {
      audioCtx = new Ctor()
    } catch {
      return null
    }
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Browsers only allow audio after a user gesture, and the "unlocked" state is
// per AudioContext — so keep re-arming on every kind of interaction. Once the
// user clicks/taps anywhere, the context resumes and future chimes play.
if (typeof window !== 'undefined') {
  const unlock = () => ensureAudioContext()
  const unlockEvents = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'] as const
  for (const event of unlockEvents) {
    window.addEventListener(event, unlock, { passive: true })
  }
}

/** Two quick, pleasant descending sine notes (a "ding-dong"). */
export function playNewOrderSound() {
  const ctx = ensureAudioContext()
  if (!ctx) return

  const schedule = () => {
    try {
      const now = ctx.currentTime
      const notes: Array<[number, number]> = [
        [0, 880],
        [0.18, 1174.66],
      ]
      for (const [delay, frequency] of notes) {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.0001, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.2, now + delay + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.18)
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start(now + delay)
        oscillator.stop(now + delay + 0.22)
      }
    } catch {
      // Audio is best-effort; never let it break the notification flow.
    }
  }

  if (ctx.state === 'suspended') {
    // Resume is async — schedule the notes once it settles so they are not
    // dropped on a suspended clock.
    void ctx.resume().then(schedule).catch(schedule)
  } else {
    schedule()
  }
}

function syncTabTitle() {
  if (typeof document === 'undefined') return
  if (originalTitle === null) {
    originalTitle = document.title
  }
  const base = originalTitle || ''
  document.title = pending.length > 0 ? `(${pending.length}) 🔔 ${labelForTitle} — ${base}` : base
}

function emit() {
  for (const listener of listeners) {
    listener(pending)
  }
}

/** Seed the dedupe set (e.g. after the initial fetch) without notifying. */
export function markOrderSeen(orderId: string) {
  seenOrderIds.add(orderId)
}

export function isOrderSeen(orderId: string) {
  return seenOrderIds.has(orderId)
}

/**
 * Register a brand-new order and notify every surface. `label` is the
 * translated "New order" text used in the tab title badge.
 */
export function recordNewOrder(order: PendingNewOrder, label: string) {
  if (seenOrderIds.has(order.orderId)) return
  seenOrderIds.add(order.orderId)
  pending = [...pending.filter((entry) => entry.orderId !== order.orderId), order].slice(-MAX_PENDING)
  labelForTitle = label

  syncTabTitle()
  if (isNewOrderSoundEnabled()) {
    playNewOrderSound()
  }
  emit()
}

/** Remove one order from the pending list (Accept / Dismiss / already seen). */
export function acknowledgeNewOrder(orderId: string) {
  const before = pending.length
  pending = pending.filter((entry) => entry.orderId !== orderId)
  if (pending.length !== before) {
    syncTabTitle()
    emit()
  }
}

/** Clear the whole pending list (e.g. when the Orders page is opened). */
export function clearPendingNewOrders() {
  if (pending.length === 0) return
  pending = []
  syncTabTitle()
  emit()
}

export function getPendingNewOrders(): PendingNewOrder[] {
  return pending
}

export function subscribeNewOrders(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Clears only the tab-title badge (called on focus / interaction). */
export function clearNewOrderAlert() {
  if (typeof document === 'undefined') return
  originalTitle = null
  document.title = document.title.replace(/^\(\d+\) 🔔 .*? — /, '')
}

/** Clears the badge whenever the tab regains focus or the user interacts. Returns a cleanup fn. */
export function initNewOrderAlertClearing(): () => void {
  if (typeof window === 'undefined') return () => {}
  const clear = () => clearNewOrderAlert()
  window.addEventListener('focus', clear)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearNewOrderAlert()
    }
  })
  // Headless/focusless environments (and users clicking straight into the tab)
  // may never fire a focus/visibility event — treat any interaction as "seen".
  document.addEventListener('pointerdown', clear, { passive: true })
  document.addEventListener('keydown', clear, { passive: true })
  return () => {
    window.removeEventListener('focus', clear)
    document.removeEventListener('visibilitychange', clear)
    document.removeEventListener('pointerdown', clear)
    document.removeEventListener('keydown', clear)
  }
}
