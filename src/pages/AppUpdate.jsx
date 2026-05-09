import React from 'react';
import UpdatePanel from '../components/UpdatePanel';

/**
 * In-app /app-update page. Renders inside MainLayout so the sidebar
 * remains visible — used by roles that don't have Settings access
 * (Receptionist, Therapist, Rider, Utility) to pull the latest PWA
 * build. The standalone public /update page is kept for recovery
 * scenarios when the app shell itself is broken.
 *
 * Reuses the same controls as Settings → Update via <UpdatePanel />.
 */
export default function AppUpdate() {
  return (
    <div className="settings-content">
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">🔄</div>
          <div className="settings-section-title">
            <h2>Update App</h2>
            <p>Pull the latest version of Daet Massage &amp; Spa without reinstalling. Your offline records and sync queue stay intact.</p>
          </div>
        </div>
        <div className="settings-section-body">
          <UpdatePanel />
        </div>
      </div>
    </div>
  );
}
