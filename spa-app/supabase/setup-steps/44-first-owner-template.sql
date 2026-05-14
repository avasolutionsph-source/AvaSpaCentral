-- supabase/setup-steps/44-first-owner-template.sql
-- Run this in Supabase SQL Editor as step 44.

-- ----------------------------------------------------------------------------
-- After running everything above:
--   1. Supabase Dashboard -> Authentication -> Users -> Add user
--      Create an email + password. Copy the generated user UUID (auth_id).
--   2. Replace the two placeholders sa baba tapos run mo:
-- ============================================================================

-- INSERT INTO businesses (name, address, city, phone, email)
-- VALUES ('AVA Spa Central', 'Queborac Drive, Naga City', 'Naga', '0917XXXXXXX', 'owner@example.com')
-- RETURNING id;
-- -- copy the returned UUID into <business_uid> below

-- INSERT INTO users (auth_id, business_id, email, role, first_name, last_name)
-- VALUES (
--   '<auth_uid_from_dashboard>',   -- from step 1
--   '<business_uid_from_above>',   -- from the INSERT INTO businesses above
--   'owner@example.com',
--   'Owner',
--   'Your',
--   'Name'
-- );
