type DialogViewportHost = Pick<Window, 'innerHeight'> & EventTarget & {
  visualViewport: (EventTarget & Pick<VisualViewport, 'height' | 'offsetTop'>) | null;
};
type DialogViewportElement = {
  style: Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

/** Keep geometry on this modal only; the native dialog remains in the top layer. */
export function trackDialogViewport(element: DialogViewportElement, host: DialogViewportHost = window) {
  const viewport = host.visualViewport;
  const update = () => {
    const height = viewport?.height ?? host.innerHeight;
    element.style.setProperty('--dialog-viewport-height', `${height}px`);
    element.style.setProperty('--dialog-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    element.setAttribute('data-viewport-short', String(height <= 480));
  };
  update();
  host.addEventListener('resize', update);
  host.addEventListener('scroll', update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  return () => {
    host.removeEventListener('resize', update);
    host.removeEventListener('scroll', update);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    element.style.removeProperty('--dialog-viewport-height');
    element.style.removeProperty('--dialog-viewport-top');
    element.removeAttribute('data-viewport-short');
  };
}
