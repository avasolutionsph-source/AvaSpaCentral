import React, { useState } from 'react';
import { db } from '../db';

/**
 * Single-button PWA updater + sync-recovery. Used by both the public
 * /update recovery page and the in-app /app-update page. One click does
 * everything a non-technical user might need to recover from a stuck app:
 *
 *   1. Clear Cache Storage API entries (workbox precache + runtime caches)
 *      so stale assets aren't served.
 *   2. Unregister the service worker so the next load fetches a fresh
 *      sw.js and re-installs.
 *   3. Reset stuck sync-queue items (anything left as 'processing' from a
 *      previous interrupted run, plus 'failed' items so they retry).
 *      Pending writes are preserved and still get pushed after reload.
 *   4. Clear sync metadata (last-pull timestamps) so the next sync after
 *      reload re-pulls every table from cloud — fixes the "no data after
 *      cross-device login" symptom without touching local records.
 *   5. Reload with a cache-busting query param so the HTML/JS round-trip
 *      skips the HTTP cache too.
 *
 * IndexedDB row data (Dexie tables) is intentionally NOT cleared — local
 * offline records and the pending sync queue must survive the update.
 * Only sync bookkeeping (queue status flags + metadata timestamps) is
 * touched, which is non-destructive.
 */

const STATUS = {
  IDLE: 'idle',
  UPDATING: 'updating',
  ERROR: 'error',
  JUST_UPDATED: 'just_updated',
};

// sessionStorage flag set right before the cache-busting reload, then read
// on the next mount so the user lands on a "✓ Updated" state instead of
// the bare Update button — without that confirmation users assume the
// click did nothing and keep tapping.
const POST_UPDATE_FLAG = 'daet-spa-post-update';

export default function UpdatePanel() {
  const [status, setStatus] = useState(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(POST_UPDATE_FLAG)) {
        sessionStorage.removeItem(POST_UPDATE_FLAG);
        return STATUS.JUST_UPDATED;
      }
    } catch {}
    return STATUS.IDLE;
  });
  const [message, setMessage] = useState('');

  async function performUpdate() {
    setStatus(STATUS.UPDATING);
    setMessage('Updating to the latest version…');

    if (!('serviceWorker' in navigator)) {
      // No SW support — just hard-reload with cache busting.
      markPostUpdateFlag();
      reloadWithCacheBust();
      return;
    }

    if (!navigator.onLine) {
      setStatus(STATUS.ERROR);
      setMessage('You appear to be offline. Connect to the internet and try again.');
      return;
    }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch (err) {
      setStatus(STATUS.ERROR);
      setMessage(`Update failed: ${err?.message || err}. Try closing and reopening the app.`);
      return;
    }

    // Best-effort sync recovery. Non-fatal — if Dexie isn't available
    // (e.g. private mode, very early load on /update before the app boots)
    // we still want the cache/SW reset and the reload to proceed.
    try {
      await resetStuckSyncState();
    } catch (err) {
      console.warn('[UpdatePanel] Sync recovery skipped:', err?.message || err);
    }

    setMessage('Reloading…');
    markPostUpdateFlag();
    reloadWithCacheBust();
  }

  async function resetStuckSyncState() {
    if (!db?.syncQueue || !db?.syncMetadata) return;

    // Move 'processing' items back to 'pending' — these were mid-flight
    // when the app last died/froze and would otherwise sit forever.
    // Also revive 'failed' items so the next sync gives them a fresh try.
    const stuck = await db.syncQueue
      .filter((item) => item.status === 'processing' || item.status === 'failed' || item.status === 'parked')
      .toArray();
    for (const item of stuck) {
      await db.syncQueue.update(item.id, {
        status: 'pending',
        retryCount: 0,
        nextRetryAt: null,
      });
    }
    if (stuck.length > 0) {
      console.log(`[UpdatePanel] Revived ${stuck.length} stuck sync queue items`);
    }

    // Wiping sync metadata makes the next _pullChanges treat every table
    // as "never synced", so it pulls the full server state. Local rows
    // with pending writes are protected by the pending-id check inside
    // _pullChanges, so this is safe.
    await db.syncMetadata.clear();
    console.log('[UpdatePanel] Cleared sync metadata - next sync will pull all tables from cloud');
  }

  function markPostUpdateFlag() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(POST_UPDATE_FLAG, '1');
      }
    } catch {}
  }

  function reloadWithCacheBust() {
    // Land on /login after the cache-bust reload. The site root (/) is the
    // public booking page — sending POS / staff users there after an in-app
    // update drops them out of the app. /login forwards already-authenticated
    // sessions to their role's default route.
    const u = new URL(window.location.origin + '/login');
    u.searchParams.set('_t', Date.now().toString());
    window.location.replace(u.toString());
  }

  const isBusy = status === STATUS.UPDATING;
  const justUpdated = status === STATUS.JUST_UPDATED;

  return (
    <div>
      {(status === STATUS.UPDATING || status === STATUS.ERROR || justUpdated) && (
        <div
          style={{ ...styles.statusBox, ...statusStyle(status) }}
          role="status"
          aria-live="polite"
        >
          <strong style={{ display: 'block', marginBottom: '4px' }}>
            {status === STATUS.UPDATING && 'Updating…'}
            {status === STATUS.ERROR && 'Something went wrong'}
            {justUpdated && '✓ App is up to date'}
          </strong>
          <span style={{ fontSize: '0.9rem' }}>
            {justUpdated
              ? 'You are on the latest version. No need to tap Update again.'
              : message}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={performUpdate}
        disabled={isBusy}
        style={{ ...styles.btn, ...styles.btnPrimary, ...(justUpdated ? styles.btnMuted : {}) }}
      >
        {isBusy ? 'Updating…' : justUpdated ? 'Update again' : 'Update'}
      </button>

      <p style={styles.hint}>
        Pulls the latest version, clears cached files, and refreshes data
        from the cloud. Your offline records and pending uploads stay intact.
      </p>
    </div>
  );
}

function statusStyle(status) {
  if (status === STATUS.ERROR) {
    return { background: '#FEF2F2', borderColor: '#EF4444', color: '#991B1B' };
  }
  if (status === STATUS.JUST_UPDATED) {
    return { background: '#ECFDF5', borderColor: '#10B981', color: '#065F46' };
  }
  return { background: '#F3F4F6', borderColor: '#D1D5DB', color: '#374151' };
}

const styles = {
  statusBox: {
    border: '1px solid', borderRadius: 10,
    padding: '12px 14px', marginBottom: 16,
    minHeight: 56,
  },
  btn: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid transparent',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.05s',
  },
  btnPrimary: {
    background: '#7F1D1D',
    color: '#fff',
  },
  // Softer styling once the app has just updated, so the next "Update
  // again" press feels deliberate rather than reflexive.
  btnMuted: {
    background: '#fff',
    color: '#7F1D1D',
    borderColor: '#7F1D1D',
  },
  hint: {
    marginTop: 12,
    fontSize: '0.85rem',
    color: '#6B7280',
    lineHeight: 1.5,
  },
};
