import express from 'express';
import { usersRouter } from './routes/users';
import { swipesRouter } from './routes/swipes';
import { restaurantsRouter } from './routes/restaurants';
import { recommendationsRouter } from './routes/recommendations';
import { savesRouter } from './routes/saves';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
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
