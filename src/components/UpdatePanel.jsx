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
};

export default function UpdatePanel() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState('');

  async function performUpdate() {
    setStatus(STATUS.UPDATING);
    setMessage('Updating to the latest version…');

    if (!('serviceWorker' in navigator)) {
      // No SW support — just hard-reload with cache busting.
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
    reloadWithCacheBust();
  }

  function reloadWithCacheBust() {
    const u = new URL(window.location.origin + '/');
    u.searchParams.set('_t', Date.now().toString());
    window.location.replace(u.toString());
  }

  const isBusy = status === STATUS.UPDATING;

  return (
    <div>
      {(status === STATUS.UPDATING || status === STATUS.ERROR) && (
        <div
          style={{ ...styles.statusBox, ...statusStyle(status) }}
          role="status"
          aria-live="polite"
        >
          <strong style={{ display: 'block', marginBottom: '4px' }}>
            {status === STATUS.UPDATING ? 'Updating…' : 'Something went wrong'}
          </strong>
          <span style={{ fontSize: '0.9rem' }}>{message}</span>
        </div>
      )}

      <button
        type="button"
        onClick={performUpdate}
        disabled={isBusy}
        style={{ ...styles.btn, ...styles.btnPrimary }}
      >
        {isBusy ? 'Updating…' : 'Update'}
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
  hint: {
    marginTop: 12,
    fontSize: '0.85rem',
    color: '#6B7280',
    lineHeight: 1.5,
  },
};
