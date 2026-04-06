import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';

// Admin client — service role key — ONLY in apps/api, NEVER in apps/mobile
const adminSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const usersRouter = Router();

// All users routes require a verified JWT
usersRouter.use(requireAuth);

/**
 * DELETE /api/v1/users/me
 *
 * Permanently deletes the authenticated user's account.
 * Requires a valid JWT in Authorization header.
 * ON DELETE CASCADE on foreign keys handles cascade-deleting swipes, saves, preferences.
 *
 * SECURITY (T-04-05-01): userId comes from the verified JWT (req.user.id),
 * never from the request body or URL params. This prevents elevation-of-privilege
 * attacks where an attacker could supply a different user's ID.
 *
 * App Store guideline 5.1.1 compliance: allows users to initiate account deletion.
 */
usersRouter.delete('/me', async (req: Request & { user?: { id: string } }, res: Response) => {
  const userId: string | undefined = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Supabase Storage: for Phase 4, users have no storage objects (photos are hotlinked,
  // not uploaded). If future phases add user-uploaded content, delete storage objects
  // before calling deleteUser() — otherwise the call may fail.

  const { error } = await adminSupabase.auth.admin.deleteUser(userId);

  if (error) {
    res.status(500).json({ error: 'Failed to delete account', details: error.message });
    return;
  }

  res.status(204).send();
});
