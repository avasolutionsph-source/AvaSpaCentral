/**
 * Screen orientation helpers.
 *
 * The PWA manifest declares `orientation: 'any'` so the app *can* rotate,
 * but Android/iOS users in PWA fullscreen mode often complain that the
 * screen seems "locked" because the OS auto-rotation toggle doesn't
 * always work consistently inside an installed PWA. This module gives
 * the app an explicit user-facing override:
 *
 *   - 'auto'      — let the OS decide (default)
 *   - 'landscape' — pin the app to landscape (any orientation)
 *   - 'portrait'  — pin the app to portrait (any orientation)
 *
 * The preference is persisted in localStorage and re-applied on every
 * launch, so therapists/riders/utility roles only have to set it once
 * on their device.
 */

const STORAGE_KEY = 'preferred-orientation';
const VALID = new Set(['auto', 'landscape', 'portrait']);

export function getPreferredOrientation() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.has(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Persist the preference. Does not throw on storage failure (e.g. private mode).
 */
export function persistPreferredOrientation(pref) {
  try {
    if (pref === 'auto') {
      localStorage.removeItem(STORAGE_KEY);
    } else if (VALID.has(pref)) {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // ignore
  }
}

/**
 * Apply the orientation preference to the screen via the Screen
 * Orientation API. Resolves to `{ ok, reason? }`. Most browsers only
 * allow lock() when the page is fullscreen / in a PWA standalone
 * window — calling it from a normal browser tab will reject with
 * NotSupportedError or SecurityError, which we surface as ok=false.
 */
export async function applyOrientationPreference(pref) {
  const orientation = pref || getPreferredOrientation();

  if (typeof screen === 'undefined' || !screen.orientation) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    if (orientation === 'auto') {
      if (typeof screen.orientation.unlock === 'function') {
        screen.orientation.unlock();
      }
      return { ok: true };
    }

    if (typeof screen.orientation.lock !== 'function') {
      return { ok: false, reason: 'lock_not_available' };
    }

    await screen.orientation.lock(orientation);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
}

/**
 * Convenience: persist + apply in one call.
 */
export async function setPreferredOrientation(pref) {
  persistPreferredOrientation(pref);
  return applyOrientationPreference(pref);
}
