-- supabase/setup-steps/02-migration-fix.sql
-- Run this in Supabase SQL Editor as step 2.

-- ============================================================================
-- ============================================
-- MIGRATION SCRIPT: Fix Missing Columns
-- ============================================
-- Run this SQL in your Supabase SQL Editor to add missing columns
-- to your existing tables. This fixes the sync errors.
-- ============================================

-- Add branding columns to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#1B5E37';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_slug VARCHAR(100);

-- Add items_used to products table (for service-product linking)
ALTER TABLE products ADD COLUMN IF NOT EXISTS items_used JSONB DEFAULT '[]';

-- Add hide_from_pos to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS hide_from_pos BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to inventory_movements
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to stock_history
ALTER TABLE stock_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stock_history ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE stock_history ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to product_consumption
ALTER TABLE product_consumption ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE product_consumption ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to activity_logs
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at and other missing columns to loyalty_history
ALTER TABLE loyalty_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE loyalty_history ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE loyalty_history ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add updated_at to payroll_config_logs
ALTER TABLE payroll_config_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- VERIFY THE CHANGES
-- ============================================
-- After running this script, you can verify the columns were added:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'products' AND column_name = 'hide_from_pos';

-- ============================================
-- DONE!
-- ============================================


-- ============================================================================
