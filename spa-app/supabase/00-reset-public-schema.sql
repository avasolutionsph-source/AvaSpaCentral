-- ============================================================================
-- RESET PUBLIC SCHEMA (fresh-project recovery)
-- ----------------------------------------------------------------------------
-- Paste this ENTIRE block into the Supabase SQL Editor and Run it FIRST,
-- BEFORE running all-in-one-setup.sql.
--
-- What it does:
--   * Drops the entire `public` schema and recreates it empty.
--   * Restores the default grants Supabase expects so anon / authenticated /
--     service_role keys keep working.
--
-- What it does NOT touch:
--   * The `auth` schema (your Supabase Auth users stay).
--   * The `storage` schema (uploaded files stay).
--   * The `realtime` schema (publication state — we recreate it below).
--
-- ⚠️ DESTRUCTIVE: every table / row in `public` is deleted. Only run on a
-- fresh project or one where you intentionally want a clean slate.
-- ============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- Default privileges so newly-created tables inherit sane grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO postgres, service_role, anon, authenticated;

-- Recreate the supabase_realtime publication that DROP SCHEMA may have torn
-- down. The all-in-one setup later runs ALTER PUBLICATION ... ADD TABLE on
-- each table that needs realtime; this just guarantees the publication
-- itself exists.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- ============================================================================
-- DONE. Now run all-in-one-setup.sql in a fresh SQL Editor tab.
-- ============================================================================
