import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitEmmaEntrance, enterEmmaOnboarding } from '../src/components/emma-entry-transition';

function environment(reduced = false) {
  const classes = new Set<string>();
  const heading = { setAttribute: vi.fn(), focus: vi.fn() };
  const listeners = new Map<string, () => void>();
  const doc = {
    hidden: false,
    documentElement: { classList: { add: (x: string) => classes.add(x), remove: (x: string) => classes.delete(x) } },
    querySelector: vi.fn(() => heading),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: reduced }),
    addEventListener: (key: string, fn: () => void) => listeners.set(key, fn),
    removeEventListener: (key: string) => listeners.delete(key),
  });
  return { classes, heading, listeners, doc };
}

afterEach(() => { commitEmmaEntrance('/john'); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Emma entrance transition', () => {
  it('navigates immediately on unsupported browsers and cleans fallback styling', async () => {
    vi.useFakeTimers();
    const env = environment();
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    expect(navigate).toHaveBeenCalledOnce();
    expect(env.classes.has('emma-entry-arriving')).toBe(true);
    expect(env.heading.focus).not.toHaveBeenCalled();
    commitEmmaEntrance('/emma/onboarding');
    expect(env.heading.focus).toHaveBeenCalledWith({ preventScroll: true });
    await Promise.resolve();
    vi.runAllTimers();
    expect(env.classes.size).toBe(0);
    expect(env.listeners.size).toBe(0);
  });

  it('skips all animation and timers for reduced motion', async () => {
    vi.useFakeTimers();
    const env = environment(true);
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    expect(navigate).toHaveBeenCalledOnce();
    expect(env.classes.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    commitEmmaEntrance('/emma/onboarding');
    await Promise.resolve();
    expect(env.listeners.size).toBe(0);
  });

  it('clears animation on browser back without navigating again', () => {
    vi.useFakeTimers();
    const env = environment();
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    env.listeners.get('popstate')?.();
    expect(env.classes.size).toBe(0);
    expect(env.listeners.size).toBe(0);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('handles native transition rejection without duplicating navigation', async () => {
    const env = environment();
    const navigate = vi.fn();
    Object.assign(env.doc, { startViewTransition: (update: () => void) => {
      update();
      return { finished: Promise.reject(new Error('skipped')), skipTransition: vi.fn() };
    } });
    enterEmmaOnboarding(navigate);
    commitEmmaEntrance('/emma/onboarding');
    await Promise.resolve();
    expect(navigate).toHaveBeenCalledOnce();
    expect(env.classes.size).toBe(0);
  });

  it('falls back if native transition fails before invoking the update', async () => {
    vi.useFakeTimers();
    const env = environment();
    Object.assign(env.doc, { startViewTransition: () => { throw new Error('unsupported'); } });
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    expect(navigate).toHaveBeenCalledOnce();
    commitEmmaEntrance('/emma/onboarding');
    await Promise.resolve();
    vi.runAllTimers();
    expect(env.classes.size).toBe(0);
  });

  it('does not run a delayed native update after browser back', async () => {
    const env = environment();
    let update = () => {};
    let finish = () => {};
    const skipTransition = vi.fn();
    Object.assign(env.doc, { startViewTransition: (callback: () => void) => {
      update = callback;
      return { finished: new Promise<void>(resolve => { finish = resolve; }), skipTransition };
    } });
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    env.listeners.get('popstate')?.();
    update();
    finish();
    await Promise.resolve();
    expect(skipTransition).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    expect(env.classes.size).toBe(0);
  });

  it('cleans a successful native transition including its event listeners', async () => {
    const env = environment();
    Object.assign(env.doc, { startViewTransition: (update: () => void) => {
      update();
      return { ready: Promise.resolve(), finished: Promise.resolve(), skipTransition: vi.fn() };
    } });
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    commitEmmaEntrance('/emma/onboarding');
    await Promise.resolve();
    expect(navigate).toHaveBeenCalledOnce();
    expect(env.classes.size).toBe(0);
    expect(env.listeners.size).toBe(0);
  });

  it('keeps the live mobile orb outside native transition snapshots', async () => {
    const env = environment();
    const startViewTransition = vi.fn();
    Object.assign(env.doc, { startViewTransition });
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate, undefined, { focus: false, mobileIntro: true });
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnce();
    expect(env.classes.size).toBe(0);
    commitEmmaEntrance('/emma/onboarding');
    await Promise.resolve();
    expect(env.heading.focus).not.toHaveBeenCalled();
    expect(env.listeners.size).toBe(0);
  });

  it('skips transitions in a hidden page', () => {
    const env = environment();
    env.doc.hidden = true;
    const startViewTransition = vi.fn();
    Object.assign(env.doc, { startViewTransition });
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    expect(navigate).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(env.classes.size).toBe(0);
  });

  it('waits for the actual onboarding commit before resolving the native update', async () => {
    const env = environment();
    let performUpdate: () => Promise<void> = () => Promise.resolve();
    let finish = () => {};
    Object.assign(env.doc, { startViewTransition: (callback: () => Promise<void>) => {
      performUpdate = callback;
      return { finished: new Promise<void>(resolve => { finish = resolve; }), skipTransition: vi.fn() };
    } });
    const navigate = vi.fn();
    enterEmmaOnboarding(navigate);
    const completed = vi.fn();
    const committed = performUpdate().then(completed);
    await Promise.resolve();
    expect(navigate).toHaveBeenCalledOnce();
    expect(completed).not.toHaveBeenCalled();
    expect(env.heading.focus).not.toHaveBeenCalled();
    commitEmmaEntrance('/emma/onboarding');
    await committed;
    expect(completed).toHaveBeenCalledOnce();
    expect(env.heading.focus).toHaveBeenCalledOnce();
    finish();
    await Promise.resolve();
  });

  it('releases activation guard when pagehide cancels before native update', async () => {
    const env = environment();
    let performUpdate: () => Promise<void> = () => Promise.resolve();
    Object.assign(env.doc, { startViewTransition: (callback: () => Promise<void>) => {
      performUpdate = callback;
      return { finished: Promise.resolve(), skipTransition: vi.fn() };
    } });
    const navigate = vi.fn();
    const resetGuard = vi.fn();
    enterEmmaOnboarding(navigate, resetGuard);
    env.listeners.get('pagehide')?.();
    await performUpdate();
    expect(resetGuard).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps transition B intact when cancelled transition A finishes late', async () => {
    const env = environment();
    const callbacks: Array<() => Promise<void>> = [];
    const finishes: Array<() => void> = [];
    Object.assign(env.doc, { startViewTransition: (callback: () => Promise<void>) => {
      callbacks.push(callback);
      return {
        finished: new Promise<void>(resolve => { finishes.push(resolve); }),
        skipTransition: vi.fn(),
      };
    } });
    const firstNavigate = vi.fn();
    const secondNavigate = vi.fn();
    enterEmmaOnboarding(firstNavigate);
    env.listeners.get('popstate')?.();
    enterEmmaOnboarding(secondNavigate);
    const committed = callbacks[1]();
    finishes[0]();
    await Promise.resolve();
    expect(env.classes.has('emma-entry-transition')).toBe(true);
    expect(env.listeners.size).toBe(2);
    commitEmmaEntrance('/emma/onboarding');
    await committed;
    expect(env.heading.focus).toHaveBeenCalledOnce();
    expect(firstNavigate).not.toHaveBeenCalled();
    expect(secondNavigate).toHaveBeenCalledOnce();
    finishes[1]();
    await Promise.resolve();
    expect(env.classes.size).toBe(0);
    expect(env.listeners.size).toBe(0);
  });
});
