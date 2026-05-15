/**
 * Install page — public landing for installing the employee PWA.
 *
 * Replaces the old auto-popup. Users navigate here intentionally to install
 * the app. The PWA's start_url is /login so the installed app opens straight
 * to the employee sign-in screen.
 */

import React, { useEffect, useMemo, useState } from 'react';

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  // On iOS, only Safari can install PWAs. Chrome/Firefox/Edge on iOS still use
  // WebKit but disable Add-to-Home-Screen, so we must redirect the user to
  // Safari rather than show the Share-button instructions.
  const [iosBrowser, setIosBrowser] = useState('safari'); // 'safari' | 'non-safari'
  // iPhone Safari renders the Share button in the BOTTOM toolbar; iPad Safari
  // renders it in the TOP-RIGHT. The arrow direction follows.
  const [isIpad, setIsIpad] = useState(false);
  const [installState, setInstallState] = useState('idle'); // 'idle' | 'prompting' | 'accepted' | 'dismissed'
  const [copyState, setCopyState] = useState({});

  // Welcome context from the marketing-site success page link. When a new
  // owner clicks "Install AVA App" right after paying, we get their email,
  // business name, and booking slug as query params and render the page
  // as a personalised welcome screen with their three customer-facing
  // assets (booking URL, login link, install button). Returns null for
  // employees who navigate directly to /install — they see the plain page.
  const welcomeCtx = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const business = params.get('business');
    const email = params.get('email');
    const book = params.get('book');
    if (!business && !email && !book) return null;
    const origin = window.location.origin;
    const bookingUrl = book ? `${origin}/book/${book}` : null;
    const loginUrl = email
      ? `${origin}/login?email=${encodeURIComponent(email)}`
      : `${origin}/login`;
    return { business, email, book, bookingUrl, loginUrl };
  }, []);

  const copyToClipboard = async (key, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((prev) => ({ ...prev, [key]: 'copied' }));
      setTimeout(() => setCopyState((prev) => ({ ...prev, [key]: undefined })), 1500);
    } catch {
      setCopyState((prev) => ({ ...prev, [key]: 'failed' }));
      setTimeout(() => setCopyState((prev) => ({ ...prev, [key]: undefined })), 1500);
    }
  };

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    const ua = navigator.userAgent;
    const onIOS = (/iPad|iPhone|iPod/.test(ua) && !window.MSStream)
      // iPadOS 13+ reports as Mac; sniff touch points to catch it.
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(onIOS);
    if (onIOS) {
      setIsIpad(/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
      // CriOS = Chrome on iOS, FxiOS = Firefox, EdgiOS = Edge. Any of these
      // can't install PWAs even though they're WebKit under the hood.
      if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua)) {
        setIosBrowser('non-safari');
      }
    }

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
      maxWidth: welcomeCtx ? '560px' : '480px',
      width: '100%',
      borderRadius: '16px',
      padding: '32px 28px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      textAlign: 'center',
    },
    welcomeBadge: {
      display: 'inline-block',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      color: '#C99A3A',
      background: 'rgba(201,154,58,0.12)',
      padding: '5px 10px',
      borderRadius: '999px',
      marginBottom: '10px',
    },
    linkRow: {
      display: 'flex',
      alignItems: 'stretch',
      gap: '6px',
      marginTop: '8px',
    },
    linkCode: {
      flex: 1,
      background: '#f3f4f6',
      color: '#1B5E37',
      padding: '10px 12px',
      borderRadius: '8px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '12.5px',
      textAlign: 'left',
      wordBreak: 'break-all',
      border: '1px solid #e5e7eb',
    },
    copyBtn: {
      background: '#1B5E37',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '0 14px',
      fontSize: '12.5px',
      fontWeight: 600,
      cursor: 'pointer',
    },
    welcomePanel: {
      textAlign: 'left',
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '12px',
      padding: '16px 18px',
      marginBottom: '18px',
    },
    welcomePanelTitle: {
      margin: '0 0 4px',
      fontSize: '13px',
      fontWeight: 700,
      color: '#1B5E37',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
    },
    welcomePanelHint: {
      margin: '0 0 6px',
      fontSize: '13px',
      color: '#374151',
      lineHeight: 1.5,
    },
    loginCta: {
      display: 'block',
      width: '100%',
      background: '#C99A3A',
      color: '#1B5E37',
      border: 'none',
      borderRadius: '10px',
      padding: '11px 14px',
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer',
      textDecoration: 'none',
      textAlign: 'center',
      marginBottom: '14px',
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
    arrowWrap: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: '14px',
      color: '#1B5E37',
    },
    arrowUp: { animation: 'avaArrowUp 1.4s ease-in-out infinite' },
    arrowDown: { animation: 'avaArrowDown 1.4s ease-in-out infinite' },
    warnBox: {
      textAlign: 'left',
      fontSize: '14px',
      color: '#7c2d12',
      lineHeight: 1.55,
      background: '#fef3c7',
      border: '1px solid #fcd34d',
      padding: '14px 16px',
      borderRadius: '10px',
      marginBottom: '20px',
    },
  };

  const Arrow = ({ direction }) => (
    <div style={styles.arrowWrap} aria-hidden="true">
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={direction === 'up' ? styles.arrowUp : styles.arrowDown}
      >
        {direction === 'up' ? (
          <>
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </>
        ) : (
          <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </>
        )}
      </svg>
    </div>
  );

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes avaArrowDown {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50%      { transform: translateY(8px); opacity: 1; }
        }
        @keyframes avaArrowUp {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50%      { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
      <div style={styles.card}>
        <picture>
          <source srcSet="/pwa-192x192.webp" type="image/webp" />
          <img src="/pwa-192x192.png" alt="AVA Spa Central" style={styles.icon} width="96" height="96" />
        </picture>

        {welcomeCtx ? (
          <>
            <span style={styles.welcomeBadge}>Your Spa is Live</span>
            <h1 style={styles.title}>
              Welcome{welcomeCtx.business ? `, ${welcomeCtx.business}` : ''}!
            </h1>
            <p style={styles.subtitle}>
              Salamat sa subscription. Heto ang mga link at app mo — i-save mo
              muna ang booking URL bago mag-install.
            </p>

            {welcomeCtx.bookingUrl && (
              <div style={styles.welcomePanel}>
                <p style={styles.welcomePanelTitle}>1 · Customer booking page</p>
                <p style={styles.welcomePanelHint}>
                  Share mo ito sa customers para mag-book online — Facebook bio,
                  QR code, posters, lahat pwede.
                </p>
                <div style={styles.linkRow}>
                  <code style={styles.linkCode}>{welcomeCtx.bookingUrl}</code>
                  <button
                    type="button"
                    style={styles.copyBtn}
                    onClick={() => copyToClipboard('book', welcomeCtx.bookingUrl)}
                  >
                    {copyState.book === 'copied' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div style={styles.welcomePanel}>
              <p style={styles.welcomePanelTitle}>2 · Staff POS login</p>
              <p style={styles.welcomePanelHint}>
                Sa'yo at sa team mo — mag-login para sa POS, payroll, bookings,
                at iba pa. Email mo: <strong>{welcomeCtx.email || '—'}</strong>
              </p>
              <a href={welcomeCtx.loginUrl} style={styles.loginCta}>
                Open Staff POS Login →
              </a>
              <div style={styles.linkRow}>
                <code style={styles.linkCode}>{welcomeCtx.loginUrl}</code>
                <button
                  type="button"
                  style={styles.copyBtn}
                  onClick={() => copyToClipboard('login', welcomeCtx.loginUrl)}
                >
                  {copyState.login === 'copied' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            <p style={{ ...styles.welcomePanelTitle, marginTop: '6px', marginBottom: '10px', textAlign: 'left' }}>
              3 · Install the app on this device
            </p>
          </>
        ) : (
          <>
            <h1 style={styles.title}>Install AVA Spa Central</h1>
            <p style={styles.subtitle}>Employee app for clock-in, POS, and daily operations.</p>

            <div style={styles.body}>
              I-install ang app sa device mo para mas mabilis ang access at kahit
              offline ay magagamit. Pag-install, diretso ka sa <strong>Login</strong> screen
              tuwing bubuksan mo ang app.
            </div>
          </>
        )}

        {installed ? (
          <div style={{ ...styles.body, color: '#1B5E37', textAlign: 'center', fontWeight: 600 }}>
            ✓ Installed — buksan mo na lang ang AVA Spa Central app sa home screen mo.
          </div>
        ) : isIOS && iosBrowser === 'non-safari' ? (
          <>
            <div style={styles.warnBox}>
              <strong>Buksan sa Safari para mag-install.</strong>
              <p style={{ margin: '8px 0 0' }}>
                Sa iPhone at iPad, tanging <strong>Safari</strong> lang ang
                makakapag-install ng app. Tap ang Share button sa browser mo,
                pumili ng <strong>"Open in Safari"</strong>, tapos balik ka sa
                page na ito.
              </p>
            </div>
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              style={{ ...styles.button, textDecoration: 'none', display: 'inline-block' }}
            >
              Kopyahin ang link
            </a>
          </>
        ) : isIOS ? (
          <>
            <div style={styles.body}>
              <strong>{isIpad ? 'Sa iPad:' : 'Sa iPhone:'}</strong>
              <ol style={{ paddingLeft: '20px', margin: '8px 0 0' }}>
                <li>
                  Tap ang Share button (□↑) sa{' '}
                  <strong>{isIpad ? 'taas-kanan' : 'baba'}</strong> ng Safari.
                </li>
                <li>Pumili ng <strong>"Add to Home Screen"</strong>.</li>
                <li>Tap <strong>Add</strong>.</li>
              </ol>
            </div>
            <Arrow direction={isIpad ? 'up' : 'down'} />
          </>
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
