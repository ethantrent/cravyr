import { supabase } from './supabase';

/**
 * Base URL for the Cravyr API. In production this is injected via
 * EXPO_PUBLIC_API_URL (see eas.json); the localhost fallback is dev-only.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Authorization header for authenticated API calls, derived from the current
 * Supabase session. Returns an empty object when signed out.
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Resolve a restaurant photo reference to a loadable URL. Google Places photo
 * names must be hotlinked through the API proxy; already-resolved http(s) URLs
 * pass through unchanged.
 */
export function photoProxyUrl(
  photoName: string | undefined,
  maxWidth = 600
): string | undefined {
  if (!photoName || photoName.startsWith('http')) return photoName;
  return `${API_URL}/api/v1/photos/resolve?name=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}`;
}
