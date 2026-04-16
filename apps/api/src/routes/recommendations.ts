import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { LatLngQuerySchema } from '@cravyr/shared';
import { mapDbRowToRestaurant } from '../utils/restaurant-mapper';
import type { DbRestaurantRow } from '../utils/restaurant-mapper';

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
recommendationsRouter.get('/', validate(LatLngQuerySchema, 'query'), async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { lat, lng } = req.query as unknown as { lat: number; lng: number };

  const { data, error } = await supabase.rpc('get_restaurant_recommendations', {
    p_user_id: userId,
    p_lat: lat,
    p_lng: lng,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const restaurants = (data ?? []).map((row: DbRestaurantRow) =>
    mapDbRowToRestaurant(row, lat, lng),
  );

  res.json(restaurants);
});
