import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const swipesRouter = Router();

swipesRouter.use(requireAuth);

const VALID_DIRECTIONS = ['left', 'right', 'superlike'] as const;
type SwipeDirection = typeof VALID_DIRECTIONS[number];

/**
 * POST /api/v1/swipes
 *
 * Records a swipe direction for the authenticated user on a restaurant.
 * Body: { restaurant_id: string, direction: 'left' | 'right' | 'superlike' }
 *
 * SECURITY (T-04-06-01): userId comes from the verified JWT (req.user.id),
 * never from req.body. Attacker-supplied user_id in body is ignored entirely.
 *
 * The DB trigger on the swipes table auto-inserts into saves on right/superlike —
 * Tonight's Picks is populated automatically without a second API call from the client.
 *
 * Upserts on conflict (user_id, restaurant_id) so re-swiping the same restaurant
 * updates the direction rather than violating the unique constraint (T-04-06-05).
 */
swipesRouter.post('/', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { restaurant_id, direction } = req.body as {
    restaurant_id: string;
    direction: SwipeDirection;
  };

  if (!restaurant_id || typeof restaurant_id !== 'string') {
    res.status(400).json({ error: 'restaurant_id is required' });
    return;
  }

  if (!VALID_DIRECTIONS.includes(direction)) {
    res.status(400).json({ error: 'Invalid direction. Must be left, right, or superlike.' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('swipes')
    .upsert(
      { user_id: userId, restaurant_id, direction, swiped_at: new Date().toISOString() },
      { onConflict: 'user_id,restaurant_id' }
    )
    .select('id, direction')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
});

/**
 * DELETE /api/v1/swipes/:id
 *
 * Removes a swipe record for the authenticated user by restaurant_id.
 * The :id param is the restaurant_id (not the swipe record UUID), matching
 * the client call in discover.tsx: DELETE /api/v1/swipes/${restaurant.id}
 *
 * SECURITY (T-04-07-03): Dual filter on restaurant_id AND user_id from JWT.
 * A user cannot delete another user's swipe records.
 *
 * Returns 204 regardless of whether a row was deleted (idempotent) because
 * the undo operation is best-effort.
 */
swipesRouter.delete('/:id', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('swipes')
    .delete()
    .eq('restaurant_id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
