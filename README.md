# Cravyr

A mobile restaurant-discovery app built around swiping through nearby options and saving places to consider. This repository contains the Expo/React Native client, Express API, and shared TypeScript types and validation.

## Start with the code

| Area | Entry point | What to inspect |
|---|---|---|
| Mobile experience | [Discover screen](<apps/mobile/app/(tabs)/discover.tsx>) | The restaurant-discovery interface. |
| API | [Server](apps/api/src/server.ts) and [routes](apps/api/src/routes) | Restaurant, preference, saved-place, connection, and match endpoints. |
| External integration | [Places service](apps/api/src/services/places.ts) | How restaurant data is requested from Google Places. |
| Shared contract | [Shared package](packages/shared/src/index.ts) | Types and validation used across application layers. |
| Checks | [API tests](apps/api/src/__tests__) | Authentication, validation, health, and social-endpoint checks. |
| Data model | [Migrations](supabase/migrations) | The database schema and its changes over time. |

The app talks to the API for restaurant and social features. Supabase provides authentication and database services; the API integrates with Google Places. The workspace uses pnpm and Turborepo.

## Local development

Use the Node 20 environment specified by [CI](.github/workflows/ci.yml) and pnpm **9.15.9**, as declared in [package.json](package.json). Native mobile development also needs the appropriate simulator/device tooling.

```bash
git clone https://github.com/ethantrent/cravyr.git
cd cravyr
pnpm install --frozen-lockfile
pnpm --filter @cravyr/shared build
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Before starting the app, configure a separate development environment:

- **API:** Fill in the Supabase URL, client key, server-only service key, and Google Places API key using the names in [the API example](apps/api/.env.example). Restaurant lookup requires Places API (New). The database must have the schema represented in the migrations; copying environment files does not provision it.
- **Mobile:** Set the Supabase URL/client key and `EXPO_PUBLIC_API_URL` in [the mobile example](apps/mobile/.env.example). Its Android-emulator default is `http://10.0.2.2:4000`; use `http://localhost:4000` for an iOS simulator when the API runs on the same host. A physical device needs an address it can reach.
- **Sign-in:** Google and Apple flows require their own provider and native-app configuration. The examples and existing release records describe those prerequisites.

The examples retain the existing `ANON_KEY` and `SERVICE_ROLE_KEY` variable names. Keep service-role/secret keys on the API only, never in `EXPO_PUBLIC_*` variables or source control. See [Supabase's key guidance](https://supabase.com/docs/guides/api/api-keys).

Run these in separate terminals from the repository root:

```bash
pnpm --filter cravyr-api dev
```

```bash
pnpm --filter cravyr-mobile dev
```

The API defaults to port 4000. Follow the Expo terminal instructions for a compatible development client; native sign-in dependencies need native configuration.

## Checks and current limits

The repository's CI sequence builds the shared package, typechecks the shared/API/mobile packages, builds the API, then runs tests. Individual entry points include:

```bash
pnpm --filter @cravyr/shared build
pnpm typecheck
pnpm --filter cravyr-api build
pnpm test
```

The API test setup uses test environment values. These commands are documented entry points, not a claim of a fresh passing run or a successful device setup in this documentation pass. Production smoke, migration, and release commands are separate from these local-development steps.

Source code is available to inspect. App Store availability, adoption, and measured performance are not established here. The [project record](.planning/PROJECT.md) separates implementation from user validation; the [state record](.planning/STATE.md) retains outstanding device and store checks. Some historical progress labels differ, so use those specific open checks rather than a completion percentage to assess release readiness.
