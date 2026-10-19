import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ search: '?fixture=v6' }),
}));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useRef: () => ({ current: false }),
}));
import { EmmaEntry } from '../src/components/EmmaEntry';

describe('Emma screenshot entrance', () => {
  beforeEach(() => navigate.mockClear());

  it('restores exact screenshot copy without the previous entry controls', () => {
    const html = renderToStaticMarkup(EmmaEntry());
    expect(html).toContain('emma-gradient-wordmark');
    expect(html).toContain('@dhai</span>');
    expect(html).toContain('caft your skill<br/>leverage AI');
    expect(html).toContain('aria-label="@dhai — caft your skill, leverage AI。进入 Emma 引导"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('继续工作');
    expect(html).not.toContain('整理经历，想清楚下一步');
  });

  it('deduplicates clicks and keeps search parameters without replacing history', () => {
    const entry = EmmaEntry();
    entry.props.onClick();
    entry.props.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ pathname: '/emma/onboarding', search: '?fixture=v6' });
  });

  it.each(['Enter', ' '])('supports %s and allows entry again after a fresh mount', key => {
    const preventDefault = vi.fn();
    const entry = EmmaEntry();
    entry.props.onKeyDown({ key, preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledTimes(1);
    EmmaEntry().props.onClick();
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys', () => {
    EmmaEntry().props.onKeyDown({ key: 'Escape', preventDefault: vi.fn() });
    expect(navigate).not.toHaveBeenCalled();
  });
});
