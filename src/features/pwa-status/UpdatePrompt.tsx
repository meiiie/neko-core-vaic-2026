import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Service-worker update UX (docs/IMPLEMENTATION_MASTER_PLAN.md §8), rendered
 * at App level so EVERY route — including /login — sees it.
 *
 * - Before a workspace is active the update applies automatically: no
 *   work-in-progress exists, and a stale shell talking to a newer API is worse
 *   than a reload.
 * - Inside a workspace the user chooses, so an active diagnostic is never
 *   interrupted silently.
 */
export function UpdatePrompt({ preWorkspace }: { preWorkspace: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (needRefresh && preWorkspace) void updateServiceWorker(true);
  }, [needRefresh, preWorkspace, updateServiceWorker]);

  if (!needRefresh || preWorkspace) {
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
