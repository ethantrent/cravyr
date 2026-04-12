-- Migration: Capture existing remote schema
-- Generated from live Supabase project dxkvtcpgqkbkhjshvqji
-- Tables: restaurants, swipes, saves, user_preferences
-- Includes: PostGIS, RLS policies, triggers, recommendation function

-- PostGIS extension (already enabled in extensions schema)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA "extensions";

--
-- Tables
--

CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,
  source text NOT NULL DEFAULT 'google_places' CHECK (source IN ('google_places', 'yelp')),
  name text NOT NULL,
  location extensions.geography(POINT) NOT NULL,
  address text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  photo_urls text[] DEFAULT '{}',
  cuisines text[] DEFAULT '{}',
  price_level integer CHECK (price_level >= 1 AND price_level <= 4),
  rating double precision CHECK (rating >= 0 AND rating <= 5),
  review_count integer DEFAULT 0,
  phone_number text,
  hours jsonb,
  is_active boolean DEFAULT true,
  cached_at timestamptz DEFAULT now()
);

CREATE TABLE public.swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('left', 'right', 'superlike')),
  swiped_at timestamptz DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

CREATE TABLE public.saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  interaction_type text NOT NULL DEFAULT 'right' CHECK (interaction_type IN ('right', 'superlike')),
  saved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cuisines text[] DEFAULT '{}',
  price_range integer[] DEFAULT '{1,2,3,4}',
  max_distance_km integer DEFAULT 5 CHECK (max_distance_km = ANY (ARRAY[1, 5, 15])),
  updated_at timestamptz DEFAULT now()
);

--
-- Indexes
--

CREATE INDEX restaurants_geo_idx ON public.restaurants USING GIST (location);
CREATE INDEX restaurants_cuisines_idx ON public.restaurants USING GIN (cuisines);
CREATE INDEX swipes_user_restaurant_date ON public.swipes USING btree (user_id, restaurant_id, swiped_at DESC);

--
-- Functions
--

CREATE OR REPLACE FUNCTION public.handle_swipe_save()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.direction IN ('right', 'superlike') THEN
    INSERT INTO saves (user_id, restaurant_id, interaction_type, saved_at)
    VALUES (NEW.user_id, NEW.restaurant_id, NEW.direction, NEW.swiped_at)
    ON CONFLICT (user_id, restaurant_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_restaurant_recommendations(p_user_id uuid, p_lat double precision, p_lng double precision, p_radius_m integer DEFAULT 5000, p_limit integer DEFAULT 50)
 RETURNS SETOF restaurants
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_user_location  geometry;
  v_cuisines       TEXT[];
  v_price_range    INT[];
BEGIN
  v_user_location := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  SELECT up.cuisines, up.price_range
  INTO v_cuisines, v_price_range
  FROM user_preferences up
  WHERE up.user_id = p_user_id;

  RETURN QUERY
  SELECT r.*
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

--
-- Trigger
--

CREATE TRIGGER on_swipe_save
  AFTER INSERT ON public.swipes
  FOR EACH ROW
  EXECUTE FUNCTION handle_swipe_save();

--
-- Row Level Security
--

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Restaurants: public read access
CREATE POLICY restaurants_public_read ON public.restaurants
  FOR SELECT USING (true);

-- Swipes: owner can do all operations (uses cached auth.uid() pattern)
CREATE POLICY swipes_owner ON public.swipes
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Saves: owner can read and delete
CREATE POLICY saves_owner_read ON public.saves
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY saves_owner_delete ON public.saves
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- User preferences: owner can do all operations
CREATE POLICY preferences_owner ON public.user_preferences
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
