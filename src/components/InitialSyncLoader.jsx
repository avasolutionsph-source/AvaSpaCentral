import React from 'react';

// Scoped keyframes + styles. Kept inside the component so it's self-contained
// and doesn't require coordinating changes to the global stylesheet.
const styles = `
@keyframes initial-sync-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes initial-sync-ring {
  to { transform: rotate(360deg); }
}
@keyframes initial-sync-ring-reverse {
  to { transform: rotate(-360deg); }
}
@keyframes initial-sync-pulse {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.15); }
}
@keyframes initial-sync-shimmer {
  0%   { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
.initial-sync-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background:
    radial-gradient(circle at 50% 40%, var(--primary-50, rgba(0,0,0,0.02)), transparent 60%),
    var(--color-background, #FFFFFF);
  animation: initial-sync-fade-in 260ms ease-out;
}
.initial-sync-ring-wrap {
  position: relative;
  width: 72px;
  height: 72px;
}
.initial-sync-ring-outer,
.initial-sync-ring-inner {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid transparent;
}
.initial-sync-ring-outer {
  border-top-color: var(--primary, #1B5E37);
  border-right-color: var(--primary, #1B5E37);
  animation: initial-sync-ring 1.1s cubic-bezier(0.5, 0.15, 0.5, 0.85) infinite;
}
.initial-sync-ring-inner {
  inset: 10px;
  border-bottom-color: var(--primary, #1B5E37);
  border-left-color: var(--primary, #1B5E37);
  opacity: 0.55;
  animation: initial-sync-ring-reverse 1.6s cubic-bezier(0.5, 0.15, 0.5, 0.85) infinite;
}
.initial-sync-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  max-width: 340px;
  padding: 0 24px;
}
.initial-sync-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-primary, #111);
  display: inline-flex;
  align-items: baseline;
}
.initial-sync-dot {
  width: 4px;
  height: 4px;
  margin-left: 4px;
  border-radius: 50%;
  background: var(--primary, #1B5E37);
  display: inline-block;
  animation: initial-sync-pulse 1.2s ease-in-out infinite;
}
.initial-sync-dot:nth-child(2) { animation-delay: 0.15s; }
.initial-sync-dot:nth-child(3) { animation-delay: 0.3s; }
.initial-sync-subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-muted, #6B7280);
  line-height: 1.5;
  font-weight: 500;
}
.initial-sync-progress {
  width: 180px;
  height: 3px;
  border-radius: 999px;
  background:
    linear-gradient(
      90deg,
      transparent 0%,
      var(--primary, #1B5E37) 50%,
      transparent 100%
    );
  background-size: 200px 3px;
  background-repeat: no-repeat;
  background-color: var(--color-border, rgba(0,0,0,0.06));
  animation: initial-sync-shimmer 1.4s linear infinite;
  opacity: 0.75;
}
`;

const InitialSyncLoader = () => (
  <div className="initial-sync-overlay" role="status" aria-live="polite">
    <style>{styles}</style>

    <div className="initial-sync-ring-wrap" aria-hidden="true">
      <div className="initial-sync-ring-outer" />
      <div className="initial-sync-ring-inner" />
    </div>

    <div className="initial-sync-text">
      <p className="initial-sync-title">
        <span>Setting up your workspace</span>
        <span className="initial-sync-dot" aria-hidden="true" />
        <span className="initial-sync-dot" aria-hidden="true" />
        <span className="initial-sync-dot" aria-hidden="true" />
      </p>
      <p className="initial-sync-subtitle">
        Loading your business data for the first time. This only takes a moment.
      </p>
    </div>

    <div className="initial-sync-progress" aria-hidden="true" />
  </div>
);

export default InitialSyncLoader;
