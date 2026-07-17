import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Prompt-for-update UX (docs/IMPLEMENTATION_MASTER_PLAN.md §8):
 * a new service worker never auto-reloads the page — the user chooses,
 * so an active diagnostic is never interrupted.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="card" role="alertdialog" aria-label="Có bản cập nhật ứng dụng">
      <p>Có phiên bản mới của NekoPath.</p>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        Cập nhật ngay
      </button>{' '}
      <button type="button" onClick={() => setNeedRefresh(false)}>
        Cập nhật sau
      </button>
    </div>
  );
}
