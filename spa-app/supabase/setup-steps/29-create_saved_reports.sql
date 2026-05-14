-- supabase/setup-steps/29-create_saved_reports.sql
-- Run this in Supabase SQL Editor as step 29.

-- ============================================================================
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,
  branch_name TEXT,

  period TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_key TEXT NOT NULL,

  saved_by_user_id UUID,
  saved_by_name TEXT,

  data JSONB NOT NULL,
  manual JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_reports_business_created
  ON saved_reports(business_id, created_at DESC);
CREATE INDEX idx_saved_reports_branch
  ON saved_reports(branch_id);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read saved_reports same business" ON saved_reports;
CREATE POLICY "read saved_reports same business" ON saved_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

DROP POLICY IF EXISTS "insert saved_reports same business" ON saved_reports;
CREATE POLICY "insert saved_reports same business" ON saved_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

DROP POLICY IF EXISTS "delete saved_reports creator or owner" ON saved_reports;
CREATE POLICY "delete saved_reports creator or owner" ON saved_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
        AND (u.id = saved_reports.saved_by_user_id OR u.role = 'Owner')
    )
  );

DO $pubadd$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'saved_reports') THEN ALTER PUBLICATION supabase_realtime ADD TABLE saved_reports; END IF; END $pubadd$;


-- ============================================================================
