-- Daily reminder dedupe table.
-- Primary key (user_id, sent_on) enforces at most ONE push send per user per UTC date.
-- Cron inserts a row per eligible user immediately before calling sendPushNotifications,
-- using ON CONFLICT DO NOTHING (supabase-js: upsert with ignoreDuplicates:true).
-- Only user_ids whose insert succeeded (returned from .select()) receive today's push.
-- This replaces the in-memory `lastSendDate` guard in apps/api/src/services/cron.ts,
-- making idempotency restart-proof.

CREATE TABLE public.push_sends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_on date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sent_on)
);

-- RLS: no user should read or write this table directly.
-- Only the service role (used by the cron) writes; no SELECT policy means no authed user can read.
ALTER TABLE public.push_sends ENABLE ROW LEVEL SECURITY;

-- Retention helper: keep ~90 days for debugging send history, then prune.
-- (Actual pruning is a follow-up concern; table is tiny at MVP scale — one row per user per day.)
COMMENT ON TABLE public.push_sends IS
  'Daily push notification dedupe. (user_id, sent_on) enforces one reminder per UTC day. Written by cron via service role; RLS blocks all authed reads/writes.';
