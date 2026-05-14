-- Web Push subscriptions: one row per (user, browser endpoint).
--
-- The notify-push Edge Function reads from this table with the service
-- role and fans Web Push messages out to every matching subscription.
-- The frontend writes here via the user's anon-key session so RLS scopes
-- the row to that user.
--
-- The endpoint URL is the natural unique key — re-running subscribe()
-- on the same browser hits ON CONFLICT (endpoint) and refreshes the
-- last_seen_at + user_id mapping (handy when a different employee logs
-- in on a shared terminal).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id    uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  device_label text,
  user_agent   text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_branch_id_idx
  ON public.push_subscriptions(branch_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user can see / write only their own subscriptions. The notify-push
-- Edge Function uses the service role and bypasses RLS, so it sees all
-- rows regardless of these policies.
CREATE POLICY "Users select own push_subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));

CREATE POLICY "Users insert own push_subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));

CREATE POLICY "Users update own push_subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));

CREATE POLICY "Users delete own push_subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid())));
