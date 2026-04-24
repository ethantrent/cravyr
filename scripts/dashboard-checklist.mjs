/**
 * Console checklist for Supabase / Google / Expo (no secrets).
 * Usage: pnpm prod:dashboards
 */
const renderCallback = 'https://cravyr-api.onrender.com/auth/callback';

const lines = [
  '',
  'Cravyr — dashboard checklist (auth + EAS)',
  '==========================================',
  '',
  'Supabase → Authentication → URL configuration → Redirect URLs',
  `  Add: ${renderCallback}`,
  '  Plus any dev URLs you still use (e.g. exp://...).',
  '',
  'Google Cloud → APIs & Services → Credentials → OAuth 2.0 Client (Web)',
  '  Authorized redirect URIs: must include the exact callback URL shown in',
  '  Supabase → Authentication → Providers → Google (not the Render URL alone).',
  '',
  'Expo → Project → Environment variables → Production',
  '  EXPO_PUBLIC_SUPABASE_URL',
  '  EXPO_PUBLIC_SUPABASE_ANON_KEY',
  '  Optional: EXPO_PUBLIC_GOOGLE_* for Google Sign-In on store builds.',
  '  (eas.json production only sets EXPO_PUBLIC_API_URL.)',
  '',
  'GitHub (optional): repo secret EXPO_TOKEN for .github/workflows/eas-build.yml',
  '',
  'Reference: apps/mobile/.env.example and apps/api/.env.example',
  '',
];

console.log(lines.join('\n'));
