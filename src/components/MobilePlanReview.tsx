import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './plan-review.css';

export function reviewViewport(viewport: { height: number; offsetTop: number } | null, fallbackHeight: number) {
  return { height: Math.max(0, viewport?.height ?? fallbackHeight), top: Math.max(0, viewport?.offsetTop ?? 0) };
}

export function shouldRearmReviewHistory(cancelled: boolean, connected: boolean, open: boolean, currentPath: string, reviewPath: string) {
  return !cancelled && connected && open && currentPath === reviewPath;
}

export function canRestoreReviewFocus(candidate: { tagName: string; connected: boolean; disabled: boolean; visible: boolean }) {
  return !['BODY', 'HTML', 'INPUT', 'TEXTAREA'].includes(candidate.tagName) && candidate.connected && !candidate.disabled && candidate.visible;
}

/** Focus does not depend on paint: animation frames may be suspended after Back. */
export function scheduleReviewFocusRestore(restore: () => void, allowed: () => boolean = () => true) {
  queueMicrotask(() => { if (allowed()) restore(); });
}

function restoreReviewFocus(previous: HTMLElement | null) {
  const valid = (element: HTMLElement | null): element is HTMLElement => !!element && canRestoreReviewFocus({
    tagName: element.tagName,
    connected: element.isConnected,
    disabled: element.matches(':disabled, [aria-disabled="true"]'),
    visible: element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible' && !element.closest('[inert]'),
  });
  const controls = document.querySelectorAll<HTMLElement>('.discussion-dock .voice-mobile-text-alternative, .discussion-dock .voice-visual-trigger, .discussion-dock button[aria-label="文字输入"], button[aria-label="个人菜单"]');
  for (const target of [previous, ...controls]) {
    if (!valid(target)) continue;
    target.focus({ preventScroll: true });
    if (document.activeElement === target) return;
  }

}

/** Native modality protects focus while the proposal is reviewed. */
export function MobilePlanReview({ title, children, footer, onCancel, returnFocus }: { returnFocus?: HTMLElement | null; title: string; children: ReactNode; footer: ReactNode; onCancel: () => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useLayoutEffect(() => {
    const element = dialog.current!;
    const previous = returnFocus || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    previous?.blur();
    const resize = () => {
      const bounds = reviewViewport(window.visualViewport, window.innerHeight);
      element.style.setProperty('--review-height', `${bounds.height}px`);
      element.style.setProperty('--review-top', `${bounds.top}px`);
      const body = element.querySelector<HTMLElement>('.mobile-review-body');
      const header = element.querySelector('header');
      const footer = element.querySelector('footer');
      const content = element.querySelector('.mobile-review-content');
      if (body && header && footer && content && element.open) {
        const padding = getComputedStyle(body);
        const naturalHeight = header.getBoundingClientRect().height + content.getBoundingClientRect().height + parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom) + footer.getBoundingClientRect().height;
        element.style.height = `${Math.min(naturalHeight, Math.max(0, bounds.height - 16))}px`;
      }
    };
    resize();
    element.showModal();
    resize();
    const observer = new ResizeObserver(resize);
    for (const child of element.querySelectorAll('header, footer, .mobile-review-content')) observer.observe(child);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const marker = crypto.randomUUID();
    const reviewPath = window.location.pathname + window.location.search;
    let active = true;
    let cancelling = false;
    const arm = () => history.pushState({ ...history.state, planReview: marker }, '');
    arm();
    const back = async () => {
      if (history.state?.planReview === marker) return;
      const currentPath = window.location.pathname + window.location.search;
      if (cancelling) {
        if (active && element.isConnected && element.open && currentPath === reviewPath) arm();
        return;
      }
      cancelling = true;
      let cancelled = false;
      try { cancelled = await cancel.current(); } finally {
        cancelling = false;
        if (active && history.state?.planReview !== marker && shouldRearmReviewHistory(cancelled, element.isConnected, element.open, window.location.pathname + window.location.search, reviewPath)) arm();
      }
    };
    window.addEventListener('popstate', back);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('popstate', back);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      element.close();
      document.body.style.overflow = originalOverflow;
      const restore = () => {
        if (!document.querySelector('dialog[open]') && window.location.pathname + window.location.search === reviewPath) restoreReviewFocus(previous);
      };
      // The modal's history entry is asynchronous: restore again after Back settles,
      // only if the browser left focus on the document rather than a user control.
      if (history.state?.planReview === marker) {
        const afterBack = () => {
          clearTimeout(timeout);
          scheduleReviewFocusRestore(restore, () => document.activeElement === document.body);
        };
        window.addEventListener('popstate', afterBack, { once: true });
        const timeout = window.setTimeout(() => window.removeEventListener('popstate', afterBack), 500);
        history.back();
      }
      scheduleReviewFocusRestore(restore);
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="mobile-plan-review" aria-labelledby="mobile-review-title" onCancel={event => { event.preventDefault(); void cancel.current(); }}>
    <header><h2 id="mobile-review-title">计划变化预览</h2><p>{title}</p></header>
    <div id="workbench-plan-change" className="plan-proposal mobile-review-body" aria-label="计划变化预览" tabIndex={-1}><div className="mobile-review-content">{children}</div></div>
    <footer>{footer}</footer>
  </dialog>, document.body);
}
