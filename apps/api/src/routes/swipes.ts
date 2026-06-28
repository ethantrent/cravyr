import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { SwipeBodySchema } from '@cravyr/shared';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const swipesRouter = Router();

swipesRouter.use(requireAuth);

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
swipesRouter.post('/', validate(SwipeBodySchema, 'body'), async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { restaurant_id, direction } = req.body;

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

  let matchNames: string[] = [];
  if (direction === 'right' || direction === 'superlike') {
    const { data: connections } = await supabaseAdmin
      .from('connections')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (connections && connections.length > 0) {
      const friendIds = connections.map(c => 
        c.user1_id === userId ? c.user2_id : c.user1_id
      );

      const { data: friendSaves } = await supabaseAdmin
        .from('saves')
        .select('user_id')
        .eq('restaurant_id', restaurant_id)
        .in('user_id', friendIds);

      if (friendSaves && friendSaves.length > 0) {
        const matchedFriendIds = friendSaves.map(s => s.user_id);
        
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        if (usersData?.users) {
          matchNames = usersData.users
            .filter(u => matchedFriendIds.includes(u.id))
            .map(u => u.user_metadata?.full_name || u.email?.split('@')[0] || 'A friend');
        }
      }
    }
  }

  res.status(201).json({ success: true, matches: matchNames, ...data });
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
