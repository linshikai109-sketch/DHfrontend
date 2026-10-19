import { describe, expect, it } from 'vitest';
import { trackDialogViewport } from '../src/components/dialog-viewport';

function fixture(withVisualViewport = true) {
  const viewport = Object.assign(new EventTarget(), { height: 420, offsetTop: 110 });
  const host = Object.assign(new EventTarget(), { innerHeight: 800, visualViewport: withVisualViewport ? viewport : null });
  const values = new Map<string, string>();
  const attributes = new Map<string, string>();
  const element = {
    style: { setProperty: (key: string, value: string) => values.set(key, value), removeProperty: (key: string) => { const previous = values.get(key) ?? ''; values.delete(key); return previous; } },
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
  };
  return { viewport, host, values, attributes, element };
}

describe('shared Dialog visible viewport tracking', () => {
  it('uses keyboard-reduced viewport height and panned top, updating at the short boundary', () => {
    const f = fixture();
    const stop = trackDialogViewport(f.element, f.host);
    expect(f.values.get('--dialog-viewport-height')).toBe('420px');
    expect(f.values.get('--dialog-viewport-top')).toBe('110px');
    expect(f.attributes.get('data-viewport-short')).toBe('true');
    f.viewport.height = 480;
    f.viewport.dispatchEvent(new Event('resize'));
    expect(f.attributes.get('data-viewport-short')).toBe('true');
    f.viewport.height = 481;
    f.viewport.offsetTop = 28;
    f.viewport.dispatchEvent(new Event('scroll'));
    expect(f.values.get('--dialog-viewport-top')).toBe('28px');
    expect(f.attributes.get('data-viewport-short')).toBe('false');
    stop();
  });
  it('falls back to window height when visualViewport is absent', () => {
    const f = fixture(false);
    const stop = trackDialogViewport(f.element, f.host);
    expect(f.values.get('--dialog-viewport-height')).toBe('800px');
    expect(f.values.get('--dialog-viewport-top')).toBe('0px');
    f.host.innerHeight = 350;
    f.host.dispatchEvent(new Event('resize'));
    expect(f.values.get('--dialog-viewport-height')).toBe('350px');
    expect(f.attributes.get('data-viewport-short')).toBe('true');
    stop();
  });
  it('removes local properties and every listener on cleanup', () => {
    const f = fixture();
    const stop = trackDialogViewport(f.element, f.host);
    stop();
    for (const target of [f.host, f.viewport]) {
      target.dispatchEvent(new Event('resize'));
      target.dispatchEvent(new Event('scroll'));
    }
    expect([...f.values]).toEqual([]);
    expect([...f.attributes]).toEqual([]);
  });
});
