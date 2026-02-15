import * as dotenv from 'dotenv';
// Load env vars BEFORE any other imports that use them
dotenv.config();

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { rateLimiter } from 'hono-rate-limiter';
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
import { authMiddleware, type AuthContext } from './middleware/auth.js';
import { initializeWorker, shutdownWorker } from './lib/worker.js';
import autoGradeWritten from './jobs/auto-grade-written.js';
import autoGradeUML from './jobs/auto-grade-uml.js';
import { RATE_LIMIT_CONFIG } from './config/constants.js';

const app = new Hono<AuthContext>();

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

// Health check
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

// Initialize Graphile Worker for background job processing
const taskList = {
  'auto-grade-written': autoGradeWritten as any,
  'auto-grade-uml': autoGradeUML as any,
};

initializeWorker(taskList)
  .then(() => {
    console.log('✓ Graphile Worker initialized');
  })
  .catch((err) => {
    console.error('FATAL: Failed to initialize Graphile Worker:', err);
    console.error('Auto-grading system will not function. Exiting...');
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdownWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdownWorker();
  process.exit(0);
});

console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
