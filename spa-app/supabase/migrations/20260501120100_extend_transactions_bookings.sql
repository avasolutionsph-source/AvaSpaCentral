-- AVADAETSPA/supabase/migrations/20260501120100_extend_transactions_bookings.sql
-- Extends existing tables to link to payment_intents for QRPh flows.
--
-- Reuses existing columns where possible:
--   - transactions.payment_method already exists; 'QRPh' is added as a new
--     allowed value at the application layer (no DB constraint to alter).
--   - advance_bookings.payment_status already exists with values like
--     'unpaid', 'deposit_paid', 'fully_paid'. The QRPh full-prepay flow sets
--     payment_status='fully_paid' on webhook success, reusing existing semantics.
--
-- Only the new FK column is added: payment_intent_id (links each row to its
-- gateway intent for audit, reconciliation, and refund lookups).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_intent_id UUID REFERENCES payment_intents(id);

ALTER TABLE advance_bookings
  ADD COLUMN IF NOT EXISTS payment_intent_id UUID REFERENCES payment_intents(id);
