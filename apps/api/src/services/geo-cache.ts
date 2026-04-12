/**
 * Geohash cache orchestration with two-layer caching and daily budget.
 *
 * Architecture (D-01 through D-04, D-12):
 *   Layer 1: node-cache hot layer (1hr TTL) -- serves active cells instantly
 *   Layer 2: Supabase geo_cache table (24hr TTL) -- survives cold starts
 *   Layer 3: Google Places API Nearby Search -- cache miss source
 *
 * The daily budget counter (D-12) caps Google API calls at 500/day.
 * When exhausted, new cells return empty with cache_only flag.
 *
 * Stale cells (>24hr) serve existing data while refreshing in background (D-03).
 */

import NodeCache from 'node-cache';
import ngeohash from 'ngeohash';
import { createClient } from '@supabase/supabase-js';
import { searchNearby, mapPlaceToRestaurant } from './places';

// ---------------------------------------------------------------------------
// Supabase client (service role for writes to restaurants + geo_cache)
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// node-cache instances
// ---------------------------------------------------------------------------

/** Hot cache for geo cells -- 1 hour TTL, check every 10 minutes */
const geoCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

/** Hot cache for daily budget counter -- 24 hour TTL, check every 1 hour */
const budgetCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedCell {
  restaurants: Record<string, unknown>[];
  fetchedAt: string;
}

export interface NearbyResult {
  restaurants: Record<string, unknown>[];
  source: 'memory' | 'database' | 'stale' | 'google_places';
  cache_only?: boolean;
  cache_refreshing?: boolean;
}

// ---------------------------------------------------------------------------
// Staleness check
// ---------------------------------------------------------------------------

function isStale(fetchedAt: string, ttlMs: number): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > ttlMs;
}

// ---------------------------------------------------------------------------
// Budget functions (D-12)
// ---------------------------------------------------------------------------

