/**
 * usePaymentIntent — watch a payment_intents row for status changes.
 *
 * Two channels run in parallel:
 *   1. Supabase Realtime postgres_changes on the row id (instant on success)
 *   2. Polling fetch every 5s (fallback for missed Realtime events)
 *
 * Polling stops automatically once the intent reaches a terminal status, so
 * we don't keep hammering the DB after success/expiry.
 *
 * Returns { intent, loading, error }.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase/supabaseClient';

const POLL_INTERVAL_MS = 5000;

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

export function usePaymentIntent(intentId) {
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!intentId || !supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    const fetchOnce = async () => {
      try {
        const { data, error: err } = await supabase
          .from('payment_intents')
          .select('*')
          .eq('id', intentId)
          .single();
        if (!mounted) return;
        if (err) {
          setError(err);
        } else {
          setIntent(data);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOnce();

    const channel = supabase
      .channel(`payment_intent:${intentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_intents',
          filter: `id=eq.${intentId}`,
        },
        (payload) => {
          if (mounted) setIntent(payload.new);
        },
      )
      .subscribe();

    // Polled refetches skip while the tab is backgrounded — realtime
    // continues to push UPDATEs to setIntent, so we stay current without
    // burning queries every 5s on hidden tabs. Poll resumes naturally
    // on the next interval tick once the tab is visible again.
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      fetchOnce();
    };
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      try {
        channel.unsubscribe();
      } catch {
        // realtime cleanup is best-effort
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [intentId]);

  // Once the intent reaches a terminal state, stop polling. The realtime
  // channel hangs around until unmount, but it's idle by then.
  useEffect(() => {
    if (intent?.status && TERMINAL_STATUSES.has(intent.status) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [intent?.status]);

  return { intent, loading, error };
}
