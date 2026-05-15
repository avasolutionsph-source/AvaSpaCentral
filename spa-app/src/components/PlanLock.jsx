import React from 'react';
import { useApp, PLAN_LABELS } from '../context/AppContext';

// Rank used to compare plan tiers numerically. Lower rank = more restrictive.
// Anything not in the map (legacy / null) is treated as starter — failing
// closed matches the AppContext fallback so the two stay consistent.
const TIER_RANK = { starter: 1, advance: 2, enterprise: 3 };

function rankOf(tier) {
  return TIER_RANK[tier] ?? TIER_RANK.starter;
}

/**
 * Plan-tier gating primitive.
 *
 * Returns whether the active plan can use a feature that requires
 * `requiredTier` (default 'advance') and a ready-made toast/tooltip
 * message. The hook is the source of truth — PlanLock and inline gates
 * both consume it so the message stays in sync.
 *
 * Usage:
 *   const { locked, message } = usePlanGate('advance');
 *   if (locked) return showToast(message, 'error');
 */
export function usePlanGate(requiredTier = 'advance') {
  const { planTier, showToast } = useApp();
  const locked = rankOf(planTier) < rankOf(requiredTier);
  const requiredLabel = PLAN_LABELS[requiredTier] || requiredTier;
  const message = `Upgrade to ${requiredLabel} to unlock this feature.`;
  // Convenience: a click-blocker that surfaces the toast and returns true
  // when the action should NOT proceed. Lets call sites write:
  //   onClick={(e) => { if (blockIfLocked(e)) return; doTheThing(); }}
  const blockIfLocked = (event) => {
    if (!locked) return false;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    showToast(message, 'error');
    return true;
  };
  return { locked, message, requiredLabel, blockIfLocked, planTier };
}

/**
 * PlanLock — wraps a UI element and shows a lock overlay + hover tooltip
 * when the active plan tier is below `requiredTier`. Clicks are blocked
 * and surface a "Upgrade to <tier>" toast.
 *
 * Props:
 *   requiredTier  - 'advance' | 'enterprise' (default 'advance')
 *   inline        - render as <span> instead of <div> for inline contexts
 *   className     - extra classes on the wrapper
 *   children      - the element being locked (button, link, etc.)
 *
 * The wrapper is `position: relative` so the lock badge + tooltip can
 * absolute-position over the child. The child stays in the DOM (the
 * user can still see what they're missing) but pointer-events on it are
 * disabled and a transparent click-eater catches the gesture.
 */
export default function PlanLock({
  requiredTier = 'advance',
  inline = false,
  className = '',
  children,
}) {
  const { locked, message, blockIfLocked } = usePlanGate(requiredTier);

  if (!locked) {
    // Pass-through when the plan allows the feature — zero visual overhead.
    return children;
  }

  const Tag = inline ? 'span' : 'div';

  const wrapperStyle = {
    position: 'relative',
    display: inline ? 'inline-block' : 'block',
  };

  const dimStyle = {
    opacity: 0.5,
    filter: 'grayscale(0.6)',
    pointerEvents: 'none',
    userSelect: 'none',
  };

  // Transparent click-eater sits above the child. Catches the click and
  // routes through blockIfLocked → toast. The lock badge below sits on
  // top of this so its title attribute fires the native hover tooltip.
  const overlayStyle = {
    position: 'absolute',
    inset: 0,
    cursor: 'not-allowed',
    background: 'transparent',
    zIndex: 1,
  };

  const badgeStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(27, 94, 55, 0.92)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '999px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    zIndex: 2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <Tag className={`plan-lock ${className}`.trim()} style={wrapperStyle} title={message}>
      <span style={dimStyle}>{children}</span>
      <span
        role="button"
        tabIndex={0}
        aria-label={message}
        style={overlayStyle}
        onClick={blockIfLocked}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') blockIfLocked(e);
        }}
      />
      <span style={badgeStyle} aria-hidden="true">
        <span style={{ fontSize: '0.78rem' }}>🔒</span> Upgrade
      </span>
    </Tag>
  );
}
