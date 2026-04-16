import type { Restaurant } from '@cravyr/shared';

const PRICE_DISPLAY: Record<number, string> = {
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

export interface DbRestaurantRow {
  id: string;
  external_id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  address?: string;
  city?: string;
  state?: string;
  photo_urls?: string[];
  cuisines?: string[];
  price_level?: number | null;
  rating?: number | null;
  review_count?: number;
  phone_number?: string | null;
  hours?: Restaurant['hours'];
  cached_at?: string;
  distance_km?: number | null;
  [key: string]: unknown;
}

/**
 * Transform a raw Supabase/PostGIS row into the client-facing Restaurant shape.
 *
 * Computes derived fields (primary_cuisine, price_level_display) and
 * falls back to haversine for distance_km when the DB didn't supply it.
 */
export function mapDbRowToRestaurant(
  row: DbRestaurantRow,
  userLat?: number,
  userLng?: number,
): Restaurant {
  const cuisines = row.cuisines ?? [];
  const priceLevel = (row.price_level ?? 1) as 1 | 2 | 3 | 4;
  const lat = row.lat ?? 0;
  const lng = row.lng ?? 0;

  let distanceKm = row.distance_km ?? 0;
  if (
    !distanceKm &&
    userLat !== undefined &&
    userLng !== undefined &&
    lat !== 0 &&
    lng !== 0
  ) {
    distanceKm = haversineKm(userLat, userLng, lat, lng);
  }

  return {
    id: row.id,
    external_id: row.external_id,
    name: row.name,
    location: { lat, lng },
    address: row.address ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    photo_urls: row.photo_urls ?? [],
    cuisines,
    primary_cuisine: cuisines[0] ?? 'Restaurant',
    price_level: priceLevel,
    price_level_display: PRICE_DISPLAY[priceLevel] ?? '$',
    rating: row.rating ?? 0,
    review_count: row.review_count ?? 0,
    phone_number: row.phone_number ?? undefined,
    hours: row.hours ?? null,
    distance_km: Math.round(distanceKm * 100) / 100,
    cached_at: row.cached_at ?? new Date().toISOString(),
  };
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
