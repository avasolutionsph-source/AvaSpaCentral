-- supabase/setup-steps/05-booking-slug.sql
-- Run this in Supabase SQL Editor as step 5.

-- ============================================================================
                -- ============================================================================
                -- BOOKING SLUG FEATURE
                -- Run this script in your Supabase SQL Editor
                -- Allows businesses to have custom booking URLs like /book/daet-spa
                -- ============================================================================

                -- Add booking_slug column to businesses table
                ALTER TABLE businesses
                ADD COLUMN IF NOT EXISTS booking_slug VARCHAR(50) UNIQUE;

                -- Create index for fast lookups by slug
                CREATE INDEX IF NOT EXISTS idx_businesses_booking_slug
                ON businesses(booking_slug) WHERE booking_slug IS NOT NULL;

                -- Add RLS policy to allow public read of booking_slug
                -- (This is already covered by "Public can view businesses" policy if you have it)

                -- ============================================================================
                -- DONE! You can now set custom booking slugs for businesses.
                --
                -- Example: UPDATE businesses SET booking_slug = 'daet-spa' WHERE id = 'your-uuid';
                -- Then access: /book/daet-spa
                -- ============================================================================


-- ============================================================================
