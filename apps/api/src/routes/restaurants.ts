import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Simple in-memory cache: 2-hour TTL per CLAUDE.md guidance for individual restaurant details
const restaurantCache = new Map<string, { data: unknown; expiresAt: number }>();

export const restaurantsRouter = Router();

/**
 * GET /api/v1/restaurants/:id
 *
 * Returns a restaurant row from Supabase by its UUID.
 * No auth required — restaurant data is non-sensitive public information
 * (name, address, photos). Consistent with the business model (T-04-06-03: accepted).
 *
 * photo_urls contains Google Places photo reference strings — the mobile client
 * hotlinks them per Google Places ToS (no downloading to own storage).
 *
 * Results cached in-memory for 2 hours to reduce Supabase read load.
 * Cache resets on server cold start (acceptable — restaurant data changes slowly).
 */
restaurantsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check cache first
  const cached = restaurantCache.get(`restaurant:${id}`);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.data);
    return;
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Restaurant not found' });
    return;
  }

  // Cache for 2 hours (7,200,000 ms)
  restaurantCache.set(`restaurant:${id}`, { data, expiresAt: Date.now() + 7_200_000 });

  res.json(data);
});
