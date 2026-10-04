import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
  dismissWasOffline: () => void;
  resetWasOffline: () => void;
}

export function useNetworkStatus(): NetworkStatus {
  // Always starts `true` so the server-rendered HTML and the client's first
  // render match (Node exposes a partial `navigator` global without
  // `.onLine`, so reading it during the initial render would otherwise
  // diverge from the browser and trigger a hydration mismatch). The real
  // value is applied client-side immediately after mount, below.
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<number | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(Date.now());
      setWasOffline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(Date.now());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dismissWasOffline = () => setWasOffline(false);

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    lastOfflineAt,
    dismissWasOffline,
    resetWasOffline: dismissWasOffline,
  };
}
