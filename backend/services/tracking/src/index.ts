import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler, notFoundHandler, requestLogger } from '@drivemyway/shared';
import { trackingRouter } from './routes/tracking.js';
import { registerSocketHandlers } from './sockets/tracking.js';
import { db } from './db/client.js';
import { redis } from './cache/client.js';

const PORT = parseInt(process.env.PORT ?? '3003', 10);

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO server ─────────────────────────────────────────────────────────
export const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  },
  // Use Redis adapter for horizontal scaling across multiple instances
  // (configured in sockets/tracking.ts)
});

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*' }));
app.use(express.json({ limit: '10kb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tracking', timestamp: new Date().toISOString() });
});

app.use('/track', trackingRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('✅  PostgreSQL connected');

    await redis.ping();
    console.log('✅  Redis connected');

    // Register all Socket.IO event handlers
    registerSocketHandlers(io);

    httpServer.listen(PORT, () => {
      console.log(`🚀  Tracking service running on port ${PORT} (HTTP + WS)`);
    });
  } catch (err) {
    console.error('❌  Startup failed:', err);
    process.exit(1);
  }
}

start();
