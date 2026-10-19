/** A restored document retains its old service snapshot; read storage again. */
export function watchRestoredPage(target: EventTarget, reload: () => void) {
  const show = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) reload();
  };
  target.addEventListener("pageshow", show);
  return () => target.removeEventListener("pageshow", show);
}
