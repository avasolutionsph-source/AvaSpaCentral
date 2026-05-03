import React, { useEffect, useRef, useState } from 'react';

/**
 * Public /update page.
 *
 * A no-login utility for end users (therapists, riders, owners) to pull
 * the latest build of the installed PWA without having to uninstall and
 * reinstall the app. The page:
 *
 *   1. Asks the active service worker to check for an update.
 *   2. Reports current state (up to date / new version available / etc.).
 *   3. Offers a "Force refresh" that bypasses HTTP cache and reloads.
 *   4. Offers a nuclear "Hard reset" that unregisters the service worker
 *      and clears the Cache Storage API entries, then reloads — for the
 *      occasional device stuck on a broken old SW. IndexedDB (Dexie) is
 *      deliberately NOT cleared so local sync queue items survive.
 *
 * Kept entirely public (no auth, no MainLayout) so a user with a broken
 * cached app can still reach this page and recover.
 */

const STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  UP_TO_DATE: 'up_to_date',
  UPDATE_AVAILABLE: 'update_available',
  APPLYING: 'applying',
  RESETTING: 'resetting',
  ERROR: 'error',
  UNSUPPORTED: 'unsupported',
};

export default function Update() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState(null);
  const checkedOnceRef = useRef(false);

  // Auto-check on first mount so users see results immediately.
  useEffect(() => {
    if (checkedOnceRef.current) return;
    checkedOnceRef.current = true;
    checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getRegistration() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg || null;
    } catch {
      return null;
    }
  }

  async function checkForUpdate() {
    setStatus(STATUS.CHECKING);
    setMessage('Contacting server for the latest version…');
    setDetails(null);

    if (!('serviceWorker' in navigator)) {
      setStatus(STATUS.UNSUPPORTED);
      setMessage('This browser does not support service workers, so this page cannot manage updates. Please close and reopen the app.');
      return;
    }

    if (!navigator.onLine) {
      setStatus(STATUS.ERROR);
      setMessage('You appear to be offline. Connect to the internet and try again.');
      return;
    }

    const registration = await getRegistration();
    if (!registration) {
      setStatus(STATUS.ERROR);
      setMessage('No service worker is registered yet. Please open the app at the home page once, then return to /update.');
      return;
    }

    try {
      // Trigger a fresh check against the server. This re-fetches sw.js
      // and, if the bytes changed, kicks off the install lifecycle.
      await registration.update();
    } catch (err) {
      setStatus(STATUS.ERROR);
      setMessage(`Could not reach the server to check for updates: ${err?.message || err}`);
      return;
    }

    // After update(), inspect what the lifecycle produced.
    const installing = registration.installing;
    const waiting = registration.waiting;

    if (installing || waiting) {
      setStatus(STATUS.UPDATE_AVAILABLE);
      setMessage('A newer version is available. Tap "Apply update" to switch over.');
      // If a new SW is installing, watch it and auto-promote when it finishes.
      const sw = waiting || installing;
      if (sw) {
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') {
            // Reload so the page is controlled by the new SW.
            window.location.reload();
          }
        });
      }
      return;
    }

    setStatus(STATUS.UP_TO_DATE);
    setMessage('You already have the latest version installed.');
    setDetails({
      scope: registration.scope,
      active: !!registration.active,
    });
  }

  async function applyUpdate() {
    setStatus(STATUS.APPLYING);
    setMessage('Applying the new version…');
    const registration = await getRegistration();
    const waitingSW = registration?.waiting;
    if (waitingSW) {
      // Tell the waiting SW to activate immediately, then reload.
      waitingSW.postMessage({ type: 'SKIP_WAITING' });
      // When the new SW takes control, reload to swap clients.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      }, { once: true });
      // Safety fallback: if controllerchange doesn't fire within 3s, force reload.
      setTimeout(() => window.location.reload(), 3000);
    } else {
      // Just reload — the SW already took over via skipWaiting/clientsClaim.
      window.location.reload();
    }
  }

  async function forceRefresh() {
    setStatus(STATUS.APPLYING);
    setMessage('Reloading with a fresh fetch…');
    // Bust the HTTP cache for navigation by appending a timestamp param,
    // which forces a network round-trip even if the SW would normally
    // serve from cache.
    const u = new URL(window.location.origin + '/');
    u.searchParams.set('_t', Date.now().toString());
    window.location.replace(u.toString());
  }

  async function hardReset() {
    const confirmed = window.confirm(
      'Hard reset will unregister the service worker and clear the app cache, ' +
        'then reload. Local data (your offline records, sync queue) is preserved. Continue?'
    );
    if (!confirmed) return;

    setStatus(STATUS.RESETTING);
    setMessage('Clearing cached assets…');

    try {
      // Clear Cache Storage API entries (workbox precache + runtime caches).
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Unregister all service workers so the next load installs a fresh one.
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (err) {
      setStatus(STATUS.ERROR);
      setMessage(`Hard reset hit an error: ${err?.message || err}. You can try closing and reopening the app.`);
      return;
    }

    setMessage('Reloading…');
    // Bust HTTP cache too.
    const u = new URL(window.location.origin + '/');
    u.searchParams.set('_t', Date.now().toString());
    window.location.replace(u.toString());
  }

  const isBusy =
    status === STATUS.CHECKING ||
    status === STATUS.APPLYING ||
    status === STATUS.RESETTING;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.iconWrap} aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </div>
        <h1 style={styles.title}>Update App</h1>
        <p style={styles.subtitle}>
          Pull the latest version of Daet Massage &amp; Spa without reinstalling.
        </p>

        <div style={{ ...styles.statusBox, ...statusStyle(status) }} role="status" aria-live="polite">
          <strong style={{ display: 'block', marginBottom: '4px' }}>{statusLabel(status)}</strong>
          <span style={{ fontSize: '0.9rem' }}>{message || ' '}</span>
          {details && (
            <div style={styles.detailsRow}>
              <span>Scope: <code>{details.scope}</code></span>
            </div>
          )}
        </div>

        <div style={styles.buttonStack}>
          {status === STATUS.UPDATE_AVAILABLE ? (
            <button
              type="button"
              onClick={applyUpdate}
              disabled={isBusy}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              Apply update &amp; reload
            </button>
          ) : (
            <button
              type="button"
              onClick={checkForUpdate}
              disabled={isBusy}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              {status === STATUS.CHECKING ? 'Checking…' : 'Check for updates'}
            </button>
          )}

          <button
            type="button"
            onClick={forceRefresh}
            disabled={isBusy}
            style={{ ...styles.btn, ...styles.btnSecondary }}
          >
            Force refresh now
          </button>

          <button
            type="button"
            onClick={hardReset}
            disabled={isBusy}
            style={{ ...styles.btn, ...styles.btnDanger }}
          >
            Hard reset (clear cache)
          </button>

          <a href="/" style={styles.backLink}>
            ← Back to app
          </a>
        </div>

        <details style={styles.faq}>
          <summary>What does each button do?</summary>
          <ul style={styles.faqList}>
            <li>
              <strong>Check for updates</strong> — asks the server if a newer
              build exists and downloads it in the background.
            </li>
            <li>
              <strong>Force refresh now</strong> — reloads the app and skips
              the HTTP cache so the very latest HTML/JS is fetched.
            </li>
            <li>
              <strong>Hard reset</strong> — unregisters the service worker
              and clears cached files. Your offline records stay intact.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}

