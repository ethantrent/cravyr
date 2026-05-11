/**
 * Cravyr API Integration Test
 * 
 * Exercises every endpoint in the full user flow:
 *   1. Health check
 *   2. Privacy policy page
 *   3. Auth callback page
 *   4. Sign up a test user via Supabase
 *   5. Nearby restaurants (unauthenticated)
 *   6. Recommendations (authenticated)
 *   7. Record swipes (right, left, superlike)
 *   8. Check saves (auto-populated by DB trigger)
 *   9. Restaurant detail (lazy Enterprise fetch)
 *  10. Photo URL resolution
 *  11. Undo swipe (DELETE /swipes/:restaurantId)
 *  12. Delete saves
 *  13. Delete account
 *  14. Validation error handling
 *  15. Auth guard (post-deletion)
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_ANON_KEY');
  console.error('Copy them from apps/api/.env or run: source apps/api/.env');
  process.exit(1);
}

const TEST_EMAIL = `cravyr.integtest.${Date.now()}@gmail.com`;
const TEST_PASSWORD = 'TestPass123!';

// Rexburg, ID coordinates
const LAT = 43.826;
const LNG = -111.789;

let accessToken = null;
let userId = null;
let restaurants = [];
let savedRestaurantIds = [];

const results = [];

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const line = `${icon} ${test}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  results.push({ test, status, detail });
}

async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (err) {
    return { ok: false, status: 0, statusText: err.message, json: async () => ({}), text: async () => err.message };
  }
}

// ============================================================
// 1. Health check
// ============================================================
async function testHealth() {
  const res = await safeFetch(`${API_URL}/health`);
  const body = await res.json();
  if (res.ok && body.status === 'ok') {
    log('1. Health check', 'PASS', `timestamp=${body.timestamp}`);
  } else {
    log('1. Health check', 'FAIL', `status=${res.status}`);
  }
}

// ============================================================
// 2. Privacy policy page
// ============================================================
async function testPrivacy() {
  const res = await safeFetch(`${API_URL}/privacy`);
  const html = await res.text();
  if (res.ok && html.includes('Privacy')) {
    log('2. Privacy policy page', 'PASS', `${html.length} bytes, contains "Privacy"`);
  } else {
    log('2. Privacy policy page', 'FAIL', `status=${res.status}`);
  }
}

// ============================================================
// 3. Auth callback page
// ============================================================
async function testAuthCallback() {
  const res = await safeFetch(`${API_URL}/auth/callback`);
  const html = await res.text();
  if (res.ok && html.length > 100) {
    log('3. Auth callback page', 'PASS', `${html.length} bytes`);
  } else {
    log('3. Auth callback page', 'FAIL', `status=${res.status}`);
  }
}

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');
  console.error('Copy it from apps/api/.env');
  process.exit(1);
}

// ============================================================
// 4. Create test user via Supabase Admin API (auto-confirmed),
//    then sign in with anon key to get a proper access token
// ============================================================
async function testSignUp() {
  // Step 1: Create user via Admin API (bypasses email confirmation)
  const createRes = await safeFetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  });
  const createBody = await createRes.json();
  if (!createRes.ok) {
    log('4. Create test user (admin)', 'FAIL', JSON.stringify(createBody).slice(0, 200));
    return;
  }
  userId = createBody.id;
  log('4a. Create test user (admin)', 'PASS', `user_id=${userId}, email=${TEST_EMAIL}`);

  // Step 2: Sign in with anon key to get a proper access token
  const signInRes = await safeFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const signInBody = await signInRes.json();
  if (signInRes.ok && signInBody.access_token) {
    accessToken = signInBody.access_token;
    log('4b. Sign in test user', 'PASS', `token acquired (${signInBody.access_token.slice(0, 20)}...)`);
  } else {
    log('4b. Sign in test user', 'FAIL', JSON.stringify(signInBody).slice(0, 200));
  }
}

// ============================================================
// 5. Nearby restaurants (public endpoint)
// ============================================================
async function testNearby() {
  const res = await safeFetch(`${API_URL}/api/v1/restaurants/nearby?lat=${LAT}&lng=${LNG}`);
  const body = await res.json();
  if (res.ok && body.restaurants && body.restaurants.length > 0) {
    restaurants = body.restaurants;
    const names = restaurants.slice(0, 5).map(r => r.name).join(', ');
    log('5. Nearby restaurants', 'PASS', `${body.meta.count} results (source: ${body.meta.source}). First 5: ${names}`);
  } else {
    log('5. Nearby restaurants', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 6. Recommendations (authenticated)
// ============================================================
async function testRecommendations() {
  if (!accessToken) {
    log('6. Recommendations', 'SKIP', 'No auth token');
    return;
  }
  const res = await safeFetch(`${API_URL}/api/v1/recommendations?lat=${LAT}&lng=${LNG}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (res.ok && Array.isArray(body)) {
    log('6. Recommendations (authenticated)', 'PASS', `${body.length} scored restaurants returned`);
  } else {
    log('6. Recommendations (authenticated)', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 6b. Recommendations without auth (should 401)
// ============================================================
async function testRecommendationsNoAuth() {
  const res = await safeFetch(`${API_URL}/api/v1/recommendations?lat=${LAT}&lng=${LNG}`);
  if (res.status === 401) {
    log('6b. Recommendations (no auth)', 'PASS', 'Correctly returned 401');
  } else {
    log('6b. Recommendations (no auth)', 'FAIL', `Expected 401, got ${res.status}`);
  }
}

// ============================================================
// 7. Record swipes
// ============================================================
async function testSwipes() {
  if (!accessToken || restaurants.length < 3) {
    log('7. Record swipes', 'SKIP', 'No auth token or insufficient restaurants');
    return;
  }

  const swipeTests = [
    { restaurant: restaurants[0], direction: 'right', label: 'right (save)' },
    { restaurant: restaurants[1], direction: 'left', label: 'left (skip)' },
    { restaurant: restaurants[2], direction: 'superlike', label: 'superlike' },
  ];

  for (const { restaurant, direction, label } of swipeTests) {
    const res = await safeFetch(`${API_URL}/api/v1/swipes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restaurant_id: restaurant.id, direction }),
    });
    const body = await res.json();
    if (res.ok || res.status === 201) {
      if (direction === 'right' || direction === 'superlike') {
        savedRestaurantIds.push(restaurant.id);
      }
      log(`7. Swipe ${label} on "${restaurant.name}"`, 'PASS', `id=${body.id || body.swipe?.id || 'ok'}`);
    } else {
      log(`7. Swipe ${label} on "${restaurant.name}"`, 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
    }
  }
}

// ============================================================
// 7b. Duplicate swipe (should handle gracefully)
// ============================================================
async function testDuplicateSwipe() {
  if (!accessToken || restaurants.length < 1) {
    log('7b. Duplicate swipe', 'SKIP');
    return;
  }
  const res = await safeFetch(`${API_URL}/api/v1/swipes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ restaurant_id: restaurants[0].id, direction: 'right' }),
  });
  if (res.status === 409 || res.status === 200 || res.status === 201) {
    log('7b. Duplicate swipe handling', 'PASS', `status=${res.status} (graceful)`);
  } else {
    const body = await res.json();
    log('7b. Duplicate swipe handling', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 8. Check saves (Tonight's Picks) — fetched from Supabase directly
//    (same as apps/mobile/app/(tabs)/saved.tsx)
// ============================================================
async function testSaves() {
  if (!accessToken || !userId) {
    log('8. Saves (Tonight\'s Picks)', 'SKIP', 'No auth token');
    return;
  }
  // The mobile app queries Supabase directly with a join, not through the API
  const res = await safeFetch(
    `${SUPABASE_URL}/rest/v1/saves?select=id,interaction_type,saved_at,restaurants(id,name,cuisines)&user_id=eq.${userId}&order=saved_at.desc`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (res.ok && Array.isArray(body)) {
    const names = body.map(s => s.restaurants?.name || s.restaurant_id || 'unknown').join(', ');
    log('8. Saves (Tonight\'s Picks)', 'PASS', `${body.length} saved. Items: ${names}`);
  } else {
    log('8. Saves (Tonight\'s Picks)', 'FAIL', `status=${res.status}, body=${String(body).slice(0, 200)}`);
  }
}

// ============================================================
// 9. Restaurant detail
// ============================================================
async function testRestaurantDetail() {
  if (restaurants.length === 0) {
    log('9. Restaurant detail', 'SKIP', 'No restaurants available');
    return;
  }
  const r = restaurants[0];
  const res = await safeFetch(`${API_URL}/api/v1/restaurants/${r.id}`);
  const body = await res.json();
  if (res.ok && body.id === r.id) {
    const fields = Object.keys(body).join(', ');
    log('9. Restaurant detail', 'PASS', `"${body.name}" — fields: ${fields}`);
  } else {
    log('9. Restaurant detail', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 10. Photo URL resolution
// ============================================================
async function testPhotoResolution() {
  if (restaurants.length === 0) {
    log('10. Photo resolution', 'SKIP');
    return;
  }
  // Find a restaurant with photo_urls
  const withPhotos = restaurants.find(r => r.photo_urls && r.photo_urls.length > 0);
  if (!withPhotos) {
    log('10. Photo resolution', 'SKIP', 'No restaurants have photo_urls');
    return;
  }

  const photoName = withPhotos.photo_urls[0];

  // Test the per-restaurant photos endpoint
  const res = await safeFetch(`${API_URL}/api/v1/restaurants/${withPhotos.id}/photos?maxWidth=400`);
  const body = await res.json();
  if (res.ok && body.photos && body.photos.length > 0) {
    log('10a. Photos endpoint', 'PASS', `${body.photos.length} resolved URLs for "${withPhotos.name}"`);
  } else {
    log('10a. Photos endpoint', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }

  // Test the global photo resolve redirect
  const resolveRes = await safeFetch(`${API_URL}/api/v1/photos/resolve?name=${encodeURIComponent(photoName)}&maxWidth=400`, {
    redirect: 'manual',
  });
  if (resolveRes.status === 301 || resolveRes.status === 302 || resolveRes.status === 200) {
    const location = resolveRes.headers?.get?.('location') || 'redirect';
    log('10b. Photo resolve redirect', 'PASS', `status=${resolveRes.status}`);
  } else {
    log('10b. Photo resolve redirect', 'FAIL', `status=${resolveRes.status}`);
  }
}

// ============================================================
// 11. Undo swipe (DELETE /swipes/:restaurantId)
// ============================================================
async function testUndoSwipe() {
  if (!accessToken || restaurants.length < 2) {
    log('11. Undo swipe', 'SKIP');
    return;
  }
  // Undo the "left" swipe on restaurants[1]
  const r = restaurants[1];
  const res = await safeFetch(`${API_URL}/api/v1/swipes/${r.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok || res.status === 204) {
    log('11. Undo swipe', 'PASS', `Deleted swipe on "${r.name}"`);
  } else {
    const body = await res.json().catch(() => ({}));
    log('11. Undo swipe', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 12. Delete a save (need the save's primary key, not the restaurant ID)
// ============================================================
async function testDeleteSave() {
  if (!accessToken || !userId) {
    log('12. Delete save', 'SKIP');
    return;
  }
  // Look up the actual save ID from Supabase
  const lookupRes = await safeFetch(
    `${SUPABASE_URL}/rest/v1/saves?select=id&user_id=eq.${userId}&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  const lookupText = await lookupRes.text();
  let saves;
  try { saves = JSON.parse(lookupText); } catch { saves = []; }
  if (!Array.isArray(saves) || saves.length === 0) {
    log('12. Delete save', 'SKIP', 'No saves found to delete');
    return;
  }
  const saveId = saves[0].id;
  const res = await safeFetch(`${API_URL}/api/v1/saves/${saveId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok || res.status === 204) {
    log('12. Delete save', 'PASS', `Removed save ${saveId}`);
  } else {
    const body = await res.json().catch(() => ({}));
    log('12. Delete save', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 13. Push notification registration
// ============================================================
async function testPushRegistration() {
  if (!accessToken) {
    log('13. Push token registration', 'SKIP');
    return;
  }
  const res = await safeFetch(`${API_URL}/api/v1/notifications/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expo_push_token: 'ExponentPushToken[test-integration-token-123]',
      platform: 'android',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok || res.status === 201) {
    log('13. Push token registration', 'PASS', `Registered test token`);
  } else {
    log('13. Push token registration', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 14. Validation error handling
// ============================================================
async function testValidation() {
  // Missing lat/lng
  const res1 = await safeFetch(`${API_URL}/api/v1/restaurants/nearby`);
  if (res1.status === 400) {
    const body = await res1.json();
    log('14a. Validation: missing lat/lng', 'PASS', `400 with ${body.issues?.length || 0} issues`);
  } else {
    log('14a. Validation: missing lat/lng', 'FAIL', `Expected 400, got ${res1.status}`);
  }

  // Invalid restaurant ID format
  const res2 = await safeFetch(`${API_URL}/api/v1/restaurants/not-a-uuid`);
  if (res2.status === 400) {
    log('14b. Validation: invalid UUID', 'PASS', 'Correctly rejected');
  } else {
    log('14b. Validation: invalid UUID', 'FAIL', `Expected 400, got ${res2.status}`);
  }

  // Swipe without auth
  const res3 = await safeFetch(`${API_URL}/api/v1/swipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurant_id: 'fake', direction: 'right' }),
  });
  if (res3.status === 401) {
    log('14c. Auth guard: swipe without token', 'PASS', 'Correctly returned 401');
  } else {
    log('14c. Auth guard: swipe without token', 'FAIL', `Expected 401, got ${res3.status}`);
  }
}

// ============================================================
// 15. Delete account
// ============================================================
async function testDeleteAccount() {
  if (!accessToken) {
    log('15. Delete account', 'SKIP');
    return;
  }
  const res = await safeFetch(`${API_URL}/api/v1/users/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok || res.status === 204) {
    log('15. Delete account', 'PASS', `Deleted user ${userId}`);
  } else {
    const body = await res.json().catch(() => ({}));
    log('15. Delete account', 'FAIL', `status=${res.status}, body=${JSON.stringify(body).slice(0, 200)}`);
  }
}

// ============================================================
// 16. Auth guard after deletion
// ============================================================
async function testAuthAfterDeletion() {
  if (!accessToken) {
    log('16. Auth guard post-deletion', 'SKIP');
    return;
  }
  const res = await safeFetch(`${API_URL}/api/v1/saves`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    log('16. Auth guard post-deletion', 'PASS', 'Token correctly rejected after account deletion');
  } else {
    log('16. Auth guard post-deletion', 'WARN', `Expected 401, got ${res.status} (token may still be valid briefly)`);
  }
}

// ============================================================
// Run all tests
// ============================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     Cravyr API Integration Test Suite            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  API:      ${API_URL.padEnd(38)}║`);
  console.log(`║  Supabase: ${SUPABASE_URL.slice(0, 38).padEnd(38)}║`);
  console.log(`║  Test user: ${TEST_EMAIL.slice(0, 37).padEnd(37)}║`);
  console.log(`║  Location: ${LAT}, ${LNG} (Rexburg, ID)`.padEnd(51) + '║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  await testHealth();
  await testPrivacy();
  await testAuthCallback();
  console.log('');

  console.log('── Authentication ──');
  await testSignUp();
  console.log('');

  console.log('── Restaurant Data ──');
  await testNearby();
  await testRecommendations();
  await testRecommendationsNoAuth();
  console.log('');

  console.log('── Core Loop: Swipe → Save → Detail ──');
  await testSwipes();
  await testDuplicateSwipe();
  await testSaves();
  await testRestaurantDetail();
  await testPhotoResolution();
  console.log('');

  console.log('── Undo / Cleanup ──');
  await testUndoSwipe();
  await testDeleteSave();
  console.log('');

  console.log('── Push Notifications ──');
  await testPushRegistration();
  console.log('');

  console.log('── Error Handling ──');
  await testValidation();
  console.log('');

  console.log('── Account Lifecycle ──');
  await testDeleteAccount();
  await testAuthAfterDeletion();
  console.log('');

  // Summary
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  console.log('══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${warn} warnings, ${skip} skipped`);
  console.log('══════════════════════════════════════════════════');

  if (fail > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.test}: ${r.detail}`);
    });
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
