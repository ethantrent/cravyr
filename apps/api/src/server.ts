import express from 'express';
import { usersRouter } from './routes/users';

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

app.listen(PORT, () => {
  console.log(`Cravyr API listening on port ${PORT}`);
});

export default app;
