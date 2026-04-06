import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const recommendationsRouter = Router();

recommendationsRouter.use(requireAuth);

/**
 * GET /api/v1/recommendations?lat=XX&lng=YY
 *
 * Calls the Supabase PostGIS RPC function `get_restaurant_recommendations`
 * which scores nearby restaurants by:
 *   - Distance (40%) — exponential decay from user location
 *   - Cuisine match (25%) — overlap with user preferences
 *   - Rating (20%) — normalized Google Places rating
 *   - Price match (15%) — alignment with user price range preference
 *
 * Already-swiped restaurants are excluded server-side by the SQL function.
 * Returns scored restaurant array ordered by rank descending.
 *
 * SECURITY (T-04-06-04): requireAuth ensures only authenticated users get their
 * personalized deck. userId comes from req.user?.id (JWT), not query params.
 */
recommendationsRouter.get('/', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'lat and lng query parameters are required and must be numbers' });
    return;
  }

  const { data, error } = await supabase.rpc('get_restaurant_recommendations', {
    p_user_id: userId,
    p_lat: lat,
    p_lng: lng,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data ?? []);
});
