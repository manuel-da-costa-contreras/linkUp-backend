import cors from 'cors';
import express from 'express';
import './config/firebase';
import { authenticateRequest } from './middlewares/authenticate';
import { errorHandler, notFound } from './middlewares/errorHandler';
import authRoutes from './routes/auth';
import metricsRoutes from './routes/metrics';
import organizationsRoutes from './routes/organizations';
import ordersRoutes from './routes/orders';
import usersRoutes from './routes/users';
import { sendSuccess } from './utils/apiResponse';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/organizations', authenticateRequest, organizationsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
