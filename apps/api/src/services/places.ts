/**
 * Google Places API (New) v1 HTTP client.
 *
 * Uses native fetch() -- no Google client library needed.
 * All calls use the API key from GOOGLE_PLACES_API_KEY env var.
 *
 * Functions:
 *   searchNearby      - Nearby Search with Pro-tier field mask
 *   getPlaceDetails   - Place Details with Enterprise-tier field mask
 *   resolvePhotoUrl   - Resolve photo resource name to fresh photoUri
 *   mapPlaceToRestaurant    - Map GooglePlace to Supabase restaurants row
 *   mapPlaceDetailToUpdate  - Map Enterprise fields to partial update object
 */

import NodeCache from 'node-cache';
import {
  PLACES_BASE,
  FIELD_MASK_NEARBY,
  FIELD_MASK_DETAIL,
  PRICE_LEVEL_MAP,
  mapPrimaryTypeToCuisines,
} from './places-constants';

// Google CDN photo URLs are valid ~24h; cache for 20h to stay safe
const photoUrlCache = new NodeCache({ stdTTL: 72000, checkperiod: 3600 });

// ---------------------------------------------------------------------------
// Google Places API v1 response types
// ---------------------------------------------------------------------------

export interface GooglePhotoRef {
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface GooglePlace {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  primaryType?: string;
  priceLevel?: string;
  photos?: GooglePhotoRef[];
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close: { day: number; hour: number; minute: number };
    }>;
    weekdayDescriptions?: string[];
  };
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

export interface PlacesNearbyResponse {
  places?: GooglePlace[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Nearby Search -- returns up to 20 restaurants within `radiusM` meters
 * of the given coordinates. Uses Pro-tier field mask (FIELD_MASK_NEARBY).
 */
export async function searchNearby(
  lat: number,
  lng: number,
  radiusM: number = 5000,
): Promise<GooglePlace[]> {
  const response = await fetch(`${PLACES_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': FIELD_MASK_NEARBY,
    },
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusM,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Places Nearby Search error: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as PlacesNearbyResponse;
  return data.places ?? [];
}

/**
 * Place Details -- fetches Enterprise-tier fields for a single place.
 * Used on detail view tap only (D-10: lazy detail fetch).
 */
export async function getPlaceDetails(
  placeId: string,
): Promise<GooglePlace> {
  const response = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': FIELD_MASK_DETAIL,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Place Details error: ${response.status} ${await response.text()}`,
    );
  }

  return response.json() as Promise<GooglePlace>;
}

/**
 * Resolve a photo resource name into a short-lived Google-hosted photoUri.
 *
 * Returns `null` if the photo name has expired (404) or any other error.
 * The `skipHttpRedirect=true` param ensures JSON response with photoUri
 * instead of a 302 redirect.
 */
export async function resolvePhotoUrl(
  photoName: string,
  maxWidthPx: number = 800,
): Promise<string | null> {
  const cacheKey = `${photoName}:${maxWidthPx}`;
  const cached = photoUrlCache.get<string>(cacheKey);
  if (cached) return cached;

  const url = `${PLACES_BASE}/${photoName}/media?key=${process.env.GOOGLE_PLACES_API_KEY}&maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[resolvePhotoUrl] ${response.status} for name(${photoName.length}ch): ${body.substring(0, 200)}`);
    return null;
  }

  const data = (await response.json()) as { photoUri?: string };
  const photoUri = data.photoUri ?? null;
  if (photoUri) {
    photoUrlCache.set(cacheKey, photoUri);
  }
  return photoUri;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Map a GooglePlace (from Nearby Search) to an object matching the
 * Supabase restaurants table columns.
 *
 * NOTE: The `.location` WKT string is for reference/debugging only.
 * The geo-cache service (Plan 02) passes `place.location.longitude` and
 * `place.location.latitude` as separate p_lng/p_lat parameters to the
 * `upsert_restaurant` RPC, which uses ST_MakePoint(p_lng, p_lat)
 * server-side.
 *
 * Does NOT include rating, hours, phone_number -- those are Enterprise
 * fields fetched only on detail view (D-10).
 */
export function mapPlaceToRestaurant(
  place: GooglePlace,
  geohash: string,
): {
  external_id: string;
  source: string;
  name: string;
  location: string;
  address: string;
  photo_urls: string[];
  cuisines: string[];
  price_level: number | null;
  geohash: string;
  cached_at: string;
} {
  return {
    external_id: place.id,
    source: 'google_places',
    name: place.displayName?.text ?? 'Unknown',
    location: `POINT(${place.location.longitude} ${place.location.latitude})`,
    address: place.formattedAddress ?? '',
    photo_urls: (place.photos ?? []).slice(0, 5).map((p) => p.name),
    cuisines: mapPrimaryTypeToCuisines(place.primaryType),
    price_level: PRICE_LEVEL_MAP[place.priceLevel ?? ''] ?? null,
    geohash,
    cached_at: new Date().toISOString(),
  };
}

/**
 * Map Enterprise-tier fields from a Place Details response to a partial
 * update object for an existing restaurant row.
 *
 * Transforms regularOpeningHours into the jsonb format matching the
 * shared Restaurant type's hours field.
 */
export function mapPlaceDetailToUpdate(place: GooglePlace): {
  rating: number | null;
  review_count: number;
  price_level: number | null;
  phone_number: string | null;
  hours: {
    open_now: boolean;
    periods: Array<{ day: number; open: string; close: string }>;
    weekday_text: string[];
  } | null;
  cached_at: string;
} {
  return {
    rating: place.rating ?? null,
    review_count: place.userRatingCount ?? 0,
    price_level: PRICE_LEVEL_MAP[place.priceLevel ?? ''] ?? null,
    phone_number: place.nationalPhoneNumber ?? null,
    hours: place.regularOpeningHours
      ? {
          open_now: place.regularOpeningHours.openNow ?? false,
          periods: (place.regularOpeningHours.periods ?? []).map((p) => ({
            day: p.open.day,
            open: `${String(p.open.hour).padStart(2, '0')}:${String(p.open.minute).padStart(2, '0')}`,
            close: `${String(p.close.hour).padStart(2, '0')}:${String(p.close.minute).padStart(2, '0')}`,
          })),
          weekday_text: place.regularOpeningHours.weekdayDescriptions ?? [],
        }
      : null,
    cached_at: new Date().toISOString(),
  };
}
