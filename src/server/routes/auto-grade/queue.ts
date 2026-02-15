import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { aiGradingJobs, aiUsageStats } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';

const queueRoute = new Hono<AuthContext>();

/**
 * GET /api/auto-grade/queue
 * 
 * Get current job queue status and statistics
 */
queueRoute.get('/queue', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    // Count jobs by status
    const jobs = await db.select().from(aiGradingJobs);

    const pending = jobs.filter((j) => j.status === 'pending').length;
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;

    // Since we don't have processingTimeMs in schema, estimate based on stats table
    const stats = await db.select().from(aiUsageStats).limit(1);
    const avgProcessingTime = stats.length > 0 && stats[0].avgProcessingTime ? stats[0].avgProcessingTime : 5000;

    // Estimated completion time (pending jobs × avg time)
    const estimatedCompletionMs = pending * avgProcessingTime;

    return c.json({
      pending,
      processing,
      completed,
      failed,
      total: jobs.length,
      avgProcessingTimeMs: avgProcessingTime,
      estimatedCompletionMs,
      queueDepth: pending + processing,
    });
  } catch (error: any) {
    console.error('Queue status error:', error);
    return c.json({ error: 'Failed to fetch queue status' }, 500);
  }
});

export default queueRoute;
