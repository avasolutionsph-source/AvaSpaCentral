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
    // Subscribe to network changes
    const unsubscribe = NetworkDetector.subscribe((online) => {
      if (!online) {
        setWasOffline(true);
      }
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline, wasOffline };
}

export default useNetworkStatus;
