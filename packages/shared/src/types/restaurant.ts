export type InteractionType = 'right' | 'superlike';

export interface Restaurant {
  id: string;                      // Supabase UUID (restaurants.id)
  external_id: string;             // Google Place ID (restaurants.external_id)
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  address: string;
  city: string;
  state: string;
  photo_urls: string[];            // hotlinked Google photo URLs (generated fresh at render time)
  photo_blurhash?: string;         // optional thumbhash for placeholder
  cuisines: string[];
  primary_cuisine: string;         // first entry of cuisines[] or 'Restaurant'
  price_level: 1 | 2 | 3 | 4;
  price_level_display: string;     // '•' | '••' | '$$$' | '$$$$'
  rating: number;                  // 0-5
  review_count: number;
  phone_number?: string;           // optional — Call button hidden when absent
  hours: {
    open_now: boolean;
    periods?: Array<{
      day: number;
      open: string;
      close: string;
    }>;
    weekday_text?: string[];       // e.g. ['Monday: 9:00 AM – 10:00 PM', ...]
  } | null;
  distance_km: number;             // computed by backend recommendation endpoint
  cached_at: string;               // ISO timestamp
}

export interface RestaurantCard extends Restaurant {
  // Alias used in swipe deck context — same shape, clearer intent
}
