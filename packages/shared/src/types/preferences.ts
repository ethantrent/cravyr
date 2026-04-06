export interface UserPreferences {
  user_id: string;
  cuisines: string[];              // selected cuisine tags
  price_range: Array<1 | 2 | 3 | 4>;  // selected price levels
  max_distance_km: 1 | 5 | 15;    // one of three fixed options
  updated_at: string;              // ISO timestamp
}

export const CUISINE_OPTIONS = [
  'Italian', 'Japanese', 'Mexican', 'Chinese', 'Indian',
  'Thai', 'American', 'Mediterranean', 'Korean', 'Vietnamese',
  'French', 'Greek', 'Middle Eastern', 'Brazilian', 'Spanish',
] as const;

export type CuisineOption = typeof CUISINE_OPTIONS[number];
