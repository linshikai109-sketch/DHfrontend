/** Mobile viewport adapter. Focus on a question is not an instruction to skip. */
export function installEmmaMobileViewport(root: HTMLElement, anchor: HTMLElement, settle: () => void) {
const shell = root.closest<HTMLElement>('.product-shell');
let editing = root.contains(document.activeElement) && document.activeElement instanceof HTMLTextAreaElement;
const measure = () => {
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  shell?.style.setProperty('--emma-mobile-available-height', `${height}px`);
  root.style.setProperty('--emma-top-orb-size', `${editing ? 56 : height <= 480 ? 64 : height <= 600 ? 72 : 88}px`);
  const rect = anchor.getBoundingClientRect();
  root.style.setProperty('--emma-orb-dx', `${window.innerWidth / 2 - (rect.left + rect.width / 2)}px`);
  root.style.setProperty('--emma-orb-dy', `${(viewport?.offsetTop ?? 0) + height * .53 - (rect.top + rect.height / 2)}px`);
  root.style.setProperty('--emma-orb-intro-scale', `${Math.min(176, height * .3) / Math.max(1, rect.height)} `);
};
measure();
const resize = () => { settle(); measure(); };
const focusIn = (event: FocusEvent) => {
  editing = event.target instanceof HTMLTextAreaElement;
  if (editing) settle();
  measure();
};
const focusOut = (event: FocusEvent) => {
  editing = event.relatedTarget instanceof HTMLTextAreaElement;
  measure();
};
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduce = () => { if (motion.matches) settle(); };
const hide = () => { if (document.hidden) settle(); };
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.visualViewport?.addEventListener('scroll', resize);
motion.addEventListener('change', reduce);
document.addEventListener('visibilitychange', hide);
root.addEventListener('focusin', focusIn);
root.addEventListener('focusout', focusOut);
  return () => {
  shell?.style.removeProperty('--emma-mobile-available-height');
  window.removeEventListener('resize', resize);
  window.visualViewport?.removeEventListener('resize', resize);
  window.visualViewport?.removeEventListener('scroll', resize);
  motion.removeEventListener('change', reduce);
  document.removeEventListener('visibilitychange', hide);
  root.removeEventListener('focusin', focusIn);
  root.removeEventListener('focusout', focusOut);
};
}
