import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import './config/firebase';
import './types/express';
import { authenticateRequest } from './middlewares/authenticate';
import { errorHandler, notFound } from './middlewares/errorHandler';
import authRoutes from './routes/auth';
import metricsRoutes from './routes/metrics';
import organizationsRoutes from './routes/organizations';
import ordersRoutes from './routes/orders';
import usersRoutes from './routes/users';
import { sendSuccess } from './utils/apiResponse';

const app = express();

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Last-Event-ID', 'Accept'],
  credentials: env.corsCredentials,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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
