/**
 * Physical device UAT order (no secrets).
 * Usage: pnpm prod:device:uat
 */
const lines = [
  '',
  'Cravyr — device UAT (after EXPO_PUBLIC_API_URL points at Render)',
  '==============================================================',
  '',
  'From apps/mobile: pnpm start (or expo start --dev-client).',
  '',
  'On a physical device, in order:',
  '  1. Sign in (email and/or Google).',
  '  2. Discover — cards load; images render.',
  '  3. Swipe (left / right / superlike as implemented).',
  '  4. Saved — list matches expectations.',
  '  5. Restaurant detail — open from a card.',
  '  6. Settings → Privacy Policy — opens API /privacy (or EXPO_PUBLIC_PRIVACY_URL).',
  '',
];

console.log(lines.join('\n'));
