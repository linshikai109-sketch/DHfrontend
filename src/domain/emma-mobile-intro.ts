/** Presentation configuration only; this sequence never starts a voice session. */
export const EMMA_MOBILE_INTRO_CONFIG = {
  copy: '先认识你，再找到适合你的下一步。',
  enabledBySurface: { mobileEmma: true, desktopEmma: false, john: false },
  timings: { introCopy: 200, orbReveal: 650, orbDock: 1250, questionReady: 1750, settled: 2200 },
} as const

export type MobileIntroPhase = 'idle' | 'intro-copy' | 'orb-reveal' | 'orb-dock' | 'question-ready' | 'settled' | 'cancelled'

/** Timings are relative to start, so delayed rendering never extends the sequence. */
export function createMobileIntroRun(onPhase: (phase: MobileIntroPhase) => void) {
  let phase: MobileIntroPhase = 'idle'
  let started = false
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const clearTimers = () => {
    timers.forEach(clearTimeout)
    timers.clear()
  }
  const emit = (next: MobileIntroPhase) => {
    if (phase === next) return
    phase = next
    onPhase(next)
  }
  const isCancelled = () => phase === 'cancelled'
  return {
    getPhase: () => phase,
    start() {
      if (started || phase !== 'idle') return
      started = true
      const schedule: [MobileIntroPhase, number][] = [
        ['intro-copy', EMMA_MOBILE_INTRO_CONFIG.timings.introCopy],
        ['orb-reveal', EMMA_MOBILE_INTRO_CONFIG.timings.orbReveal],
        ['orb-dock', EMMA_MOBILE_INTRO_CONFIG.timings.orbDock],
        ['question-ready', EMMA_MOBILE_INTRO_CONFIG.timings.questionReady],
        ['settled', EMMA_MOBILE_INTRO_CONFIG.timings.settled],
      ]
      for (const [next, delay] of schedule) {
        const timer = setTimeout(() => {
          timers.delete(timer)
          if (phase !== 'cancelled' && phase !== 'settled') emit(next)
        }, delay)
        timers.add(timer)
      }
    },
    skip() {
      if (phase === 'cancelled' || phase === 'settled') return
      started = true
      clearTimers()
      if (phase !== 'question-ready') emit('question-ready')
      // A callback can cancel the run while the question becomes ready.
      if (!isCancelled()) emit('settled')
    },
    cancel() {
      clearTimers()
      if (phase !== 'settled' && phase !== 'cancelled') emit('cancelled')
    },
  }
}

// Memory-only: refresh/direct navigation renders the question normally. No user data is stored.
let seen = false
let pending: number | null = null
let nextRequestId = 0

export function requestEmmaMobileIntro(): number | null {
  if (seen) return null
  if (pending !== null) return pending
  pending = ++nextRequestId
  return pending
}

export function takeEmmaMobileIntro(): number | null {
  const request = pending
  pending = null
  if (request !== null) seen = true
  return request
}

export function markEmmaMobileIntroSeen() {
  seen = true
  pending = null
}

export function cancelEmmaMobileIntroRequest(id: number) {
  if (pending === id) pending = null
}

/** Test isolation only; application code must not reset the current session. */
export function resetEmmaMobileIntroSessionForTests() {
  seen = false
  pending = null
  nextRequestId = 0
}
