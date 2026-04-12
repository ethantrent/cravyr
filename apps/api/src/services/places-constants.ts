/**
 * Google Places API (New) v1 constants.
 *
 * Field masks enforce billing-tier separation (D-08, D-09):
 *   - FIELD_MASK_NEARBY  = Pro-tier fields for swipe cards
 *   - FIELD_MASK_DETAIL  = Enterprise-tier fields for detail view
 *
 * PRICE_LEVEL_MAP converts Google string enums to DB integers.
 * mapPrimaryTypeToCuisines maps Google primaryType to cuisine tags.
 */

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

export const PLACES_BASE = 'https://places.googleapis.com/v1';

// ---------------------------------------------------------------------------
// Field masks (D-08, D-09)
// ---------------------------------------------------------------------------

/**
 * Nearby Search field mask -- Pro/Enterprise tier.
 * priceLevel is Enterprise but the cost delta is negligible with geohash
 * caching (~50 requests/month). Kept per D-08.
 */
export const FIELD_MASK_NEARBY =
  'places.id,places.displayName,places.photos,places.location,places.formattedAddress,places.primaryType';

/**
 * Place Details field mask -- Enterprise tier.
 * Used only on detail view tap (D-10) to defer expensive fields.
 */
export const FIELD_MASK_DETAIL =
  'id,displayName,photos,location,formattedAddress,primaryType,priceLevel,rating,userRatingCount,regularOpeningHours,nationalPhoneNumber,websiteUri';

// ---------------------------------------------------------------------------
// Price level mapping (Google string enum -> DB integer 1-4)
// ---------------------------------------------------------------------------

export const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// ---------------------------------------------------------------------------
// Primary type -> cuisine mapping
// ---------------------------------------------------------------------------

const PRIMARY_TYPE_CUISINES: Record<string, string[]> = {
  italian_restaurant: ['Italian'],
  chinese_restaurant: ['Chinese'],
  japanese_restaurant: ['Japanese'],
  mexican_restaurant: ['Mexican'],
  indian_restaurant: ['Indian'],
  thai_restaurant: ['Thai'],
  korean_restaurant: ['Korean'],
  vietnamese_restaurant: ['Vietnamese'],
  french_restaurant: ['French'],
  greek_restaurant: ['Greek'],
  mediterranean_restaurant: ['Mediterranean'],
  american_restaurant: ['American'],
  pizza_restaurant: ['Pizza', 'Italian'],
  seafood_restaurant: ['Seafood'],
  steak_house: ['Steakhouse'],
  sushi_restaurant: ['Japanese', 'Sushi'],
  hamburger_restaurant: ['Burgers', 'American'],
  fast_food_restaurant: ['Fast Food'],
  cafe: ['Cafe'],
  bakery: ['Bakery'],
  bar_and_grill: ['Bar & Grill'],
  vegan_restaurant: ['Vegan'],
  vegetarian_restaurant: ['Vegetarian'],
};

/**
 * Map a Google Places primaryType value to an array of cuisine strings
 * suitable for the restaurants.cuisines column.
 *
 * Returns `['Restaurant']` for undefined or unmapped types.
 */
export function mapPrimaryTypeToCuisines(
  primaryType: string | undefined,
): string[] {
  if (!primaryType) return ['Restaurant'];
  return PRIMARY_TYPE_CUISINES[primaryType] ?? ['Restaurant'];
}
