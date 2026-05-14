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

CREATE POLICY "read saved_reports same business" ON saved_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

CREATE POLICY "insert saved_reports same business" ON saved_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

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

ALTER PUBLICATION supabase_realtime ADD TABLE saved_reports;
