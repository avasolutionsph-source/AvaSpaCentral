-- ============================================================================
-- Home services: rider + pickup workflow columns
-- ----------------------------------------------------------------------------
-- Adds the columns required for the rider-facing "magkano need bayaran" total
-- and the therapist's Pasundo (request pickup) flow:
--   * service_price / total_amount  — let the rider card show the amount to
--     collect at the door without re-fetching the linked transaction.
--   * pax_count                     — surface the guest count on the rider
--     and Rooms home-service cards.
--   * start_time                    — mirrors active_services/rooms so the
--     rider's My Deliveries page can show the same countdown the therapist
--     sees on Rooms.
--   * started_at / started_by       — audit trail for who tapped Start.
--   * completed_at / completed_by / completion_notes — completion audit.
--   * cancelled_at / cancelled_by / cancellation_reason — cancellation audit.
--   * pickup_requested_*            — therapist's Pasundo button stamps these;
--     a Supabase realtime listener on the rider device turns the transition
--     into a looping notification.
--
-- Safe to re-run: every statement uses IF NOT EXISTS. New columns default to
-- NULL — existing rows are not modified.
-- ============================================================================

-- Pricing surfaced on the rider card
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS service_price NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS total_amount  NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pax_count     INTEGER;

-- Lifecycle stamps (mirrors rooms / active_services)
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS start_time          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS started_by          TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS completed_by        TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS completion_notes    TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS cancelled_by        TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Pasundo — therapist's pickup request fields
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_at          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_by          TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_by_role     TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_requested_by_user_id  TEXT;

-- Rider acknowledgement — rider taps "On my way" on the pasundo card.
-- The therapist's Rooms card flips from "Pickup requested" (yellow) to
-- "Rider on the way" (green) when this is set, and a one-shot notification
-- fires to the therapist who originally tapped Pasundo.
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_acknowledged_at          TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_acknowledged_by          TEXT;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS pickup_acknowledged_by_user_id  TEXT;

-- Advance bookings also get the pickup fields — therapist may run the
-- service via an advance booking record (scheduled home service), not the
-- walk-in home_services row. The rider notification handler reads the
-- same field names on either source.
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_at          TIMESTAMPTZ;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_by          TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_by_role     TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_requested_by_user_id  TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_acknowledged_at          TIMESTAMPTZ;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_acknowledged_by          TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS pickup_acknowledged_by_user_id  TEXT;

-- Live location tracking (Grab-style). While a pasundo is active each device
-- publishes its own GPS fix every ~15s to its row; the other side renders a
-- map with the two pins. Stops as soon as the pasundo is no longer active so
-- battery + privacy impact is bounded to the actual pickup window.
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS rider_current_lat          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS rider_current_lng          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS rider_location_updated_at  TIMESTAMPTZ;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS therapist_current_lat          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS therapist_current_lng          NUMERIC;
ALTER TABLE home_services ADD COLUMN IF NOT EXISTS therapist_location_updated_at  TIMESTAMPTZ;

-- Optional index — only useful for "active pasundo" queries; skip if your
-- home-services row count stays small.
CREATE INDEX IF NOT EXISTS idx_home_services_pickup_pending
  ON home_services(pickup_requested_at)
  WHERE pickup_requested_at IS NOT NULL;
