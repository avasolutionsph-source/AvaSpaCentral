-- ============================================================================
-- FIX: Create RPC function for public booking insert
-- ============================================================================
-- The direct INSERT from anonymous users hangs due to RLS policy evaluation.
-- This SECURITY DEFINER function bypasses RLS for public bookings.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_public_booking(booking_data JSONB)
RETURNS JSON AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO online_bookings (
    business_id,
    branch_id,
    reference_number,
    customer_name,
    customer_phone,
    customer_email,
    notes,
    preferred_date,
    preferred_time,
    preferred_therapist_id,
    preferred_therapists,
    therapist_gender_preference,
    services,
    total_amount,
    deposit_amount,
    status,
    payment_status,
    source,
    customer_account_id,
    service_location,
    service_address,
    service_city,
    service_landmark,
    service_instructions,
    transport_fee,
    created_at
  ) VALUES (
    (booking_data->>'business_id')::UUID,
    NULLIF(booking_data->>'branch_id', 'null')::UUID,
    booking_data->>'reference_number',
    booking_data->>'customer_name',
    booking_data->>'customer_phone',
    NULLIF(booking_data->>'customer_email', 'null'),
    NULLIF(booking_data->>'notes', 'null'),
    (booking_data->>'preferred_date')::DATE,
    booking_data->>'preferred_time',
    NULLIF(booking_data->>'preferred_therapist_id', 'null')::UUID,
    COALESCE(booking_data->'preferred_therapists', '[]'::JSONB),
    NULLIF(booking_data->>'therapist_gender_preference', 'null'),
    COALESCE(booking_data->'services', '[]'::JSONB),
    COALESCE((booking_data->>'total_amount')::DECIMAL, 0),
    COALESCE((booking_data->>'deposit_amount')::DECIMAL, 0),
    COALESCE(booking_data->>'status', 'pending'),
    COALESCE(booking_data->>'payment_status', 'unpaid'),
    COALESCE(booking_data->>'source', 'online_booking'),
    NULLIF(booking_data->>'customer_account_id', 'null')::UUID,
    COALESCE(booking_data->>'service_location', 'in_store'),
    NULLIF(booking_data->>'service_address', 'null'),
    NULLIF(booking_data->>'service_city', 'null'),
    NULLIF(booking_data->>'service_landmark', 'null'),
    NULLIF(booking_data->>'service_instructions', 'null'),
    COALESCE((booking_data->>'transport_fee')::DECIMAL, 0),
    COALESCE((booking_data->>'created_at')::TIMESTAMPTZ, NOW())
  )
  RETURNING id INTO new_id;

  RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow anonymous users to call this function
GRANT EXECUTE ON FUNCTION create_public_booking(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION create_public_booking(JSONB) TO authenticated;
