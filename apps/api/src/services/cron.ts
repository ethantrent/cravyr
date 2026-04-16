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

// Track last send to avoid double-sending within the same hour window
let lastSendDate = '';

/**
 * Check if it's time to send the daily reminder.
 * Fires when the current UTC hour matches SEND_HOUR and we haven't sent today.
 */
async function tickDailyReminder(): Promise<void> {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentHour = now.getUTCHours();

  if (currentHour !== SEND_HOUR) return;
  if (lastSendDate === todayKey) return;

  console.log(`[cron] Daily reminder: sending for ${todayKey}`);
  lastSendDate = todayKey;

  try {
    // Find users who have saves from the last 24h AND have push tokens
    const { data: eligibleUsers, error } = await supabaseAdmin
      .from('push_tokens')
      .select('expo_push_token, user_id')
      .order('updated_at', { ascending: false });

    if (error || !eligibleUsers || eligibleUsers.length === 0) {
      console.log('[cron] No eligible users for daily reminder');
      return;
    }

    // Filter to users who actually have recent saves
    const userIds = [...new Set(eligibleUsers.map((u) => u.user_id))];
    const { data: usersWithSaves } = await supabaseAdmin
      .from('saves')
      .select('user_id')
      .in('user_id', userIds)
      .gte('saved_at', new Date(Date.now() - 24 * ONE_HOUR_MS).toISOString());

    if (!usersWithSaves || usersWithSaves.length === 0) {
      console.log('[cron] No users with recent saves');
      return;
    }

    const activeUserIds = new Set(usersWithSaves.map((s) => s.user_id));
    const tokens = eligibleUsers
      .filter((u) => activeUserIds.has(u.user_id))
      .map((u) => u.expo_push_token);

    if (tokens.length === 0) return;

    console.log(`[cron] Sending to ${tokens.length} token(s)`);

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
