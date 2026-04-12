/**
 * Restaurant endpoints:
 *   GET /nearby      - Geohash-cached cluster fetch with budget awareness
 *   GET /:id/photos  - Resolve photo resource names to fresh Google URLs (D-07)
 *   GET /:id         - Restaurant detail with lazy Enterprise field fetch (D-10)
 *
 * Route order matters: /nearby and /:id/photos BEFORE /:id to prevent
 * Express from matching named paths as :id.
 *
 * All endpoints are public -- restaurant data is non-sensitive.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import NodeCache from 'node-cache';
import { getRestaurantsForLocation } from '../services/geo-cache';
import {
  getPlaceDetails,
  resolvePhotoUrl,
  mapPlaceDetailToUpdate,
} from '../services/places';

// ---------------------------------------------------------------------------
// Supabase clients
// ---------------------------------------------------------------------------

/** Anon key for public reads */
const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

/** Service role key for restaurant updates (lazy Enterprise field writes) */
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// Detail cache -- 2 hour TTL per CLAUDE.md guidance
// ---------------------------------------------------------------------------

const detailCache = new NodeCache({ stdTTL: 7200, checkperiod: 600 });

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const restaurantsRouter = Router();

// ---------------------------------------------------------------------------
// GET /nearby -- Geohash-cached restaurant fetch
// ---------------------------------------------------------------------------

restaurantsRouter.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res
      .status(400)
      .json({
        error: 'lat and lng query parameters are required and must be numbers',
      });
    return;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res
      .status(400)
      .json({ error: 'lat must be -90 to 90, lng must be -180 to 180' });
    return;
  }

  const result = await getRestaurantsForLocation(lat, lng);

  res.json({
    restaurants: result.restaurants,
    meta: {
      source: result.source,
      cache_only: result.cache_only ?? false,
      cache_refreshing: result.cache_refreshing ?? false,
      count: result.restaurants.length,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /:id/photos -- Resolve photo references to fresh Google URLs (D-07)
// ---------------------------------------------------------------------------

restaurantsRouter.get(
  '/:id/photos',
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ error: 'Invalid restaurant ID format' });
      return;
    }

    // Try detail cache first for the restaurant data
    const cached = detailCache.get<Record<string, unknown>>(`restaurant:${id}`);
    let restaurant: Record<string, unknown> | null = cached ?? null;

    if (!restaurant) {
      const { data, error } = await supabaseAnon
        .from('restaurants')
        .select('id, photo_urls')
        .eq('id', id)
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'Restaurant not found' });
        return;
      }

      restaurant = data as Record<string, unknown>;
    }

    const photoUrls = (restaurant.photo_urls as string[] | null) ?? [];

    if (photoUrls.length === 0) {
      res.json({ photos: [] });
      return;
    }

    const rawMaxWidth = req.query.maxWidth;
    const maxWidth =
      parseInt(
        (Array.isArray(rawMaxWidth) ? rawMaxWidth[0] : rawMaxWidth) as string,
        10,
      ) || 800;

    const results = await Promise.allSettled(
      photoUrls.map((name: string) => resolvePhotoUrl(name, maxWidth)),
    );

    const photos = results
      .filter(
        (r): r is PromiseFulfilledResult<string | null> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value)
      .filter((url): url is string => url !== null);

    res.json({ photos });
  },
);

// ---------------------------------------------------------------------------
// GET /:id -- Restaurant detail with lazy Enterprise field fetch (D-10)
// ---------------------------------------------------------------------------

restaurantsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!UUID_REGEX.test(id)) {
    res.status(400).json({ error: 'Invalid restaurant ID format' });
    return;
  }

  // Check detail cache first
  const cached = detailCache.get<Record<string, unknown>>(`restaurant:${id}`);
  if (cached) {
    res.json(cached);
    return;
  }

  const { data, error } = await supabaseAnon
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Restaurant not found' });
    return;
  }

  // Lazy Enterprise field fetch (D-10): if rating is null and we have
  // an external_id, fetch expensive fields from Google Places on first tap.
  if (data.rating === null && data.external_id) {
    try {
      const detail = await getPlaceDetails(data.external_id);
      const update = mapPlaceDetailToUpdate(detail);
      // Update DB with Enterprise fields
      await supabaseAdmin
        .from('restaurants')
        .update(update)
        .eq('id', data.id);
      // Merge update into response
      Object.assign(data, update);
    } catch (err) {
      // Non-fatal: serve what we have, log the error
      console.error(
        `Failed to fetch detail for ${data.external_id}:`,
        err,
      );
    }
  }

  detailCache.set(`restaurant:${id}`, data);
  res.json(data);
});
