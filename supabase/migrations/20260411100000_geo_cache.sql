-- Migration: Add geo_cache table and geohash column for geographic cluster caching
-- Supports D-01 (geohash grid), D-04 (geo_cache table), D-12 (request tracking)

-- geo_cache table: stores metadata for each geohash cell
CREATE TABLE public.geo_cache (
  geohash text PRIMARY KEY,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  restaurant_count integer NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  is_refreshing boolean NOT NULL DEFAULT false
);

-- Index for finding stale cells (ORDER BY fetched_at for batch refresh)
CREATE INDEX geo_cache_fetched_at_idx ON public.geo_cache (fetched_at);

-- Add geohash column to restaurants for efficient per-cell lookups
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS geohash text;
CREATE INDEX restaurants_geohash_idx ON public.restaurants (geohash);

-- RLS on geo_cache: public read (non-sensitive), service role writes
ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY geo_cache_public_read ON public.geo_cache
  FOR SELECT USING (true);

-- Daily API budget tracking table (survives cold starts per Pitfall 7)
CREATE TABLE public.api_budget (
  date_key date PRIMARY KEY DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  cache_only_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_budget_public_read ON public.api_budget
  FOR SELECT USING (true);

-- Function to upsert restaurants from Google Places API response
-- Handles the geography(POINT) insert via ST_MakePoint (avoiding WKT format issues per A1)
CREATE OR REPLACE FUNCTION public.upsert_restaurant(
  p_external_id text,
  p_source text,
  p_name text,
  p_lng double precision,
  p_lat double precision,
  p_address text,
  p_photo_urls text[],
  p_cuisines text[],
  p_price_level integer,
  p_geohash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO restaurants (external_id, source, name, location, address, photo_urls, cuisines, price_level, geohash, cached_at)
  VALUES (
    p_external_id,
    p_source,
    p_name,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    p_address,
    p_photo_urls,
    p_cuisines,
    p_price_level,
    p_geohash,
    now()
  )
  ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    address = EXCLUDED.address,
    photo_urls = EXCLUDED.photo_urls,
    cuisines = EXCLUDED.cuisines,
    price_level = EXCLUDED.price_level,
    geohash = EXCLUDED.geohash,
    cached_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
