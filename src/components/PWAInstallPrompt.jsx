/**
 * PWA Install Prompt Component
 *
 * Shows a prompt to install the app on supported devices.
 * Works on Chrome, Edge, Samsung Internet, and other Chromium browsers.
 */

import React, { useState, useEffect } from 'react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Don't show on public-facing pages (booking, branch select)
    const path = window.location.pathname;
    if (path.startsWith('/book/') || path.startsWith('/select-branch')) {
      return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently (don't show for 7 days)
    const dismissedAt = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // For iOS, show manual instructions after delay
    if (isIOSDevice) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // For other browsers, listen for beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after short delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // Don't render if installed or not showing
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-prompt" role="dialog" aria-labelledby="pwa-title">
      <div className="pwa-prompt-content">
        <div className="pwa-prompt-icon">
          <picture>
            <source srcSet="/pwa-192x192.webp" type="image/webp" />
            <img src="/pwa-192x192.png" alt="Daet Spa" width="48" height="48" loading="lazy" />
          </picture>
        </div>
        <div className="pwa-prompt-text">
          <h3 id="pwa-title">Install Daet Spa</h3>
          {isIOS ? (
            <p>
              Tap <span className="pwa-ios-icon">&#x1F4E4;</span> then "Add to Home Screen"
            </p>
          ) : (
            <p>Install for quick access and offline use</p>
          )}
        </div>
        <div className="pwa-prompt-actions">
          {!isIOS && (
            <button className="pwa-install-btn" onClick={handleInstall}>
              Install
            </button>
          )}
          <button className="pwa-dismiss-btn" onClick={handleDismiss} aria-label="Dismiss">
            &times;
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
