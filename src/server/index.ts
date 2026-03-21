import * as dotenv from 'dotenv';
// Load env vars BEFORE any other imports that use them
dotenv.config();

// S11: Validate environment variables before anything else — fail-fast on misconfiguration
import './config/env.js';

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { rateLimiter } from 'hono-rate-limiter';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import authRoutes from './routes/auth/index.js';
import coursesRoutes from './routes/courses/index.js';
import assignmentsRoutes from './routes/assignments/index.js';
import submissionsRoutes from './routes/submissions/index.js';
import questionsRoutes from './routes/questions/index.js';
import tagsRoutes from './routes/tags/index.js';
import autoGradeRoutes from './routes/auto-grade/index.js';
import notificationsRoutes from './routes/notifications/index.js';
import settingsRoutes from './routes/settings/index.js';
import usersRoutes from './routes/users/index.js';
import adminRoutes from './routes/admin/index.js';
import { authMiddleware, type AuthContext } from './middleware/auth.js';
import { RATE_LIMIT_CONFIG } from './config/constants.js';
import { env } from './config/env.js';

const app = new Hono<AuthContext>();

// S3: Security headers — place first so every response gets them
const isProduction = env.NODE_ENV === 'production';
app.use(
  '*',
  secureHeaders({
    strictTransportSecurity: isProduction
      ? 'max-age=31536000; includeSubDomains'
      : undefined,
    contentSecurityPolicy: isProduction
      ? {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline styles
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", env.VITE_SUPABASE_URL],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
        }
      : undefined, // Relaxed in development (Vite HMR needs inline scripts)
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  })
);

// S4: CORS — restrict API access to the legitimate frontend origin
app.use(
  '/api/*',
  cors({
    origin: env.VITE_APP_URL,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: false, // Bearer token auth — no cookies needed
  })
);

// S2: Larger limit for CSV bulk upload route (10MB) — must be registered before global limit
app.use('/api/admin/users/bulk', bodyLimit({ maxSize: 10 * 1024 * 1024 }));

// S2: Global body size limit (1MB for JSON APIs)
app.use('/api/*', bodyLimit({ maxSize: 1 * 1024 * 1024 }));

// S10: Strict rate limiting for auth endpoints (5 req/min per IP)
const authLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  standardHeaders: 'draft-6',
  keyGenerator: (c) =>
    c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'default',
  handler: (c) =>
    c.json(
      { success: false, error: 'Too many attempts. Please try again in 60 seconds.' },
      429
    ),
});

app.use('/api/auth/signin', authLimiter);
app.use('/api/auth/password-login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// S10: Even stricter for forgot-password (3 req/min per IP)
const forgotPasswordLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-6',
  keyGenerator: (c) =>
    c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'default',
  handler: (c) =>
    c.json(
      { success: false, error: 'Too many attempts. Please try again in 60 seconds.' },
      429
    ),
});

app.use('/api/auth/forgot-password', forgotPasswordLimiter);

// Rate limiting middleware - apply to all API routes except monitoring endpoints
const limiter = rateLimiter({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  limit: RATE_LIMIT_CONFIG.MAX_REQUESTS,
  standardHeaders: 'draft-6', // Return rate limit info in the `RateLimit-*` headers
  keyGenerator: (c) => {
    // Use IP address as key, fallback to a default for local dev
    return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'default';
  },
  skip: (c) => {
    // Skip rate limiting for monitoring/polling endpoints in development
    const path = c.req.path;
    const isDev = process.env.NODE_ENV !== 'production';
    const isMonitoring = path.includes('/queue') || 
                         path.includes('/unread-count') || 
                         path.includes('/health');
    return isDev && isMonitoring;
  },
});

app.use('/api/*', limiter);

// Global auth middleware to attach user to all requests
app.use('*', authMiddleware);

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/courses', coursesRoutes);
app.route('/api/assignments', assignmentsRoutes);
app.route('/api/submissions', submissionsRoutes);
app.route('/api/questions', questionsRoutes);
app.route('/api/tags', tagsRoutes);
app.route('/api/auto-grade', autoGradeRoutes);
app.route('/api/notifications', notificationsRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/admin', adminRoutes);

// Health checks — separate liveness and readiness for Kubernetes
// Liveness: is the process alive? (used by livenessProbe — avoids killing pods on transient DB issues)
app.get('/api/health/live', (c) => {
  return c.json({ status: 'ok' });
});

// Readiness: can the pod serve traffic? (used by readinessProbe — removes pod from Service if DB is unreachable)
app.get('/api/health/ready', async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ status: 'ok', db: 'connected' });
  } catch {
    return c.json({ status: 'degraded', db: 'disconnected' }, 503);
  }
});

// Backwards-compatible alias
app.get('/api/health', (c) => {
  return c.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }));

  const serveIndex = serveStatic({ root: './dist/client', path: 'index.html' });

  // SPA fallback for deep links (e.g. /student, /staff)
  app.get('*', async (c, next) => {
    if (c.req.path.startsWith('/api')) {
      return next();
    }

    return serveIndex(c, next);
  });
}

const port = Number(process.env.PORT) || 3000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  process.exit(0);
});

console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
