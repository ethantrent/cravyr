/**
 * Supabase client stub — will be replaced with real implementation when
 * @supabase/supabase-js is installed and EXPO_PUBLIC_SUPABASE_URL +
 * EXPO_PUBLIC_SUPABASE_ANON_KEY are set (Phase 4, Plan 01 wires this up).
 *
 * This stub provides a type-compatible shape so downstream screens compile
 * cleanly in parallel worktrees that don't yet have the supabase package.
 */

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id: string; email?: string };
}

interface SupabaseAuthGetSessionResult {
  data: { session: SupabaseSession | null };
  error: Error | null;
}

interface SupabaseAuth {
  getSession(): Promise<SupabaseAuthGetSessionResult>;
}

interface SupabaseClient {
  auth: SupabaseAuth;
}

// Stub implementation — returns no active session until the real client is wired.
export const supabase: SupabaseClient = {
  auth: {
    getSession: async (): Promise<SupabaseAuthGetSessionResult> => ({
      data: { session: null },
      error: null,
    }),
  },
};
