-- supabase/setup-steps/07-booking-rls.sql
-- Run this in Supabase SQL Editor as step 7.

-- ============================================================================
-- ============================================================================
-- RLS POLICIES FOR PUBLIC BOOKING PAGE
-- Run this in Supabase SQL Editor to allow the booking page to read data
-- ============================================================================

-- Allow anyone to read business info (needed for booking page header)
DROP POLICY IF EXISTS "Public can view businesses" ON businesses;
CREATE POLICY "Public can view businesses" ON businesses
    FOR SELECT
    USING (true);

-- Allow anyone to read active products/services (needed for booking page)
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products" ON products
    FOR SELECT
    USING (active = true AND deleted = false);

-- Allow anyone to read active employees (needed for therapist selection)
DROP POLICY IF EXISTS "Public can view active employees" ON employees;
CREATE POLICY "Public can view active employees" ON employees
    FOR SELECT
    USING (status = 'active' AND deleted = false);

-- Allow anyone to read hero/branding settings (needed for booking page hero)
DROP POLICY IF EXISTS "Public can view hero settings" ON settings;
CREATE POLICY "Public can view hero settings" ON settings
    FOR SELECT
    USING (key IN (
        'heroFont', 'heroFontColor', 'heroTextX', 'heroTextY',
        'heroAnimation', 'heroFontSize', 'heroAnimDelay', 'heroAnimDuration',
        'heroLogoEnabled', 'heroLogoX', 'heroLogoY', 'heroLogoSize'
    ));

-- ============================================================================
-- NOTE: If you get "policy already exists" errors, that's OK - it means
-- the policies are already in place. You can ignore those errors.
-- ============================================================================


-- ============================================================================
