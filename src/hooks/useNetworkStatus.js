/**
 * useNetworkStatus - React hook for network status
 *
 * Provides real-time online/offline status in React components
 */

import { useState, useEffect } from 'react';
import { NetworkDetector } from '../services/sync';

/**
 * Hook to get current network status
 * @returns {{ isOnline: boolean, wasOffline: boolean }}
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(NetworkDetector.isOnline);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    let resetTimer = null;

    // Subscribe to network changes
    const unsubscribe = NetworkDetector.subscribe((online) => {
      if (!online) {
        setWasOffline(true);
        if (resetTimer) clearTimeout(resetTimer);
      } else if (wasOffline) {
        // Reset wasOffline after 5 seconds so banner logic works on repeat cycles
        resetTimer = setTimeout(() => setWasOffline(false), 5000);
      }
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

export default useNetworkStatus;
