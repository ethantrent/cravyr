import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const savesRouter = Router();

savesRouter.use(requireAuth);

/**
 * POST /api/v1/saves
 *
 * Creates or updates a save record (Tonight's Picks entry) for the authenticated user.
 * Body: { restaurant_id: string, interaction_type?: 'right' | 'superlike' }
 *
 * SECURITY (T-04-07-01): userId comes from the verified JWT (req.user.id),
 * never from req.body. Prevents users from creating saves on behalf of others.
 *
 * SECURITY (T-04-07-02): Validates restaurant_id is non-empty string and
 * interaction_type against allowlist ['right', 'superlike']. Rejects invalid input with 400.
 *
 * Upserts on (user_id, restaurant_id) to handle re-saving idempotently (T-04-07-05).
 * Called from restaurant/[id].tsx "Add to Picks" button.
 */
savesRouter.post('/', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { restaurant_id, interaction_type = 'right' } = req.body as {
    restaurant_id: string;
    interaction_type?: string;
  };

  if (!restaurant_id || typeof restaurant_id !== 'string') {
    res.status(400).json({ error: 'restaurant_id is required' });
    return;
  }

  const validTypes = ['right', 'superlike'];
  if (!validTypes.includes(interaction_type)) {
    res.status(400).json({ error: 'interaction_type must be right or superlike' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('saves')
    .upsert(
      { user_id: userId, restaurant_id, interaction_type, saved_at: new Date().toISOString() },
      { onConflict: 'user_id,restaurant_id' }
    )
    .select('id, interaction_type')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
});

/**
 * DELETE /api/v1/saves/:id
 *
 * Removes a save record (Tonight's Picks entry) for the authenticated user.
 *
 * SECURITY (T-04-06-02): The DELETE query filters on BOTH id AND user_id.
 * An authenticated user who knows another save's UUID cannot delete it because
 * user_id will not match their JWT. Returns 404 (not 403) to avoid confirming
 * UUID existence to a potential attacker.
 *
 * Called from saved.tsx after optimistic delete — the UI already removed the item
 * from the local Zustand store before this API call returns.
 */
savesRouter.delete('/:id', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;

  const { error, count } = await supabaseAdmin
    .from('saves')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (count === 0) {
    res.status(404).json({ error: 'Save not found' });
    return;
  }

  res.status(204).send();
});
