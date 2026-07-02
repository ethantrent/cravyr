import 'dotenv/config';
import path from 'path';
import { createHash } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { usersRouter } from './routes/users';
import { swipesRouter } from './routes/swipes';
import { restaurantsRouter } from './routes/restaurants';
import { recommendationsRouter } from './routes/recommendations';
import { resolvePhotoUrl } from './services/places';
import { savesRouter } from './routes/saves';
import { notificationsRouter } from './routes/notifications';
import { connectionsRouter } from './routes/connections';
import { matchesRouter } from './routes/matches';
import { placesRouter } from './routes/places';
import { startCronJobs } from './services/cron';
import { PhotoResolveQuerySchema } from '@cravyr/shared';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Fail fast on a misconfigured deploy rather than serving broken responses.
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_PLACES_API_KEY',
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length === 0) return;
  const message = `Missing required environment variables: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  console.warn(`[env] ${message}`);
}

validateEnv();

// Security headers — disable CSP in development for Expo DevClient compatibility
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
}));

// CORS — allow requests from mobile app
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Rate limiting — generous limit for mobile app traffic.
// Authenticated requests are keyed per session token (hashed) so that users
// sharing a carrier/NAT IP don't throttle each other, and one user cannot
// exhaust another's bucket without their token. Unauthenticated requests fall
// back to an IPv6-safe IP key.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      return 'u:' + createHash('sha256').update(auth.slice(7)).digest('hex');
    }
    return ipKeyGenerator(req.ip ?? '');
  },
  skip: (req) =>
    req.path === '/health' || req.path === '/api/v1/photos/resolve',
});
app.use(apiLimiter);

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json());

// Static files (privacy policy, etc.)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Health check — used by UptimeRobot to prevent Render cold starts
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Deployed commit — polled by the deploy-verify GitHub Action after each push
// so a failed Render build can't go unnoticed (RENDER_GIT_COMMIT is injected by Render)
app.get('/version', (_req, res) => {
  res.json({ commit: process.env.RENDER_GIT_COMMIT ?? 'unknown' });
});

// Privacy policy — App Store requires a hosted URL
app.get('/privacy', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Auth redirect — Supabase email confirmation lands here, then deep-links into the app
app.get('/auth/callback', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth-redirect.html'));
});

// Photo proxy — resolve Google Places photo names to CDN URLs
app.get('/api/v1/photos/resolve', async (req: express.Request, res: express.Response) => {
  const result = PhotoResolveQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      error: 'Validation failed',
      issues: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }
  const { name, maxWidth } = result.data;
  const resolved = await resolvePhotoUrl(name, maxWidth);
  if (!resolved) {
    res.status(404).json({ error: 'Photo not found or expired' });
    return;
  }
  res.redirect(301, resolved);
});

// API routes
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/swipes', swipesRouter);
app.use('/api/v1/restaurants', restaurantsRouter);
app.use('/api/v1/recommendations', recommendationsRouter);
app.use('/api/v1/saves', savesRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/connections', connectionsRouter);
app.use('/api/v1/matches', matchesRouter);
app.use('/api/v1/places', placesRouter);

// 404 — no route matched
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler — catches errors thrown (or rejected) in handlers.
// Express 5 forwards async rejections here automatically.
const errorHandler: express.ErrorRequestHandler = (err, _req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Cravyr API listening on port ${PORT}`);
    startCronJobs();
  });
}

export default app;
