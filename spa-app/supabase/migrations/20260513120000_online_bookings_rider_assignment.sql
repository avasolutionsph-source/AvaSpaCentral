-- ============================================================================
-- Rider assignment columns for online_bookings
-- ----------------------------------------------------------------------------
-- The AdvanceBookingsTab UI merges advance_bookings + online_bookings into the
-- same Regular Appointments list, and the "Assign Rider" dropdown writes
-- rider_id / rider_name / rider_assigned_at on the row. Those columns existed
-- on advance_bookings but were missing from online_bookings, so assigning a
-- rider to an online booking always failed with "Failed to assign rider" —
-- the PATCH hit the right table but the columns didn't exist.
--
-- Adding the same shape advance_bookings uses keeps the UI code uniform
-- (one set of field names, one update path) and lets the rider's
-- My Deliveries page join over a single rider_id column when it starts
-- reading from online_bookings.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_id          UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_name        TEXT;
ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_assigned_at TIMESTAMPTZ;
ALTER TABLE public.online_bookings ADD COLUMN IF NOT EXISTS rider_assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Partial index — only useful if the rider's My Deliveries page filters
-- online_bookings by rider_id at query time. Skip on small datasets.
CREATE INDEX IF NOT EXISTS idx_online_bookings_rider
  ON public.online_bookings(rider_id) WHERE rider_id IS NOT NULL;
