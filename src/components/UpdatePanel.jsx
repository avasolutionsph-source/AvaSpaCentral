import React, { useState } from 'react';

/**
 * Single-button PWA updater. Used by both the public /update recovery
 * page and the in-app /app-update page.
 *
 * One click pulls the latest build by:
 *   1. Clearing the Cache Storage API entries (workbox precache + runtime
 *      caches) so stale assets aren't served.
 *   2. Unregistering the service worker so the next page load fetches a
 *      fresh sw.js and re-installs.
 *   3. Reloading with a cache-busting query param so the HTML/JS round-
 *      trip skips the HTTP cache too.
 *
 * IndexedDB (Dexie) is intentionally NOT cleared — local offline records
 * and the pending sync queue must survive the update.
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

    setMessage('Reloading…');
    markPostUpdateFlag();
    reloadWithCacheBust();
  }

  function markPostUpdateFlag() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(POST_UPDATE_FLAG, '1');
      }
    } catch {}
  }

  function reloadWithCacheBust() {
    const u = new URL(window.location.origin + '/');
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
        Pulls the latest version and clears cached files, then reloads.
        Your offline records and pending sync queue stay intact.
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
