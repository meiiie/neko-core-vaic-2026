import { useState } from 'react';

/**
 * Test stub for `virtual:pwa-register/react`. The real virtual module only
 * exists inside the Vite plugin pipeline; vitest resolves this stub via the
 * alias in vite.config.ts.
 */
export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  };
}
