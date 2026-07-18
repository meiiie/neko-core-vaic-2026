import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Service-worker update UX (docs/IMPLEMENTATION_MASTER_PLAN.md §8), rendered
 * at App level so EVERY route — including /login — sees it.
 *
 * - On /login the update applies automatically: no work-in-progress exists
 *   before sign-in, and a stale shell talking to a newer API is worse than a
 *   reload (a not-yet-signed-in visitor would otherwise stay stuck on the old
 *   build forever, since they could never reach the in-app prompt).
 * - Everywhere else the user chooses, so an active diagnostic is never
 *   interrupted by a silent reload.
 */
export function UpdatePrompt() {
  const location = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const onLogin = location.pathname === '/login';

  useEffect(() => {
    if (needRefresh && onLogin) void updateServiceWorker(true);
  }, [needRefresh, onLogin, updateServiceWorker]);

  if (!needRefresh || onLogin) {
    return null;
  }

  return (
    <div className="update-prompt" role="alertdialog" aria-label="Có bản cập nhật ứng dụng">
      <p>Có phiên bản mới của NekoPath.</p>
      <button
        className="button-primary"
        type="button"
        onClick={() => void updateServiceWorker(true)}
      >
        Cập nhật ngay
      </button>{' '}
      <button className="button-secondary" type="button" onClick={() => setNeedRefresh(false)}>
        Cập nhật sau
      </button>
    </div>
  );
}
