import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { createClient } from '@supabase/supabase-js';

const expo = new Expo();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * A successfully-enqueued push, pairing Expo's receipt/ticket id with the token
 * it was sent to. Keeping the token alongside the ticket id is what lets us
 * remove dead tokens once receipts come back.
 */
export interface SentTicket {
  ticketId: string;
  token: string;
}

/**
 * Send push notifications to a list of Expo push tokens.
 * Chunks into batches of 100 per Expo's rate limit.
 * Returns the ticket id + token pairs for receipt checking.
 */
export async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
): Promise<SentTicket[]> {
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
  if (validTokens.length === 0) return [];

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default' as const,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const sent: SentTicket[] = [];

  // chunkPushNotifications preserves message order, and sendPushNotificationsAsync
  // returns tickets in the same order as the chunk it was given, so we can map each
  // ticket back to its token by position within the validTokens array.
  let cursor = 0;
  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] =
        await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        const token = validTokens[cursor + i];
        if (ticket.status === 'ok' && ticket.id && token) {
          sent.push({ ticketId: ticket.id, token });
        }
      });
    } catch (err) {
      console.error('Push send error:', err);
    }
    cursor += chunk.length;
  }

  return sent;
}

/**
 * Check push notification receipts and delete tokens that are no longer valid
 * (DeviceNotRegistered). Should be called ~15 minutes after sending to allow
 * Expo to process the receipts.
 */
export async function checkReceiptsAndCleanup(
  sent: SentTicket[],
): Promise<void> {
  if (sent.length === 0) return;

  const tokenByTicketId = new Map(sent.map((s) => [s.ticketId, s.token]));
  const ticketIds = sent.map((s) => s.ticketId);
  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (
          receipt.status === 'error' &&
          receipt.details?.error === 'DeviceNotRegistered'
        ) {
          const token = tokenByTicketId.get(receiptId);
          if (token) invalidTokens.push(token);
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
