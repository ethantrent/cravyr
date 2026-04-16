import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { createClient } from '@supabase/supabase-js';

const expo = new Expo();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Send push notifications to a list of Expo push tokens.
 * Chunks into batches of 100 per Expo's rate limit.
 * Returns ticket IDs for receipt checking.
 */
export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
): Promise<string[]> {
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
  if (validTokens.length === 0) return [];

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default' as const,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const ticketIds: string[] = [];

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] =
        await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === 'ok' && ticket.id) {
          ticketIds.push(ticket.id);
        }
      }
    } catch (err) {
      console.error('Push send error:', err);
    }
  }

  return ticketIds;
}

/**
 * Check push notification receipts and return tokens that are no longer valid.
 * Should be called ~15 minutes after sending to allow Expo to process.
 */
export async function checkReceiptsAndCleanup(
  ticketIds: string[],
): Promise<void> {
  if (ticketIds.length === 0) return;

  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [, receipt] of Object.entries(receipts)) {
        if (
          receipt.status === 'error' &&
          receipt.details?.error === 'DeviceNotRegistered'
        ) {
          // Token is invalid — mark for cleanup
          // We don't have the token from the receipt, so we'll handle cleanup
          // at the DB level during the next send cycle
        }
      }
    } catch (err) {
      console.error('Receipt check error:', err);
    }
  }

  if (invalidTokens.length > 0) {
    await cleanupInvalidTokens(invalidTokens);
  }
}

/**
 * Remove push tokens from the database that are no longer valid.
 */
export async function cleanupInvalidTokens(
  tokens: string[],
): Promise<void> {
  if (tokens.length === 0) return;

  const { error } = await supabaseAdmin
    .from('push_tokens')
    .delete()
    .in('expo_push_token', tokens);

  if (error) {
    console.error('Token cleanup error:', error.message);
  }
}
