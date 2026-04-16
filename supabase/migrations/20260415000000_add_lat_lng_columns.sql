-- Add explicit lat/lng columns so API responses don't depend on PostGIS binary parsing.
-- The geography column remains the source of truth for spatial queries.

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS lng double precision;

-- Backfill from existing geography data
UPDATE public.restaurants
SET lat = extensions.ST_Y(location::extensions.geometry),
    lng = extensions.ST_X(location::extensions.geometry)
WHERE lat IS NULL AND location IS NOT NULL;

-- Recreate upsert_restaurant to also persist lat/lng
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
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO restaurants (
    external_id, source, name, location, lat, lng,
    address, photo_urls, cuisines, price_level, geohash, cached_at
  )
  VALUES (
    p_external_id,
    p_source,
    p_name,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    p_lat,
    p_lng,
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
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
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

-- Drop and recreate get_restaurant_recommendations (return type changed from SETOF restaurants to TABLE)
DROP FUNCTION IF EXISTS public.get_restaurant_recommendations(uuid, double precision, double precision, integer, integer);
CREATE FUNCTION public.get_restaurant_recommendations(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer DEFAULT 5000,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  external_id text,
  source text,
  name text,
  lat double precision,
  lng double precision,
  address text,
  city text,
  state text,
  photo_urls text[],
  cuisines text[],
  price_level integer,
  rating double precision,
  review_count integer,
  phone_number text,
  hours jsonb,
  is_active boolean,
  cached_at timestamptz,
  geohash text,
  distance_km double precision
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user_location geometry;
  v_cuisines       TEXT[];
  v_price_range    INT[];
BEGIN
  v_user_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  SELECT up.cuisines, up.price_range
  INTO v_cuisines, v_price_range
  FROM user_preferences up
  WHERE up.user_id = p_user_id;

  RETURN QUERY
  SELECT
    r.id, r.external_id, r.source, r.name,
    r.lat, r.lng,
    r.address, r.city, r.state,
    r.photo_urls, r.cuisines, r.price_level,
    r.rating, r.review_count, r.phone_number, r.hours,
    r.is_active, r.cached_at, r.geohash,
    ROUND((ST_Distance(r.location::geography, v_user_location::geography) / 1000.0)::numeric, 2)::double precision AS distance_km
  FROM restaurants r
  WHERE r.is_active = true
    AND ST_DWithin(
      r.location::geography,
      v_user_location::geography,
      p_radius_m
    )
    AND NOT EXISTS (
      SELECT 1 FROM swipes s
      WHERE s.user_id = p_user_id
        AND s.restaurant_id = r.id
        AND s.swiped_at > NOW() - INTERVAL '7 days'
    )
  ORDER BY
    (
      (1.0 - (ST_Distance(r.location::geography, v_user_location::geography) / p_radius_m)) * 0.40
      + CASE
          WHEN v_cuisines IS NOT NULL AND r.cuisines && v_cuisines THEN 1.0
          ELSE 0.0
        END * 0.25
      + ((COALESCE(r.rating, 3.0) - 1.0) / 4.0) * 0.20
      + CASE
          WHEN v_price_range IS NOT NULL AND r.price_level = ANY(v_price_range) THEN 1.0
          ELSE 0.2
        END * 0.15
    ) DESC
  LIMIT p_limit;
END;
$function$;
