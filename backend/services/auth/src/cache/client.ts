import { createClient } from 'redis';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

export const redis = createClient({ url: process.env.REDIS_URL });

redis.on('error', (err) => console.error('[redis] Client error:', err.message));
redis.on('reconnecting', () => console.warn('[redis] Reconnecting...'));

// Connect immediately when this module is imported
await redis.connect();
