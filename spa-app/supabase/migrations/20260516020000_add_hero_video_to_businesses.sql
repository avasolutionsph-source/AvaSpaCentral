-- supabase/migrations/20260516020000_add_hero_video_to_businesses.sql
--
-- Schema drift fix: brandingService.js and BookingPage.jsx both reference a
-- `businesses.hero_video` column that was never added by any tracked
-- migration or setup-step. The column was added manually in the original
-- spa project before this repo existed, so projects spun up from the
-- tracked schema (e.g. via setup-steps/01-schema.sql) fail with:
--
--   "column businesses.hero_video does not exist"
--
-- when the booking page tries to SELECT it.
--
-- Column is nullable TEXT — typical values are short identifiers
-- ('candle', 'lotus', …) that BookingPage.jsx maps to /videos/<id>.mp4,
-- but the field is also written to as a raw URL by brandingService for
-- tenants that upload their own.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS hero_video TEXT;

-- No backfill needed — NULL means "use cover_photo_url instead", which is
-- the BookingPage's existing fallback path.
