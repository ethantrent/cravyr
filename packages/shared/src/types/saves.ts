import type { Restaurant, InteractionType } from './restaurant';

export interface SavedRestaurant {
  id: string;                      // saves.id UUID
  user_id: string;
  restaurant_id: string;
  interaction_type: InteractionType;  // 'right' | 'superlike'
  saved_at: string;                // ISO timestamp
  restaurant: Restaurant;          // joined via Supabase select
}
