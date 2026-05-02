/**
 * useDisbursement — watch a disbursements row for status changes.
 *
 * Realtime subscription on the row id, plus a 10s polling fallback (longer
 * than usePaymentIntent's 5s because disbursement settlement is slower —
 * usually minutes, sometimes hours, vs QRPh which settles in seconds).
 *
 * Polling stops automatically once the row reaches a terminal status.
 *
 * Returns { disbursement, loading, error }.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase/supabaseClient';

const POLL_INTERVAL_MS = 10_000;

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export function useDisbursement(disbursementId) {
  const [disbursement, setDisbursement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!disbursementId || !supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    const fetchOnce = async () => {
      try {
        const { data, error: err } = await supabase
          .from('disbursements')
          .select('*')
          .eq('id', disbursementId)
          .single();
        if (!mounted) return;
        if (err) setError(err);
        else { setDisbursement(data); setError(null); }
      } catch (e) {
        if (mounted) setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOnce();

    const channel = supabase
      .channel(`disbursement:${disbursementId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'disbursements',
          filter: `id=eq.${disbursementId}`,
        },
        (payload) => { if (mounted) setDisbursement(payload.new); },
      )
      .subscribe();

    pollRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      try { channel.unsubscribe(); } catch { /* best effort */ }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [disbursementId]);

  useEffect(() => {
    if (disbursement?.status && TERMINAL_STATUSES.has(disbursement.status) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [disbursement?.status]);

  return { disbursement, loading, error };
}
