-- ============================================================================
-- ONLINE BOOKINGS TABLE
-- Run this script in your Supabase SQL Editor
-- ============================================================================

-- Create the online_bookings table
CREATE TABLE IF NOT EXISTS online_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

    -- Booking reference
    reference_number VARCHAR(50) NOT NULL UNIQUE,

    -- Customer details (not linked to customers table - public booking)
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    notes TEXT,

    -- Scheduling
    preferred_date DATE NOT NULL,
    preferred_time VARCHAR(20) NOT NULL,
    preferred_therapist_id UUID REFERENCES employees(id) ON DELETE SET NULL,

    -- Services (stored as JSON array)
    services JSONB NOT NULL DEFAULT '[]',

    -- Pricing
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'deposit_paid', 'fully_paid', 'refunded')),

    -- Source tracking
    source VARCHAR(50) DEFAULT 'online_booking',

    -- Staff who confirmed/handled the booking
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,

    -- If converted to an actual appointment
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_online_bookings_business_id ON online_bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_online_bookings_status ON online_bookings(status);
CREATE INDEX IF NOT EXISTS idx_online_bookings_preferred_date ON online_bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_online_bookings_reference ON online_bookings(reference_number);
CREATE INDEX IF NOT EXISTS idx_online_bookings_created_at ON online_bookings(created_at DESC);

-- Enable Row Level Security
ALTER TABLE online_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see bookings for their business
CREATE POLICY "Users can view own business bookings" ON online_bookings
    FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Policy: Anyone can INSERT (public booking page)
CREATE POLICY "Anyone can create bookings" ON online_bookings
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update bookings for their business
CREATE POLICY "Users can update own business bookings" ON online_bookings
    FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_online_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_online_bookings_updated_at
    BEFORE UPDATE ON online_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_online_bookings_updated_at();

-- ============================================================================
-- DONE! You can now receive online bookings.
-- ============================================================================
