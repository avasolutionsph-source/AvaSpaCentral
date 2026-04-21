import React from 'react';

const InitialSyncLoader = () => (
  <div
    className="loading-screen"
    role="status"
    aria-live="polite"
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
    }}
  >
    <div className="spinner" aria-hidden="true" />
    <p style={{ fontSize: '1.0625rem', fontWeight: 600 }}>
      Setting up your workspace…
    </p>
    <p>Loading your business data for the first time. This only takes a moment.</p>
  </div>
);

export default InitialSyncLoader;
