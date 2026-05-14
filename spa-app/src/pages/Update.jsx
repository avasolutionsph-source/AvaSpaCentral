import React from 'react';
import UpdatePanel from '../components/UpdatePanel';

/**
 * Public /update page.
 *
 * A no-login utility for end users (therapists, riders, owners) to pull
 * the latest build of the installed PWA without having to uninstall and
 * reinstall the app. Kept entirely public (no auth, no MainLayout) so a
 * user with a broken cached app can still reach this page and recover.
 *
 * The actual update controls live in <UpdatePanel /> so the same logic
 * also powers the Update tab inside Settings.
 */
export default function Update() {
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
          Pull the latest version of AVA Spa Central without reinstalling.
        </p>

        <UpdatePanel />

        <a href="/" style={styles.backLink}>
          ← Back to app
        </a>
      </div>
    </div>
  );
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
  backLink: {
    display: 'block',
    textAlign: 'center', marginTop: 16,
    color: '#6B7280', fontSize: '0.875rem', textDecoration: 'none',
  },
};
