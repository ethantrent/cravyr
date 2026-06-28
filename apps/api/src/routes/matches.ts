import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

/**
 * GET /api/v1/matches?friendIds=uuid1,uuid2
 * Returns restaurants that the current user AND all specified friendIds have saved.
 */
matchesRouter.get('/', async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  const friendIdsParam = req.query.friendIds as string;

  if (!friendIdsParam) {
    return res.json([]);
  }

  const friendIds = friendIdsParam.split(',').filter(Boolean);

  try {
    // Call our new RPC function
    const { data: restaurants, error } = await supabaseAdmin
      .rpc('get_group_matches', {
        p_user_id: userId,
        p_friend_ids: friendIds
      });

    if (error) {
      console.error('get_group_matches error', error);
      throw error;
    }

    res.json(restaurants || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
