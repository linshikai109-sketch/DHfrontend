import { afterEach, describe, expect, it, vi } from 'vitest';
import { installEmmaMobileViewport } from '../src/components/emma-mobile-layout';

class TextArea {}
function target() {
  const listeners = new Map<string, (event?: unknown) => void>();
  const styles = new Map<string, string>();
  return {
    listeners, styles,
    addEventListener: (name: string, listener: (event?: unknown) => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
    style: { setProperty: (name: string, value: string) => styles.set(name, value), removeProperty: (name: string) => styles.delete(name) },
  };
}
function fixture(width = 390, height = 844) {
  const root = target(), shell = target(), win = target(), doc = target(), viewport = target(), motion = target();
  Object.assign(viewport, { height, offsetTop: 0 });
  Object.assign(win, { innerWidth: width, innerHeight: height, visualViewport: viewport, matchMedia: () => motion });
  Object.assign(doc, { activeElement: null, hidden: false });
  Object.assign(motion, { matches: false });
  Object.assign(root, { closest: () => shell, contains: () => false });
  const anchor = { getBoundingClientRect: () => {
    const size = parseFloat(root.styles.get('--emma-top-orb-size') ?? '88');
    return { left: (width - size) / 2, top: 10, width: size, height: size };
  } };
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc); vi.stubGlobal('HTMLTextAreaElement', TextArea);
  const settle = vi.fn();
  const cleanup = installEmmaMobileViewport(root as unknown as HTMLElement, anchor as HTMLElement, settle);
  return { root, shell, win, doc, viewport, motion, settle, cleanup };
}
afterEach(() => vi.unstubAllGlobals());

describe('Emma mobile viewport adapter (DOM substitutes, not visual QA)', () => {
  it.each([[320,568,72],[390,844,88],[667,390,64],[390,360,64]])('measures %dx%d with bounded %dpx top footprint', (width,height,size) => {
    const env = fixture(width,height);
    expect(env.root.styles.get('--emma-top-orb-size')).toBe(`${size}px`);
    expect(env.shell.styles.get('--emma-mobile-available-height')).toBe(`${height}px`);
    expect(env.root.styles.get('--emma-orb-dx')).toBe('0px');
    expect(parseFloat(env.root.styles.get('--emma-orb-intro-scale')!)*size).toBeCloseTo(Math.min(176,height*.3));
    env.cleanup();
  });
  it('does not skip the dock when the actual question heading is focused', () => {
    const env=fixture();
    env.root.listeners.get('focusin')?.({ target: { tagName: 'H1' } });
    expect(env.settle).not.toHaveBeenCalled();
    env.cleanup();
  });
  it('settles and preserves a compact orb while text editing gains focus', () => {
    const env=fixture();
    env.root.listeners.get('focusin')?.({ target: new TextArea() });
    expect(env.settle).toHaveBeenCalledOnce();
    expect(env.root.styles.get('--emma-top-orb-size')).toBe('56px');
    env.root.listeners.get('focusout')?.({ relatedTarget: null });
    expect(env.root.styles.get('--emma-top-orb-size')).toBe('88px');
    env.cleanup();
  });
  it('settles and remeasures on reduced keyboard height instead of retaining old coordinates', () => {
    const env=fixture();
    Object.assign(env.viewport,{height:360,offsetTop:20});
    env.viewport.listeners.get('resize')?.();
    expect(env.settle).toHaveBeenCalledOnce();
    expect(env.shell.styles.get('--emma-mobile-available-height')).toBe('360px');
    expect(env.root.styles.get('--emma-orb-dy')).toBe(`${20+360*.53-42}px`);
    env.cleanup();
  });
  it('settles on reduced motion or a hidden page and removes all listeners', () => {
    const env=fixture();
    Object.assign(env.motion,{matches:true});env.motion.listeners.get('change')?.();
    Object.assign(env.doc,{hidden:true});env.doc.listeners.get('visibilitychange')?.();
    expect(env.settle).toHaveBeenCalledTimes(2);
    env.cleanup();
    for(const entry of [env.root,env.win,env.viewport,env.doc,env.motion]) expect(entry.listeners.size).toBe(0);
    expect(env.shell.styles.has('--emma-mobile-available-height')).toBe(false);
  });
});
