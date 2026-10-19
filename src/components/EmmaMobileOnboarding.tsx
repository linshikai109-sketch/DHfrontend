import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { createMobileIntroRun, EMMA_MOBILE_INTRO_CONFIG, markEmmaMobileIntroSeen, takeEmmaMobileIntro, type MobileIntroPhase } from '../domain/emma-mobile-intro';
import './emma-mobile-onboarding.css';
import { installEmmaMobileViewport } from './emma-mobile-layout';

export const EMMA_MOBILE_QUERY = '(max-width: 767px), (max-width: 1024px) and (max-height: 480px) and (pointer: coarse)';
type MobileOrbContext = { anchor: HTMLDivElement | null; preparing: boolean };
const OrbContext = createContext<MobileOrbContext | null>(null);
export const useEmmaMobileOrb = () => useContext(OrbContext);
export const isEmmaMobileSurface = () => typeof window !== 'undefined' && window.matchMedia(EMMA_MOBILE_QUERY).matches;

/** This adapter owns presentation only; the existing question and voice session stay mounted. */
export function EmmaMobileOnboarding({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(isEmmaMobileSurface);
  const [request] = useState(() => mobile ? takeEmmaMobileIntro() : null);
  const [phase, setPhase] = useState<MobileIntroPhase>(request === null || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'settled' : 'idle');
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [waiting, setWaiting] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createMobileIntroRun> | null>(null);
  const focused = useRef(false);
  const navigate = useNavigate();
  const playing = mobile && phase !== 'settled' && phase !== 'cancelled';
  const questionReady = !playing || phase === 'question-ready';
  const settle = () => controller.current?.skip();

  useEffect(() => {
    const media = window.matchMedia(EMMA_MOBILE_QUERY);
    const change = () => { settle(); setMobile(media.matches); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useLayoutEffect(() => {
    if (!mobile || !anchor || !surface.current) return;
    return installEmmaMobileViewport(surface.current, anchor, settle);
  }, [anchor, mobile]);

  useEffect(() => {
    if (!mobile || request === null) return;
    const run = createMobileIntroRun(next => {
      setPhase(next);
      if (next === 'question-ready' || next === 'settled') markEmmaMobileIntroSeen();
      if (next === 'settled' || next === 'cancelled') detach();
    });
    controller.current = run;
    const cancel = () => run.cancel();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && run.getPhase() !== 'settled' && run.getPhase() !== 'cancelled') {
        event.preventDefault(); run.skip();
      }
    };
    const detach = () => {
      window.removeEventListener('pagehide', cancel);
      window.removeEventListener('popstate', cancel);
      window.removeEventListener('keydown', key);
    };
    window.addEventListener('pagehide', cancel);
    window.addEventListener('popstate', cancel);
    window.addEventListener('keydown', key);
    run.start();
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) run.skip();
    else surface.current?.querySelector<HTMLButtonElement>('.emma-mobile-intro-actions button')?.focus({ preventScroll: true });
    return () => {
      run.cancel(); controller.current = null;
      detach();
    };
  }, [request]);

  useEffect(() => {
    // Review/completed recovery may legitimately contain no voice surface.
    if (mobile && request !== null && anchor && !anchor.querySelector('.voice-visual-trigger')) settle();
  }, [anchor, request, mobile]);

  useLayoutEffect(() => {
    if (!mobile || !questionReady || phase === 'cancelled' || request === null || focused.current) return;
    const title = surface.current?.querySelector<HTMLElement>('.question-content h1');
    if (!title) { setWaiting(true); return; }
    setWaiting(false);
    focused.current = true;
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  }, [mobile, questionReady, request, phase]);

  return <OrbContext.Provider value={mobile ? { anchor, preparing: playing } : null}>
    <div ref={surface} className={mobile ? 'emma-mobile-onboarding' : 'emma-onboarding-adapter'} data-intro-phase={phase} data-intro-playing={playing} onKeyDown={event => {
      if (playing && event.key === 'Escape') { event.preventDefault(); settle(); }
    }}>
      <div ref={setAnchor} className="emma-mobile-orb-anchor" hidden={!mobile} aria-hidden={playing} aria-label="语音" />
      <div key="questions" className="emma-mobile-question-surface" inert={!questionReady} aria-hidden={!questionReady}>
        {waiting && <section className="emma-mobile-loading" role="status">
          <p>问题尚未准备好。</p>
          <button type="button" onClick={() => window.location.reload()}>重试</button>
          <button type="button" onClick={() => navigate(-1)}>返回</button>
        </section>}
        {children}
      </div>
      {playing && <div className="emma-mobile-intro-stage" role="region" aria-label="准备引导">
        <p className="emma-mobile-intro-copy">{EMMA_MOBILE_INTRO_CONFIG.copy}</p>
        <div className="emma-mobile-intro-actions">
          <button type="button" onClick={settle}>跳过动画</button>
          <button type="button" onClick={() => { controller.current?.cancel(); navigate(-1); }}>返回</button>
        </div>
      </div>}
    </div>
  </OrbContext.Provider>;
}
