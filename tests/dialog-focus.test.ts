import { describe, expect, it } from 'vitest';
import { canReturnFocus, tabBoundaryTarget } from '../src/components/dialog-focus';

describe('modal Tab boundaries', () => {
  it('wraps in both directions without overriding interior native movement', () => {
    expect(tabBoundaryTarget(['a', 'b', 'c'], 'c', false)).toBe('a');
    expect(tabBoundaryTarget(['a', 'b', 'c'], 'a', true)).toBe('c');
    expect(tabBoundaryTarget(['a', 'b', 'c'], 'b', false)).toBeNull();
    expect(tabBoundaryTarget(['a', 'b', 'c'], 'b', true)).toBeNull();
  });
  it('recovers escaped or removed focus and supports one or zero controls', () => {
    expect(tabBoundaryTarget(['a', 'b'], 'removed', false)).toBe('a');
    expect(tabBoundaryTarget(['a', 'b'], null, true)).toBe('b');
    expect(tabBoundaryTarget(['a'], 'a', true)).toBe('a');
    expect(tabBoundaryTarget([], null, false)).toBeNull();
  });
});


describe('modal focus return eligibility', () => {
  const candidate = (overrides: Record<string, unknown> = {}) => ({
    tagName: 'BUTTON', isConnected: true, tabIndex: 0,
    matches: (selector: string) => selector !== ':disabled',
    closest: () => null, hasAttribute: () => false,
    getClientRects: () => ({ length: 1 }), ...overrides,
  } as unknown as HTMLElement);
  it('skips body and html so a persistent explicit trigger can win', () => {
    const body = candidate({ tagName: 'BODY', tabIndex: -1 });
    const avatar = candidate();
    expect([body, avatar].find(canReturnFocus)).toBe(avatar);
    expect(canReturnFocus(candidate({ tagName: 'HTML' }))).toBe(false);
  });
  it('rejects removed, disabled, hidden and ordinary containers', () => {
    expect(canReturnFocus(candidate({ isConnected: false }))).toBe(false);
    expect(canReturnFocus(candidate({ matches: () => true }))).toBe(false);
    expect(canReturnFocus(candidate({ closest: () => ({}) }))).toBe(false);
    expect(canReturnFocus(candidate({ getClientRects: () => ({ length: 0 }) }))).toBe(false);
    expect(canReturnFocus(candidate({ tagName: 'DIV', tabIndex: -1, matches: () => false }))).toBe(false);
  });
  it('allows intentional programmatic focus targets with tabindex minus one', () => {
    expect(canReturnFocus(candidate({ tagName: 'H2', tabIndex: -1, matches: () => false, hasAttribute: () => true }))).toBe(true);
  });
});
