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

const normalizeOrigin = (origin: string): string => {
  try {
    const parsed = new URL(origin);
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${parsed.hostname}${port}`.toLowerCase();
  } catch {
    return origin.replace(/\/+$/, '').toLowerCase();
  }
};

const wildcardToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${withWildcards}$`, 'i');
};

const allowedOriginSet = new Set(env.corsOrigins.map((origin) => normalizeOrigin(origin)));
const allowedOriginPatterns = env.corsOriginPatterns.map((pattern) =>
  wildcardToRegex(normalizeOrigin(pattern)),
);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOriginSet.has(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    const matchesPattern = allowedOriginPatterns.some((regex) => regex.test(normalizedOrigin));
    if (matchesPattern) {
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
