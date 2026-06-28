-- Migration: Friends List (Implicit Network)
-- Replaces rigid 1-on-1 partnerships with an N-to-N connections model.

-- 1. Drop old tables/triggers
DROP TRIGGER IF EXISTS on_swipe_save ON public.swipes;
DROP FUNCTION IF EXISTS public.handle_swipe_save();

DROP TABLE IF EXISTS public.matches;
DROP TABLE IF EXISTS public.partnerships;
DROP TABLE IF EXISTS public.partner_codes;

-- 2. Create connections table
CREATE TABLE public.connections (
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensure canonical ordering to prevent duplicates (A,B) and (B,A)
);

-- 3. Create connection_codes table
CREATE TABLE public.connection_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

-- 4. RLS for connections
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY connections_owner ON public.connections FOR ALL USING (user1_id = auth.uid() OR user2_id = auth.uid()) WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- 5. RLS for connection_codes
ALTER TABLE public.connection_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY connection_codes_owner ON public.connection_codes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY connection_codes_read_public ON public.connection_codes FOR SELECT USING (true);

-- 6. RPC: get_group_matches
-- Returns restaurant rows that the current user AND ALL specified friend_ids have saved (swiped right/superlike).
CREATE OR REPLACE FUNCTION public.get_group_matches(p_user_id uuid, p_friend_ids uuid[])
RETURNS SETOF public.restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_all_users uuid[];
BEGIN
  -- We want the intersection of saves for p_user_id + all p_friend_ids.
  v_all_users := array_append(p_friend_ids, p_user_id);

  RETURN QUERY
  SELECT r.*
  FROM public.restaurants r
  JOIN public.saves s ON r.id = s.restaurant_id
  WHERE s.user_id = ANY(v_all_users)
    AND s.interaction_type IN ('right', 'superlike')
  GROUP BY r.id
  HAVING count(DISTINCT s.user_id) = array_length(v_all_users, 1)
  ORDER BY max(s.saved_at) DESC;
END;
$$;
