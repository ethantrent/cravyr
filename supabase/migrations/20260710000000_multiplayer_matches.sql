-- Migration: Multiplayer "Match" Feature
-- Adds partnerships, partner_codes, and matches tables + triggers.

CREATE TABLE public.partner_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

CREATE TABLE public.partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user1_id, user2_id)
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  matched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user1_id, user2_id, restaurant_id)
);

-- RLS for partner_codes
ALTER TABLE public.partner_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_codes_owner ON public.partner_codes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY partner_codes_read_public ON public.partner_codes FOR SELECT USING (true);

-- RLS for partnerships
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
CREATE POLICY partnerships_owner ON public.partnerships FOR ALL USING (user1_id = auth.uid() OR user2_id = auth.uid()) WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- RLS for matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_owner ON public.matches FOR ALL USING (user1_id = auth.uid() OR user2_id = auth.uid()) WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- Replace handle_swipe_save to check for matches
CREATE OR REPLACE FUNCTION public.handle_swipe_save()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_id uuid;
  v_partner_saved boolean;
BEGIN
  IF NEW.direction IN ('right', 'superlike') THEN
    -- 1. Insert into saves
    INSERT INTO saves (user_id, restaurant_id, interaction_type, saved_at)
    VALUES (NEW.user_id, NEW.restaurant_id, NEW.direction, NEW.swiped_at)
    ON CONFLICT (user_id, restaurant_id) DO NOTHING;
    
    -- 2. Check for match
    -- Find partner
    SELECT CASE WHEN user1_id = NEW.user_id THEN user2_id ELSE user1_id END INTO v_partner_id
    FROM partnerships
    WHERE user1_id = NEW.user_id OR user2_id = NEW.user_id
    LIMIT 1;

    IF v_partner_id IS NOT NULL THEN
      -- Check if partner saved this restaurant
      SELECT EXISTS(
        SELECT 1 FROM saves WHERE user_id = v_partner_id AND restaurant_id = NEW.restaurant_id
      ) INTO v_partner_saved;
      
      IF v_partner_saved THEN
        -- Insert into matches (smaller user_id first for consistency)
        INSERT INTO matches (user1_id, user2_id, restaurant_id, matched_at)
        VALUES (
          LEAST(NEW.user_id, v_partner_id),
          GREATEST(NEW.user_id, v_partner_id),
          NEW.restaurant_id,
          NEW.swiped_at
        )
        ON CONFLICT (user1_id, user2_id, restaurant_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
