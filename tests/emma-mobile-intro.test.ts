import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMMA_MOBILE_INTRO_CONFIG, createMobileIntroRun, requestEmmaMobileIntro,
  takeEmmaMobileIntro, markEmmaMobileIntroSeen, cancelEmmaMobileIntroRequest,
  resetEmmaMobileIntroSessionForTests, type MobileIntroPhase,
} from '../src/domain/emma-mobile-intro'

beforeEach(() => { vi.useFakeTimers(); resetEmmaMobileIntroSessionForTests() })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('mobile intro sequence', () => {
  it('uses the agreed copy and only enables the mobile Emma surface', () => {
    expect(EMMA_MOBILE_INTRO_CONFIG.copy).toBe('先认识你，再找到适合你的下一步。')
    expect(EMMA_MOBILE_INTRO_CONFIG.enabledBySurface).toEqual({ mobileEmma: true, desktopEmma: false, john: false })
  })
  it('runs each phase once at its relative deadline despite repeated start', () => {
    const notify = vi.fn()
    const run = createMobileIntroRun(notify)
    expect(run.getPhase()).toBe('idle')
    run.start(); run.start()
    for (const [delay, expected] of [[199, 'idle'], [1, 'intro-copy'], [450, 'orb-reveal'], [600, 'orb-dock'], [500, 'question-ready'], [450, 'settled']] as const) {
      vi.advanceTimersByTime(delay)
      expect(run.getPhase()).toBe(expected)
    }
    run.start(); run.skip(); run.cancel()
    vi.runAllTimers()
    expect(notify.mock.calls.flat()).toEqual(['intro-copy', 'orb-reveal', 'orb-dock', 'question-ready', 'settled'])
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each([0, 200, 650, 1250, 1750, 2200])('skip at %ims exposes question and settles only once', time => {
    const phases: MobileIntroPhase[] = []
    const run = createMobileIntroRun(phase => phases.push(phase))
    run.start(); vi.advanceTimersByTime(time)
    run.skip(); run.skip(); run.start(); vi.runAllTimers()
    expect(run.getPhase()).toBe('settled')
    expect(phases.filter(phase => phase === 'question-ready')).toHaveLength(1)
    expect(phases.filter(phase => phase === 'settled')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each([0, 200, 650, 1250, 1750])('cancel at %ims prevents every late callback', time => {
    const notify = vi.fn()
    const run = createMobileIntroRun(notify)
    run.start(); vi.advanceTimersByTime(time); run.cancel()
    const calls = notify.mock.calls.length
    run.cancel(); run.start(); run.skip(); vi.runAllTimers()
    expect(notify).toHaveBeenCalledTimes(calls)
    expect(run.getPhase()).toBe('cancelled')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('can skip before start for reduced motion', () => {
    const notify = vi.fn()
    const run = createMobileIntroRun(notify)
    run.skip(); run.start()
    expect(notify.mock.calls.flat()).toEqual(['question-ready', 'settled'])
    expect(vi.getTimerCount()).toBe(0)
  })
  it('honors cancellation from the question-ready callback', () => {
    const phases: MobileIntroPhase[] = []
    const run = createMobileIntroRun(phase => {
      phases.push(phase)
      if (phase === 'question-ready') run.cancel()
    })
    run.skip()
    expect(phases).toEqual(['question-ready', 'cancelled'])
  })
})

describe('memory-only navigation request', () => {
  it('direct navigation has no intro request', () => { expect(takeEmmaMobileIntro()).toBeNull() })
  it('deduplicates rapid requests and consumes only once', () => {
    const id = requestEmmaMobileIntro()
    expect(id).not.toBeNull()
    expect(requestEmmaMobileIntro()).toBe(id)
    expect(takeEmmaMobileIntro()).toBe(id)
    expect(takeEmmaMobileIntro()).toBeNull()
    expect(requestEmmaMobileIntro()).toBeNull()
  })
  it('cancels abandoned navigation without cancelling a later request', () => {
    const oldId = requestEmmaMobileIntro()!
    cancelEmmaMobileIntroRequest(oldId)
    const newId = requestEmmaMobileIntro()!
    expect(newId).not.toBe(oldId)
    cancelEmmaMobileIntroRequest(oldId)
    expect(takeEmmaMobileIntro()).toBe(newId)
  })
  it('marking seen discards pending navigation and prevents reentry', () => {
    requestEmmaMobileIntro(); markEmmaMobileIntroSeen()
    expect(takeEmmaMobileIntro()).toBeNull()
    expect(requestEmmaMobileIntro()).toBeNull()
  })
})
