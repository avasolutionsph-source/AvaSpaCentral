-- supabase/setup-steps/08-booking-rls-footer.sql
-- Run this in Supabase SQL Editor as step 8.

-- ============================================================================
-- ============================================================================
-- FIX: Allow public booking page to read footer + logo animation settings
-- Run this in Supabase SQL Editor.
--
-- The original "Public can view hero settings" policy only whitelisted hero
-- keys, so footerLine1-4, footerFont, footerFontSize, and heroLogoAnimation*
-- were silently filtered out when the booking page queried settings with the
-- anon key. The admin Settings page saved them successfully, but the live
-- booking page's anon-key fetch couldn't read them.
-- ============================================================================

DROP POLICY IF EXISTS "Public can view hero settings" ON settings;

DROP POLICY IF EXISTS "Public can view hero settings" ON settings;
CREATE POLICY "Public can view hero settings" ON settings
    FOR SELECT
    USING (key IN (
        'heroFont', 'heroFontColor', 'heroTextX', 'heroTextY',
        'heroAnimation', 'heroFontSize', 'heroAnimDelay', 'heroAnimDuration',
        'heroTextEnabled',
        'heroLogoEnabled', 'heroLogoX', 'heroLogoY', 'heroLogoSize',
        'heroLogoAnimation', 'heroLogoAnimDelay', 'heroLogoAnimDuration',
        'footerLine1', 'footerLine2', 'footerLine3', 'footerLine4',
        'footerFont', 'footerFontSize'
    ));

-- ============================================================================
-- DONE! After running, hard-refresh the live booking page (Ctrl+Shift+R) and
-- the footer should appear. No code redeploy needed — this is a database
-- policy change only.
-- ============================================================================


-- ============================================================================
