import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabasePublic = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

/**
 * JWT verification middleware.
 *
 * Validates the Bearer token in the Authorization header using Supabase's
 * auth.getUser() — this verifies the token signature and expiry server-side.
 * Populates req.user with the authenticated Supabase user object.
 *
 * userId is sourced from the verified JWT, never from the request body or URL
 * params (T-04-05-01: elevation of privilege mitigation).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabasePublic.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  (req as Request & { user: typeof user }).user = user;
  next();
}
