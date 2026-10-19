import {useLayoutEffect, useRef, type ReactNode} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {retainRuntimeSearch} from '../domain/runtime-routing';

/** Keep runtime identity in the address bar before paint, including guard redirects.
 * Path, page flags, hash, history state and business destinations remain unchanged.
 */
export function RuntimeRouting({children}: {children: ReactNode}) {
  const location = useLocation();
  const navigate = useNavigate();
  const retained = useRef(location.search);
  const search = retainRuntimeSearch(location.search, retained.current);
  useLayoutEffect(() => {
    retained.current = search;
    if (search !== location.search) {
      navigate({pathname: location.pathname, search, hash: location.hash}, {replace: true, state: location.state});
    }
  }, [location.pathname, location.search, location.hash, location.state, navigate, search]);
  return children;
}
