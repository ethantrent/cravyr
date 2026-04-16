import 'dotenv/config';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { usersRouter } from './routes/users';
import { swipesRouter } from './routes/swipes';
import { restaurantsRouter } from './routes/restaurants';
import { recommendationsRouter } from './routes/recommendations';
import { resolvePhotoUrl } from './services/places';
import { savesRouter } from './routes/saves';
import { notificationsRouter } from './routes/notifications';
import { startCronJobs } from './services/cron';
import { PhotoResolveQuerySchema } from '@cravyr/shared';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security headers — disable CSP in development for Expo DevClient compatibility
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
}));

// CORS — allow requests from mobile app
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Rate limiting — generous limit for mobile app traffic
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Cravyr API listening on port ${PORT}`);
    startCronJobs();
  });
}

export default app;
