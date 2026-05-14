/**
 * Install page — public landing for installing the employee PWA.
 *
 * Replaces the old auto-popup. Users navigate here intentionally to install
 * the app. The PWA's start_url is /login so the installed app opens straight
 * to the employee sign-in screen.
 */

import React, { useEffect, useState } from 'react';

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installState, setInstallState] = useState('idle'); // 'idle' | 'prompting' | 'accepted' | 'dismissed'

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);

    // Pick up an already-fired prompt buffered by the pre-React handler in
    // index.html. Without this branch the prompt is missed when Chrome fires
    // `beforeinstallprompt` before the JS bundle finishes mounting.
    if (window.__avaInstallPrompt) {
      setDeferredPrompt(window.__avaInstallPrompt);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleReady = () => {
      if (window.__avaInstallPrompt) setDeferredPrompt(window.__avaInstallPrompt);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('avaInstallPromptReady', handleReady);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('avaInstallPromptInstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('avaInstallPromptReady', handleReady);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('avaInstallPromptInstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstallState('prompting');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstallState(outcome === 'accepted' ? 'accepted' : 'dismissed');
    setDeferredPrompt(null);
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1B5E37 0%, #2d8050 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    },
    card: {
      background: '#fff',
      maxWidth: '480px',
      width: '100%',
      borderRadius: '16px',
      padding: '32px 28px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      textAlign: 'center',
    },
    icon: {
      width: '96px',
      height: '96px',
      borderRadius: '20px',
      margin: '0 auto 16px',
      display: 'block',
    },
    title: { margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#1B5E37' },
    subtitle: { margin: '0 0 20px', fontSize: '14px', color: '#6b7280' },
    body: {
      textAlign: 'left',
      fontSize: '14px',
      color: '#374151',
      lineHeight: 1.55,
      background: '#f9fafb',
      padding: '14px 16px',
      borderRadius: '10px',
      marginBottom: '20px',
    },
    button: {
      display: 'inline-block',
      padding: '12px 24px',
      background: '#1B5E37',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
      width: '100%',
    },
    buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    hint: { marginTop: '12px', fontSize: '12px', color: '#6b7280' },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <picture>
          <source srcSet="/pwa-192x192.webp" type="image/webp" />
          <img src="/pwa-192x192.png" alt="AVA Spa Central" style={styles.icon} width="96" height="96" />
        </picture>
        <h1 style={styles.title}>Install AVA Spa Central</h1>
        <p style={styles.subtitle}>Employee app for clock-in, POS, and daily operations.</p>

        <div style={styles.body}>
          I-install ang app sa device mo para mas mabilis ang access at kahit
          offline ay magagamit. Pag-install, diretso ka sa <strong>Login</strong> screen
          tuwing bubuksan mo ang app.
        </div>

        {installed ? (
          <div style={{ ...styles.body, color: '#1B5E37', textAlign: 'center', fontWeight: 600 }}>
            ✓ Installed — buksan mo na lang ang AVA Spa Central app sa home screen mo.
          </div>
        ) : isIOS ? (
          <div style={styles.body}>
            <strong>Sa iPhone / iPad:</strong>
            <ol style={{ paddingLeft: '20px', margin: '8px 0 0' }}>
              <li>Tap ang Share button (□↑) sa Safari toolbar.</li>
              <li>Pumili ng <strong>"Add to Home Screen"</strong>.</li>
              <li>Tap <strong>Add</strong>.</li>
            </ol>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleInstall}
              disabled={!deferredPrompt}
              style={{
                ...styles.button,
                ...(!deferredPrompt ? styles.buttonDisabled : {}),
              }}
            >
              {installState === 'prompting' ? 'Installing…' : 'Install App'}
            </button>
            {!deferredPrompt && (
              <p style={styles.hint}>
                Kung walang lumitaw na install prompt, baka naka-install na, o kailangan
                mong buksan ang site sa Chrome / Edge sa device.
              </p>
            )}
            {installState === 'dismissed' && (
              <p style={styles.hint}>Naka-cancel ang install. Pwede kang mag-try ulit anytime.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Install;
