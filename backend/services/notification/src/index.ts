import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler, notFoundHandler, requestLogger } from '@drivemyway/shared';
import { notifyRouter } from './routes/notify.js';

const PORT = parseInt(process.env.PORT ?? '3005', 10);
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification', timestamp: new Date().toISOString() });
});

app.use('/notify', notifyRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => console.log(`🔔  Notification service on port ${PORT}`));
export default app;
