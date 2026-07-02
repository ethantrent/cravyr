import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { randomBytes } from 'crypto';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const connectionsRouter = Router();

connectionsRouter.use(requireAuth);

/**
 * GET /api/v1/connections
 * Fetch all connections for the current user, joined with auth.users for names.
 */
connectionsRouter.get('/', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    // We need to query connections where user1_id = userId OR user2_id = userId.
    const { data: connections, error } = await supabaseAdmin
      .from('connections')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (error) throw error;

    // Extract friend IDs
    const friendIds = connections.map((c) =>
      c.user1_id === userId ? c.user2_id : c.user1_id
    );

    if (friendIds.length === 0) {
      return res.json([]);
    }

    // Fetch user profiles (full_name) from auth.users (via admin client because auth.users is restricted)
    // NOTE: In a real app we'd query a public.profiles table. Here we hack it via admin auth users or an RPC.
    // For MVP, we will query auth.users if we have access, or if there's a profiles view.
    // Let's create an RPC to fetch names, or we can just fetch via admin.
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.warn('Failed to fetch names', usersError);
      // Fallback: just return IDs
      return res.json(friendIds.map(id => ({ id, name: 'Unknown Friend' })));
    }

    const friends = usersData.users
      .filter((u: any) => friendIds.includes(u.id))
      .map((u: any) => ({
        id: u.id,
        name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Friend',
      }));

    res.json(friends);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/connections/code
 * Generate a 6-digit connection code
 */
connectionsRouter.post('/code', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const code = Array.from(randomBytes(6))
    .map((b) => (b % 10).toString())
    .join('');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('connection_codes')
    .insert({ code, user_id: userId, expires_at: expiresAt });

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Code collision, try again' });
    }
    return res.status(500).json({ error: error.message });
  }

  res.json({ code, expires_at: expiresAt });
});

const LinkBodySchema = z.object({
  code: z.string().length(6),
});

/**
 * POST /api/v1/connections/link
 * Use a 6-digit code to create a connection
 */
connectionsRouter.post('/link', validate(LinkBodySchema, 'body'), async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { code } = res.locals.validated as { code: string };

  try {
    // 1. Find valid code
    const { data, error } = await supabaseAdmin
      .from('connection_codes')
      .select('user_id')
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Invalid or expired code' });
    }

    const friendId = data.user_id;
    if (friendId === userId) {
      return res.status(400).json({ error: 'Cannot connect with yourself' });
    }

    // 2. Create connection (enforce user1_id < user2_id)
    const user1_id = userId < friendId ? userId : friendId;
    const user2_id = userId < friendId ? friendId : userId;

    const { error: insertError } = await supabaseAdmin
      .from('connections')
      .insert({ user1_id, user2_id })
      .select()
      .single();

    if (insertError) {
      // 23505 = unique_violation
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'Already connected' });
      }
      throw insertError;
    }

    // 3. Cleanup code (optional, let it expire is fine)
    await supabaseAdmin.from('connection_codes').delete().eq('code', code);

    res.json({ success: true, friendId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/connections/:friendId
 */
connectionsRouter.delete('/:friendId', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const friendId = req.params.friendId;

  const user1_id = userId < friendId ? userId : friendId;
  const user2_id = userId < friendId ? friendId : userId;

  const { error } = await supabaseAdmin
    .from('connections')
    .delete()
    .eq('user1_id', user1_id)
    .eq('user2_id', user2_id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});
