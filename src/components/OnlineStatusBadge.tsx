import { useEffect, useState } from 'react';

/**
 * Connectivity indicator. `navigator.onLine === false` reliably means offline;
 * `true` only means "not known to be offline". Full "Sẵn sàng dùng ngoại tuyến"
 * wording is deferred until service-worker readiness is actually verified
 * (docs/IMPLEMENTATION_MASTER_PLAN.md §8).
 */
export function OnlineStatusBadge() {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <span
      className={
        online ? 'status-label status-label--evidence' : 'status-label status-label--review'
      }
      role="status"
      aria-live="polite"
    >
      {online ? 'Đang trực tuyến' : 'Đang ngoại tuyến'}
    </span>
  );
}
