import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { usersRouter } from './routes/users';
import { swipesRouter } from './routes/swipes';
import { restaurantsRouter } from './routes/restaurants';
import { recommendationsRouter } from './routes/recommendations';
import { savesRouter } from './routes/saves';

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

// Rate limiting — 100 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

// Body parsing
app.use(express.json());

// Health check — used by UptimeRobot to prevent Render cold starts
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/swipes', swipesRouter);
app.use('/api/v1/restaurants', restaurantsRouter);
app.use('/api/v1/recommendations', recommendationsRouter);
app.use('/api/v1/saves', savesRouter);

app.listen(PORT, () => {
  console.log(`Cravyr API listening on port ${PORT}`);
});

export default app;