function getDailyKey(): string {
  return `budget:${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Check whether the daily Google API request budget (500) is exhausted.
 * Checks node-cache first, falls back to Supabase api_budget table
 * to survive cold restarts (Pitfall 7).
 */
export async function isBudgetExhausted(): Promise<boolean> {
  const key = getDailyKey();
  const cached = budgetCache.get<number>(key);
  if (cached !== undefined) return cached >= 500;

  // Cold start fallback: check Supabase
  const { data } = await supabase
    .from('api_budget')
    .select('request_count')
    .eq('date_key', new Date().toISOString().slice(0, 10))
    .single();

  if (data) {
    budgetCache.set(key, data.request_count);
    return data.request_count >= 500;
  }

  return false; // New day, no requests yet
}

/**
 * Increment the daily Google API request counter.
 * Persists to Supabase api_budget table (fire-and-forget) so it survives
 * cold starts on Render free tier.
 */
export async function incrementBudgetCount(count: number = 1): Promise<number> {
  const key = getDailyKey();
  const current = budgetCache.get<number>(key) ?? 0;
  const newCount = current + count;
  budgetCache.set(key, newCount);

  // Persist to Supabase (fire-and-forget to avoid blocking the response)
  Promise.resolve(
    supabase
      .from('api_budget')
      .upsert(
        {
          date_key: new Date().toISOString().slice(0, 10),
          request_count: newCount,
          cache_only_mode: newCount >= 500,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'date_key' },
      ),
  ).catch(console.error);

  return newCount;
}

// ---------------------------------------------------------------------------
// Core: getRestaurantsForLocation
// ---------------------------------------------------------------------------

/**
 * Main entry point for the nearby restaurants endpoint.
 *
 * 1. Encodes lat/lng to geohash precision 5 (~5km cells per D-01)
 * 2. Checks node-cache hot layer (Layer 1)
 * 3. Checks Supabase geo_cache cold layer (Layer 2)
 * 4. Fetches from Google Places API on miss (Layer 3)
 *
 * Stale cells (>24hr) serve existing data while refreshing in background (D-03).
 * Budget exhaustion returns cache_only flag (D-12).
 */
export async function getRestaurantsForLocation(
  lat: number,
  lng: number,
): Promise<NearbyResult> {
  const hash = ngeohash.encode(lat, lng, 5);

  // Layer 1: node-cache (hot)
  const cached = geoCache.get<CachedCell>(hash);
  if (cached) {
    return { restaurants: cached.restaurants, source: 'memory' };
  }

  // Layer 2: Supabase geo_cache (cold)
  const { data: dbCell } = await supabase
    .from('geo_cache')
    .select('geohash, fetched_at, restaurant_count')
    .eq('geohash', hash)
    .single();

  if (dbCell && !isStale(dbCell.fetched_at, 24 * 60 * 60 * 1000)) {
    // Fresh cell -- load restaurants and warm hot cache
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*')
      .eq('geohash', hash)
      .eq('is_active', true);

    const rows = restaurants ?? [];
    geoCache.set(hash, { restaurants: rows, fetchedAt: dbCell.fetched_at });
    return { restaurants: rows, source: 'database' };
  }

  if (dbCell) {
    // Stale cell -- serve existing data, refresh in background (D-03)
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*')
      .eq('geohash', hash)
      .eq('is_active', true);

    const rows = restaurants ?? [];
    refreshCellInBackground(hash, lat, lng);
    return { restaurants: rows, source: 'stale', cache_refreshing: true };
  }

  // Complete miss -- check budget before hitting Google API
  if (await isBudgetExhausted()) {
    return { restaurants: [], source: 'memory', cache_only: true };
  }

  const restaurants = await fetchAndCacheCell(hash, lat, lng);
  return { restaurants, source: 'google_places' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch restaurants from Google Places API, upsert into Supabase,
 * update geo_cache metadata, and warm node-cache.
 */
async function fetchAndCacheCell(
  hash: string,
  lat: number,
  lng: number,
): Promise<Record<string, unknown>[]> {
  const places = await searchNearby(lat, lng);
  await incrementBudgetCount(1);

  // Upsert each place into restaurants table via the RPC function
  for (const place of places) {
    const mapped = mapPlaceToRestaurant(place, hash);
    // Pass raw lat/lng to the RPC -- it constructs geography via ST_MakePoint
    await supabase.rpc('upsert_restaurant', {
      p_external_id: mapped.external_id,
      p_source: mapped.source,
      p_name: mapped.name,
      p_lng: place.location.longitude,
      p_lat: place.location.latitude,
      p_address: mapped.address,
      p_photo_urls: mapped.photo_urls,
      p_cuisines: mapped.cuisines,
      p_price_level: mapped.price_level,
      p_geohash: hash,
    });
  }

  // Upsert geo_cache metadata
  await supabase.from('geo_cache').upsert(
    {
      geohash: hash,
      center_lat: lat,
      center_lng: lng,
      fetched_at: new Date().toISOString(),
      restaurant_count: places.length,
      request_count: 1,
    },
    { onConflict: 'geohash' },
  );

  // Load the full restaurant rows back (to get UUIDs and complete data)
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('*')
    .eq('geohash', hash)
    .eq('is_active', true);

  const rows = restaurants ?? [];
  geoCache.set(hash, {
    restaurants: rows,
    fetchedAt: new Date().toISOString(),
  });

  return rows;
}

/**
 * Background refresh for stale geo cells (D-03).
 * Fires and forgets -- does NOT block the response.
 * Marks the cell as refreshing, fetches fresh data, then clears the flag.
 */
function refreshCellInBackground(
  hash: string,
  lat: number,
  lng: number,
): void {
  // Mark cell as refreshing (fire-and-forget)
  Promise.resolve(
    supabase
      .from('geo_cache')
      .update({ is_refreshing: true })
      .eq('geohash', hash),
  ).catch(console.error);

  fetchAndCacheCell(hash, lat, lng)
    .then(async () => {
      await supabase
        .from('geo_cache')
        .update({ is_refreshing: false })
        .eq('geohash', hash);
    })
    .catch(async (err) => {
      console.error(`Background refresh failed for cell ${hash}:`, err);
      await supabase
        .from('geo_cache')
        .update({ is_refreshing: false })
        .eq('geohash', hash);
    });
}
