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
 * Local hour (0-23) at which to send the daily "Tonight's Picks" reminder to
 * users whose device reported an IANA timezone. Default 18 = 6PM local.
 */
const LOCAL_HOUR = parseInt(process.env.CRON_LOCAL_HOUR ?? '18', 10);

/**
 * Legacy UTC fallback hour for tokens that have no recorded timezone
 * (older app builds). Default 23 ≈ 6PM ET / 7PM CT / 5PM PT.
 */
const SEND_HOUR = parseInt(process.env.CRON_SEND_HOUR ?? '23', 10);

const ONE_HOUR_MS = 60 * 60 * 1000;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

/**
 * Resolve the local hour and calendar date (YYYY-MM-DD) for a given IANA
 * timezone. Returns null for an invalid/unknown timezone.
 */
function localHourAndDate(
  timezone: string,
  now: Date,
): { hour: number; date: string } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hourStr = get('hour');
    if (!year || !month || !day || hourStr === undefined) return null;
    // hour12:false can emit '24' at midnight in some ICU builds — normalize to 0.
    let hour = parseInt(hourStr, 10);
    if (hour === 24) hour = 0;
    return { hour, date: `${year}-${month}-${day}` };
  } catch {
    return null;
  }
}

/**
 * Evaluate the daily reminder once. Runs hourly. A token is "due" when the
 * current time is the target LOCAL_HOUR in its reported timezone (or the legacy
 * UTC SEND_HOUR for tokens without a timezone). Per-user/per-local-date dedupe
 * is enforced by inserting into push_sends with ignoreDuplicates — restart-proof
 * because state lives in Postgres, not memory, and timezone-correct because the
 * dedupe date is the user's local date.
 */
async function tickDailyReminder(): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcDate = now.toISOString().slice(0, 10);

  try {
    // 1. All push tokens (select * so a missing `timezone` column pre-migration
    //    degrades gracefully to the legacy UTC behavior instead of erroring).
    const { data: tokenRows, error: tokenErr } = await supabaseAdmin
      .from('push_tokens')
      .select('*')
      .order('updated_at', { ascending: false });

    if (tokenErr || !tokenRows || tokenRows.length === 0) return;

    // 2. Determine which tokens are due right now, with the local date for dedupe.
    type Due = { token: string; user_id: string; sent_on: string };
    const due: Due[] = [];
    for (const row of tokenRows) {
      const tz: string | null | undefined = row.timezone;
      if (tz) {
        const local = localHourAndDate(tz, now);
        if (local && local.hour === LOCAL_HOUR) {
          due.push({ token: row.expo_push_token, user_id: row.user_id, sent_on: local.date });
        }
      } else if (utcHour === SEND_HOUR) {
        due.push({ token: row.expo_push_token, user_id: row.user_id, sent_on: utcDate });
      }
    }

    if (due.length === 0) return;

    // 3. Restrict to users with saves in the last 24h
    const dueUserIds = [...new Set(due.map((d) => d.user_id))];
    const { data: usersWithSaves } = await supabaseAdmin
      .from('saves')
      .select('user_id')
      .in('user_id', dueUserIds)
      .gte('saved_at', new Date(Date.now() - 24 * ONE_HOUR_MS).toISOString());

    if (!usersWithSaves || usersWithSaves.length === 0) return;

    const activeUserIds = new Set(usersWithSaves.map((s) => s.user_id));
    const activeDue = due.filter((d) => activeUserIds.has(d.user_id));
    if (activeDue.length === 0) return;

    // 4. DB-level dedupe per (user_id, local date). Only newly-inserted rows are
    //    returned, so users already notified for their local day are skipped.
    const claimByKey = new Map(activeDue.map((d) => [`${d.user_id}|${d.sent_on}`, d]));
    const { data: claimedRows, error: claimErr } = await supabaseAdmin
      .from('push_sends')
      .upsert(
        [...claimByKey.values()].map((d) => ({ user_id: d.user_id, sent_on: d.sent_on })),
        { onConflict: 'user_id,sent_on', ignoreDuplicates: true },
      )
      .select('user_id, sent_on');

    if (claimErr) {
      console.error('[cron] push_sends claim error:', claimErr.message);
      return;
    }

    const claimed = new Set((claimedRows ?? []).map((r) => `${r.user_id}|${r.sent_on}`));
    if (claimed.size === 0) return;

    // 5. Send to all due tokens belonging to a freshly-claimed (user, date) pair.
    const tokens = activeDue
      .filter((d) => claimed.has(`${d.user_id}|${d.sent_on}`))
      .map((d) => d.token);

    if (tokens.length === 0) return;

    console.log(
      `[cron] Sending to ${tokens.length} token(s) across ${claimed.size} user-day(s)`,
    );

    const tickets = await sendPushNotifications(
      tokens,
      "Tonight's Picks 🍽️",
      'You have saved restaurants waiting! Tap to see your picks.',
    );

    // Schedule receipt checking 15 minutes later
    if (tickets.length > 0) {
      setTimeout(() => {
        checkReceiptsAndCleanup(tickets).catch(console.error);
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
    `[cron] Started — daily reminder at local hour ${LOCAL_HOUR} (legacy UTC fallback hour ${SEND_HOUR})`,
  );

  // Check every hour
  setInterval(() => {
    tickDailyReminder().catch(console.error);
  }, ONE_HOUR_MS);

  // Also check immediately on startup (in case server restarts during the send window)
  tickDailyReminder().catch(console.error);
}