function statusLabel(status) {
  switch (status) {
    case STATUS.CHECKING: return 'Checking…';
    case STATUS.UP_TO_DATE: return 'Up to date';
    case STATUS.UPDATE_AVAILABLE: return 'Update available';
    case STATUS.APPLYING: return 'Applying update';
    case STATUS.RESETTING: return 'Hard reset in progress';
    case STATUS.ERROR: return 'Something went wrong';
    case STATUS.UNSUPPORTED: return 'Not supported';
    default: return 'Ready';
  }
}

function statusStyle(status) {
  if (status === STATUS.UP_TO_DATE) {
    return { background: '#ECFDF5', borderColor: '#10B981', color: '#065F46' };
  }
  if (status === STATUS.UPDATE_AVAILABLE) {
    return { background: '#FFFBEB', borderColor: '#F59E0B', color: '#92400E' };
  }
  if (status === STATUS.ERROR || status === STATUS.UNSUPPORTED) {
    return { background: '#FEF2F2', borderColor: '#EF4444', color: '#991B1B' };
  }
  return { background: '#F3F4F6', borderColor: '#D1D5DB', color: '#374151' };
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'linear-gradient(180deg, #f9fafb 0%, #e5e7eb 100%)',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#fff',
    borderRadius: 14,
    padding: '32px 24px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  },
  iconWrap: {
    width: 64, height: 64,
    margin: '0 auto 16px',
    borderRadius: '50%',
    background: '#FEE2E2',
    color: '#7F1D1D',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    margin: '0 0 4px', textAlign: 'center', fontSize: '1.5rem', color: '#111827',
  },
  subtitle: {
    margin: '0 0 24px', textAlign: 'center', color: '#6B7280', fontSize: '0.925rem',
  },
  statusBox: {
    border: '1px solid', borderRadius: 10,
    padding: '12px 14px', marginBottom: 20,
    minHeight: 56,
  },
  detailsRow: {
    marginTop: 8, fontSize: '0.75rem', opacity: 0.8,
    wordBreak: 'break-all',
  },
  buttonStack: {
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  btn: {
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid transparent',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.05s',
  },
  btnPrimary: {
    background: '#7F1D1D',
    color: '#fff',
  },
  btnSecondary: {
    background: '#fff',
    color: '#374151',
    borderColor: '#D1D5DB',
  },
  btnDanger: {
    background: '#fff',
    color: '#B91C1C',
    borderColor: '#B91C1C',
  },
  backLink: {
    textAlign: 'center', marginTop: 8,
    color: '#6B7280', fontSize: '0.875rem', textDecoration: 'none',
  },
  faq: {
    marginTop: 24,
    fontSize: '0.85rem',
    color: '#4B5563',
  },
  faqList: {
    margin: '8px 0 0',
    paddingLeft: 20,
    lineHeight: 1.5,
  },
};
