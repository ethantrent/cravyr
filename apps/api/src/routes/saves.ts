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
