import * as dotenv from 'dotenv';
// Load env vars BEFORE any other imports that use them
dotenv.config();

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import authRoutes from './routes/auth.js';
import coursesRoutes from './routes/courses.js';
import assignmentsRoutes from './routes/assignments.js';
import submissionsRoutes from './routes/submissions.js';
import questionsRoutes from './routes/questions.js';
import { authMiddleware, type AuthContext } from './middleware/auth.js';

const app = new Hono<AuthContext>();

// Global auth middleware to attach user to all requests
app.use('*', authMiddleware);

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/courses', coursesRoutes);
app.route('/api/assignments', assignmentsRoutes);
app.route('/api/submissions', submissionsRoutes);
app.route('/api/questions', questionsRoutes);

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

console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
