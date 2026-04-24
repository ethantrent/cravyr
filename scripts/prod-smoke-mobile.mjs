/**
 * Prints the physical-device production smoke checklist (no secrets, no network).
 * Usage: pnpm prod:smoke:mobile
 * API static checks: pnpm smoke:prod  (or pnpm prod:verify for smoke + mobile tsc)
 * Next: pnpm prod:dashboards → pnpm prod:device:uat → pnpm prod:eas
 */
const lines = [
  '',
  'Cravyr — production device smoke (after Render deploy)',
  '======================================================',
  '',
  '1. apps/mobile/.env — set EXPO_PUBLIC_API_URL=https://cravyr-api.onrender.com',
  '   (keep the same EXPO_PUBLIC_SUPABASE_* and EXPO_PUBLIC_GOOGLE_* as local dev).',
  '   Optional merge: copy lines from apps/mobile/env.smoke.template into .env',
  '',
  '2. From repo root: pnpm smoke:prod  (health /privacy /auth/callback on Render)',
  '',
  '3. From apps/mobile: pnpm start (or expo start --dev-client)',
  '',
  '4. On a physical device: sign-in → Discover (images) → swipe → Saved → restaurant detail.',
  '',
];

console.log(lines.join('\n'));
