/**
 * EAS production build + submit reminders (no network).
 * Usage: pnpm prod:eas
 */
const lines = [
  '',
  'Cravyr — EAS when ready',
  '=======================',
  '',
  'Prereq: Expo Production env has EXPO_PUBLIC_SUPABASE_* (and Google EXPO_PUBLIC_* if needed).',
  '         See: pnpm prod:dashboards',
  '',
  'From apps/mobile (logged into Expo / EAS):',
  '  pnpm eas:build:prod:android',
  '  pnpm eas:build:prod:ios',
  '  pnpm eas:build:prod:all',
  '',
  'Submit (after successful builds):',
  '  eas submit --profile production --platform ios',
  '  eas submit --profile production --platform android',
  '',
  'Store prep: replace ascAppId in apps/mobile/eas.json; apps/mobile/google-sa.json (gitignored);',
  '            privacy URL https://cravyr-api.onrender.com/privacy; screenshots per store.',
  'Details: apps/mobile/.env.example (App Store / Play section).',
  '',
];

console.log(lines.join('\n'));
