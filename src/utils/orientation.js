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
 *
 * Browser quirks that drive the implementation below:
 *
 * - `screen.orientation.lock()` only works while the document is in
 *   fullscreen (Android Chrome) OR inside an installed-PWA standalone
 *   window. In a normal browser tab the call rejects with a
 *   SecurityError. We therefore request fullscreen on the document
 *   element first when locking — same approach the Dashboard's old
 *   toggleLandscape uses, just generalized.
 *
 * - Plain `unlock()` doesn't actively rotate the screen; on Android the
 *   OS only flips on physical rotation. Switching from landscape →
 *   portrait via the toggle therefore briefly locks to portrait, exits
 *   fullscreen, then unlocks (deferred) so future rotations remain
 *   free.
 *
 * - iOS Safari does not implement the Screen Orientation Lock API. Calls
 *   reject silently and we surface ok=false so the UI can fall back to
 *   the "Auto" state instead of pretending the lock succeeded.
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

async function enterFullscreenIfNeeded() {
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement) return true;
  const el = document.documentElement;
  const request =
    el?.requestFullscreen ||
    el?.webkitRequestFullscreen ||
    el?.mozRequestFullScreen ||
    el?.msRequestFullscreen;
  if (typeof request !== 'function') return false;
  try {
    await request.call(el);
    return true;
  } catch {
    return false;
  }
}

async function exitFullscreenIfActive() {
  if (typeof document === 'undefined') return;
  if (!document.fullscreenElement) return;
  const exit =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;
  if (typeof exit !== 'function') return;
  try {
    await exit.call(document);
  } catch {
    // ignore — the user may have already exited
  }
}

/**
 * Apply the orientation preference to the screen via the Screen
 * Orientation API. Resolves to `{ ok, reason? }`.
 *
 * @param {'auto'|'landscape'|'portrait'|null} pref
 * @param {{ enterFullscreen?: boolean, exitFullscreen?: boolean }} opts
 *   - enterFullscreen (default true on lock): request fullscreen before
 *     locking, since most browsers gate lock() on fullscreen.
 *   - exitFullscreen (default true on auto): exit fullscreen when
 *     switching back to auto so the user isn't trapped in fullscreen.
 */
export async function applyOrientationPreference(pref, opts = {}) {
  const orientation = pref || getPreferredOrientation();
  const enterFullscreen = opts.enterFullscreen !== false;
  const exitFullscreen = opts.exitFullscreen !== false;

  if (typeof screen === 'undefined' || !screen.orientation) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    if (orientation === 'auto') {
      if (typeof screen.orientation.unlock === 'function') {
        try { screen.orientation.unlock(); } catch { /* ignore */ }
      }
      if (exitFullscreen) {
        await exitFullscreenIfActive();
      }
      return { ok: true };
    }

    if (typeof screen.orientation.lock !== 'function') {
      return { ok: false, reason: 'lock_not_available' };
    }

    if (enterFullscreen) {
      // Best-effort. If fullscreen fails (e.g. desktop browser, no user
      // gesture), we still try lock() — it may succeed in a PWA window.
      await enterFullscreenIfNeeded();
    }

    await screen.orientation.lock(orientation);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
}

/**
 * Convenience: persist + apply in one call. Mark the call as user-initiated
 * so the fullscreen request runs (browsers require a user gesture). Calls
 * from app launch should pass `{ enterFullscreen: false }` to avoid
 * surprising the user with fullscreen on every reload.
 */
export async function setPreferredOrientation(pref, opts) {
  persistPreferredOrientation(pref);
  return applyOrientationPreference(pref, opts);
}
