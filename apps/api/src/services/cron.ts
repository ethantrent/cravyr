import { createClient } from '@supabase/supabase-js';
import {
  sendPushNotifications,
  checkReceiptsAndCleanup,
} from './push';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * UTC hour at which to send the daily "Tonight's Picks" reminder.
 * Default 23 ≈ 6PM ET / 7PM CT / 5PM PT — acceptable for US-centric MVP.
 * Override via CRON_SEND_HOUR env var for timezone adjustment.
 */
const SEND_HOUR = parseInt(process.env.CRON_SEND_HOUR ?? '23', 10);

const ONE_HOUR_MS = 60 * 60 * 1000;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

/**
 * Check if it's time to send the daily reminder.
 * Fires when the current UTC hour matches SEND_HOUR.
 * Per-user dedupe is enforced by inserting into push_sends (user_id, sent_on)
 * with ignoreDuplicates — restart-proof because state lives in Postgres, not memory.
 */
async function tickDailyReminder(): Promise<void> {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentHour = now.getUTCHours();

  if (currentHour !== SEND_HOUR) return;

  console.log(`[cron] Daily reminder: evaluating for ${todayKey}`);

  try {
    // 1. Candidate users: have a push token
    const { data: tokenRows, error: tokenErr } = await supabaseAdmin
      .from('push_tokens')
      .select('expo_push_token, user_id')
      .order('updated_at', { ascending: false });

    if (tokenErr || !tokenRows || tokenRows.length === 0) {
      console.log('[cron] No eligible users for daily reminder');
      return;
    }

    // 2. Restrict to users with saves in the last 24h
    const candidateUserIds = [...new Set(tokenRows.map((u) => u.user_id))];
    const { data: usersWithSaves } = await supabaseAdmin
      .from('saves')
      .select('user_id')
      .in('user_id', candidateUserIds)
      .gte('saved_at', new Date(Date.now() - 24 * ONE_HOUR_MS).toISOString());

    if (!usersWithSaves || usersWithSaves.length === 0) {
      console.log('[cron] No users with recent saves');
      return;
    }

    const activeUserIds = [...new Set(usersWithSaves.map((s) => s.user_id))];

    // 3. DB-level dedupe: insert (user_id, todayKey) with ignore-on-conflict.
    //    Only user_ids whose row was newly inserted are returned — these are the users
    //    who have NOT already received today's reminder. Users whose row already exists
    //    (e.g. from a previous tick or a pre-restart send) are silently skipped.
    const { data: claimedRows, error: claimErr } = await supabaseAdmin
      .from('push_sends')
      .upsert(
        activeUserIds.map((user_id) => ({ user_id, sent_on: todayKey })),
        { onConflict: 'user_id,sent_on', ignoreDuplicates: true },
      )
      .select('user_id');

    if (claimErr) {
      console.error('[cron] push_sends claim error:', claimErr.message);
      return;
    }

    const claimedUserIds = new Set((claimedRows ?? []).map((r) => r.user_id));
    if (claimedUserIds.size === 0) {
      console.log(`[cron] All eligible users already notified for ${todayKey}`);
      return;
    }

    // 4. Resolve tokens for the claimed subset only
    const tokens = tokenRows
      .filter((u) => claimedUserIds.has(u.user_id))
      .map((u) => u.expo_push_token);

    if (tokens.length === 0) return;

    console.log(
      `[cron] Sending to ${tokens.length} token(s) across ${claimedUserIds.size} user(s) for ${todayKey}`,
    );

    const ticketIds = await sendPushNotifications(
      tokens,
      "Tonight's Picks 🍽️",
      'You have saved restaurants waiting! Tap to see your picks.',
    );

    // Schedule receipt checking 15 minutes later
    if (ticketIds.length > 0) {
      setTimeout(() => {
        checkReceiptsAndCleanup(ticketIds).catch(console.error);
      }, RECEIPT_DELAY_MS);
    }
  } catch (err) {
    console.error('[cron] Daily reminder error:', err);
  }
}

/**
 * Start all cron jobs. Call once from server.ts after app.listen().
 */
export function startCronJobs(): void {
  console.log(
    `[cron] Started — daily reminder at UTC hour ${SEND_HOUR}`,
  );

  // Check every hour
  setInterval(() => {
    tickDailyReminder().catch(console.error);
  }, ONE_HOUR_MS);

  // Also check immediately on startup (in case server restarts during the send window)
  tickDailyReminder().catch(console.error);
}
