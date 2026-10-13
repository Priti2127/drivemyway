import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler, notFoundHandler, requestLogger } from '@drivemyway/shared';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { db } from './db/client.js';
import { redis } from './cache/client.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const app = express();

// ─── Security & parsing middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(requestLogger);

// ─── Health check (no auth required) ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/users', userRouter);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Verify DB connection
    await db.query('SELECT 1');
    console.log('✅  PostgreSQL connected');

    // Verify Redis connection
    await redis.ping();
    console.log('✅  Redis connected');

    app.listen(PORT, () => {
      console.log(`🚀  Auth service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌  Startup failed:', err);
    process.exit(1);
  }
}

start();

export default app;
