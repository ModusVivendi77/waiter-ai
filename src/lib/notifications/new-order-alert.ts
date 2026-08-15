'use client'

/**
 * Client-side "new order" alerting: a count badge in the browser tab title
 * (e.g. "(2) 🔔 New order — Waiter AI") plus an optional short chime played
 * through the Web Audio API. Both work without any notification permission.
 *
 * The tab badge accumulates unacknowledged new orders and clears the moment
 * the tab regains focus / becomes visible. The sound is opt-out via
 * `waiter-ai-new-order-sound` in localStorage (default: on).
 */

const SOUND_STORAGE_KEY = 'waiter-ai-new-order-sound'

let pendingCount = 0
let originalTitle: string | null = null
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
    audioCtx = new Ctor()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

// Autoplay policies only allow audio after a user gesture; unlock once at the
// first interaction so the very first alert can chime.
if (typeof window !== 'undefined') {
  const unlock = () => ensureAudioContext()
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

/** Two quick, pleasant descending sine notes (a "ding-dong"). */
export function playNewOrderSound() {
  const ctx = ensureAudioContext()
  if (!ctx) return
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
    gain.gain.exponentialRampToValueAtTime(0.16, now + delay + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.16)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(now + delay)
    oscillator.stop(now + delay + 0.2)
  }
}

/** Called once per new order received via realtime. */
export function ringNewOrderAlert(label: string) {
  if (typeof document === 'undefined') return
  pendingCount += 1
  if (originalTitle === null) {
    originalTitle = document.title
  }
  const base = originalTitle || ''
  document.title = pendingCount > 0 ? `(${pendingCount}) 🔔 ${label} — ${base}` : base
  if (isNewOrderSoundEnabled()) {
    playNewOrderSound()
  }
}

export function clearNewOrderAlert() {
  if (typeof document === 'undefined') return
  pendingCount = 0
  if (originalTitle !== null) {
    document.title = originalTitle
    originalTitle = null
  }
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
