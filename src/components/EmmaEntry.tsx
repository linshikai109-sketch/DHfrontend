import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import FeralSkyGradient from './FeralSkyGradient';
import './EmmaEntry.css';
import { enterEmmaOnboarding } from './emma-entry-transition';
import { isEmmaMobileSurface } from './EmmaMobileOnboarding';
import { cancelEmmaMobileIntroRequest, requestEmmaMobileIntro } from '../domain/emma-mobile-intro';

/** A deliberate entrance to the existing onboarding; it never resets saved work. */
export function EmmaEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const entered = useRef(false);
  const enter = () => {
    if (entered.current) return;
    entered.current = true;
    const mobile = isEmmaMobileSurface();
    const intro = mobile ? requestEmmaMobileIntro() : null;
    enterEmmaOnboarding(
      () => navigate({ pathname: '/emma/onboarding', search: location.search }),
      () => { entered.current = false; if (intro !== null) cancelEmmaMobileIntroRequest(intro); },
      { focus: !mobile || intro === null, mobileIntro: mobile },
    );
  };
  return <div className="emma-gradient-entry" role="button" tabIndex={0}
    aria-label="@dhai — caft your skill, leverage AI。进入 Emma 引导" onClick={enter}
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enter();
      }
    }} style={{ position: 'fixed', inset: 0, cursor: 'pointer', overflow: 'hidden' }}>
    <span className="sr-only">进入 Emma 引导</span>
    <div aria-hidden="true" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <FeralSkyGradient style={{ height: '100%', aspectRatio: 'auto' }} />
      <span className="emma-gradient-wordmark">@dhai</span>
      <span className="emma-gradient-message">caft your skill<br />leverage AI</span>
    </div>
  </div>;
}
