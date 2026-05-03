CREATE TABLE saved_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,
  branch_name TEXT,

  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT,

  saved_by_user_id UUID,
  saved_by_name TEXT,

  rows JSONB NOT NULL,
  summary JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_payrolls_business_created
  ON saved_payrolls(business_id, created_at DESC);
CREATE INDEX idx_saved_payrolls_branch
  ON saved_payrolls(branch_id);
CREATE INDEX idx_saved_payrolls_period
  ON saved_payrolls(business_id, period_start, period_end);

ALTER TABLE saved_payrolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read saved_payrolls same business" ON saved_payrolls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
    )
  );

CREATE POLICY "insert saved_payrolls same business" ON saved_payrolls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
    )
  );

CREATE POLICY "delete saved_payrolls creator or owner" ON saved_payrolls
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
        AND (u.id = saved_payrolls.saved_by_user_id OR u.role = 'Owner')
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE saved_payrolls;
