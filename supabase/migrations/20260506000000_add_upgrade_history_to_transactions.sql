-- Track service upgrades performed on a transaction after checkout (e.g. when a
-- room operator swaps the in-progress service for a more expensive one). Each
-- entry captures the from/to service names, the price delta, who did it, and
-- when, so Service History can render an "upgraded from X to Y" annotation.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS upgrade_history JSONB;
