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
