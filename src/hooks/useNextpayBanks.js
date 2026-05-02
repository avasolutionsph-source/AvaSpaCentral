/**
 * useNextpayBanks — fetch the live NextPay bank catalog once per session
 * and cache in module-level memory.
 *
 * The bank list rarely changes (NextPay rolls out new banks every few
 * months). One fetch per browser session is fine; subsequent components
 * read from the cached promise. Refetch happens only after a hard reload.
 */
import { useEffect, useState } from 'react';
import { listNextpayBanks } from '../services/payments';

let cachedPromise = null;

function loadBanksOnce() {
  if (!cachedPromise) {
    cachedPromise = listNextpayBanks({ limit: 200 }).catch((e) => {
      // Reset the cache on failure so the next caller can retry.
      cachedPromise = null;
      throw e;
    });
  }
  return cachedPromise;
}

export function useNextpayBanks() {
  const [banks, setBanks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    loadBanksOnce()
      .then((res) => {
        if (!mounted) return;
        // Sort enabled banks first, then alphabetical by short label.
        const sorted = (res?.data ?? []).slice().sort((a, b) => {
          if (a.status !== b.status) {
            if (a.status === 'enabled') return -1;
            if (b.status === 'enabled') return 1;
          }
          return (a.label_short ?? a.label ?? '').localeCompare(
            b.label_short ?? b.label ?? '',
          );
        });
        setBanks(sorted);
      })
      .catch((e) => { if (mounted) setError(e); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return { banks, loading, error };
}
