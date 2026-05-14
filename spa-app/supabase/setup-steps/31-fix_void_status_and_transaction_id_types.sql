-- supabase/setup-steps/31-fix_void_status_and_transaction_id_types.sql
-- Run this in Supabase SQL Editor as step 31.

-- ============================================================================
-- Bug 1: app uses status='voided' but DB CHECK only allowed 'void'.
-- Add 'voided' as a valid status; keeps existing 'void' rows untouched.
ALTER TABLE transactions
  DROP CONSTRAINT transactions_status_check,
  ADD CONSTRAINT transactions_status_check CHECK (
    status IN ('completed','pending','cancelled','refunded','void','voided')
  );

-- Bug 2: home_services.transaction_id and product_consumption.transaction_id
-- were declared UUID, but the app stores receipt-number strings like
-- "RCP-20260505-93823458" there (matching the rooms + advance_bookings
-- convention which uses VARCHAR/TEXT). Convert both to TEXT.
ALTER TABLE home_services
  ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::text;

ALTER TABLE product_consumption
  ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::text;


-- ============================================================================
