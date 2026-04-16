import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { RegisterPushTokenSchema } from '@cravyr/shared';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

/**
 * POST /api/v1/notifications/register
 * Body: { expo_push_token: string, platform: 'ios' | 'android' }
 *
 * Upserts the Expo push token for the authenticated user.
 * UNIQUE(user_id, platform) in the DB ensures no stale token accumulation —
 * a reinstalled app overwrites the old token rather than creating a duplicate.
 */
notificationsRouter.post(
  '/register',
  validate(RegisterPushTokenSchema, 'body'),
  async (req: Request & { user?: { id: string } }, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { expo_push_token, platform } = req.body;

    const { data, error } = await supabaseAdmin
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' },
      )
      .select('id')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  },
);
