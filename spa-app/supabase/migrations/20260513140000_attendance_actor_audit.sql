-- ============================================================================
-- Actor audit columns for attendance
-- ----------------------------------------------------------------------------
-- A clock-in / clock-out can be performed by the employee themselves
-- (MyPortal) OR by a manager/receptionist on their behalf (Attendance.jsx).
-- Up to now only the employee_id (whose attendance this is) was stored;
-- there was no way to tell from the record whether a manager remote-clocked
-- the employee in. This matters for audits — an employee who was clocked
-- in by a manager from a different location should be distinguishable from
-- a self-clock.
--
-- Adding both name (display) and id (FK) lets the Attendance Photos modal
-- render "by Randy Benitua (Owner)" inline without an extra join, while
-- still letting reports query by user.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_in_by       TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_in_by_id    UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_in_by_role  TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_out_by      TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_out_by_id   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_out_by_role TEXT;
