-- ============================================================
-- SUPABASE DIAGNOSTIC: Check what tables and columns exist
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. List ALL tables in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
