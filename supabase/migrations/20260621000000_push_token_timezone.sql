-- Per-user timezone for push notifications.
-- Each device reports its IANA timezone (e.g. 'America/New_York') on token
-- registration so the daily reminder fires at the user's LOCAL hour instead of
-- a single global UTC hour. Nullable for backward compatibility: tokens without
-- a timezone fall back to the legacy UTC send hour in the cron job.

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS timezone text;
