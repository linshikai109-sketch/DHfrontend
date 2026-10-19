type EntranceTransition = { ready?: Promise<void>; finished: Promise<void>; skipTransition: () => void };
type TransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => EntranceTransition;
};

let pendingCommit: { complete: () => void; cancel: () => void } | undefined;

/** Called after the router's actual DOM commit, never from navigate's return. */
export function commitEmmaEntrance(pathname: string) {
  if (!pendingCommit) return;
  if (pathname === '/emma/onboarding') pendingCommit.complete();
  else if (!/^\/emma\/?$/.test(pathname)) pendingCommit.cancel();
}

/** Animation intent is in memory only, never persisted in history or storage. */
export function enterEmmaOnboarding(navigate: () => void, onCancel = () => {}, options: { focus?: boolean; mobileIntro?: boolean } = {}) {
  if (typeof document === 'undefined') { navigate(); return; }
  pendingCommit?.cancel();
  const doc = document as TransitionDocument;
  const classes = doc.documentElement.classList;
  let updated = false;
  let cancelled = false;
  let cleaned = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let transition: EntranceTransition | undefined;
  let settle: (() => void) | undefined;
  let ownCommit: typeof pendingCommit;

  const clean = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timer);
    classes.remove('emma-entry-transition');
    classes.remove('emma-entry-arriving');
    window.removeEventListener('popstate', cancel);
    window.removeEventListener('pagehide', cancel);
    if (pendingCommit === ownCommit) pendingCommit = undefined;
    settle?.();
  };
  const cancel = () => {
    cancelled = true;
    onCancel();
    transition?.skipTransition();
    clean();
  };
  const update = () => {
    if (updated || cancelled) return Promise.resolve();
    updated = true;
    const committed = new Promise<void>(resolve => { settle = resolve; });
    ownCommit = {
      cancel,
      complete: () => {
        const heading = doc.querySelector<HTMLElement>('.onboarding-layout .question-content h1');
        if (options.focus !== false) {
          heading?.setAttribute('tabindex', '-1');
          heading?.focus({ preventScroll: true });
        }
        if (pendingCommit === ownCommit) pendingCommit = undefined;
        settle?.();
      },
    };
    pendingCommit = ownCommit;
    try { navigate(); } catch (error) { cancel(); throw error; }
    return committed;
  };

  window.addEventListener('popstate', cancel);
  window.addEventListener('pagehide', cancel);
  // Keep the mobile orb live; native root snapshots can freeze WebGL under its overlay.
  if (options.mobileIntro || doc.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    void update().then(clean);
    return;
  }
  const fallback = () => {
    classes.remove('emma-entry-transition');
    if (!cancelled) classes.add('emma-entry-arriving');
    void update().then(() => {
      if (cancelled) return;
      timer = setTimeout(clean, 420);
    });
  };
  if (!doc.startViewTransition) { fallback(); return; }
  classes.add('emma-entry-transition');
  try {
    transition = doc.startViewTransition(update);
    void transition.ready?.catch(() => {});
    void transition.finished.then(clean, () => {
      if (!updated && !cancelled) fallback();
      else clean();
    });
  } catch {
    fallback();
  }
}
