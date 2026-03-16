import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { aiUsageStats } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { getErrorMessage } from '../../lib/error-utils.js';

const statsRoute = new Hono<AuthContext>();

/**
 * GET /api/auto-grade/stats
 * 
 * Get usage statistics and cost analytics
 */
statsRoute.get('/stats', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const period = c.req.query('period') || 'week'; // week | month | all

  try {
    const today = new Date();
    let startDate: Date;

    if (period === 'week') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate = new Date('1970-01-01'); // All time
    }

    // Get stats from database
    const stats = await db.select().from(aiUsageStats);

    // Filter by date range
    const filteredStats = stats.filter((s) => s.date >= startDate);

    // Aggregate totals
    const totalTokens = filteredStats.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalCost = filteredStats.reduce((sum, s) => sum + parseFloat(s.totalCost), 0);
    const totalRequests = filteredStats.reduce((sum, s) => sum + s.requestCount, 0);
    const totalSuccess = filteredStats.reduce((sum, s) => sum + s.successCount, 0);
    const totalFailures = filteredStats.reduce((sum, s) => sum + s.failureCount, 0);

    // Success rate
    const successRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;

    // Provider breakdown
    const providerBreakdown = filteredStats.reduce((acc, s) => {
      const key = s.provider;
      if (!acc[key]) {
        acc[key] = { tokens: 0, cost: 0, count: 0 };
      }
      acc[key].tokens += s.totalTokens;
      acc[key].cost += parseFloat(s.totalCost);
      acc[key].count += s.requestCount;
      return acc;
    }, {} as Record<string, { tokens: number; cost: number; count: number }>);

    // Convert to array for easier consumption
    const providerBreakdownArray = Object.entries(providerBreakdown).map(([provider, data]) => ({
      provider,
      tokens: data.tokens,
      cost: parseFloat(data.cost.toFixed(6)),
      count: data.count,
    }));

    // Average processing time (weighted average across all stats)
    const totalProcessingTime = filteredStats.reduce((sum, s) => {
      return sum + (s.avgProcessingTime || 0) * s.requestCount;
    }, 0);
    const avgProcessingTime = totalRequests > 0 ? Math.round(totalProcessingTime / totalRequests) : null;

    // Average cost per request
    const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

    return c.json({
      period,
      totalTokens,
      totalCost: parseFloat(totalCost.toFixed(6)),
      totalRequests,
      successCount: totalSuccess,
      failureCount: totalFailures,
      successRate: parseFloat(successRate.toFixed(2)),
      avgCostPerRequest: parseFloat(avgCostPerRequest.toFixed(6)),
      avgProcessingTime,
      providerBreakdown: providerBreakdownArray,
      dailyStats: filteredStats.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        tokens: s.totalTokens,
        cost: parseFloat(parseFloat(s.totalCost).toFixed(6)),
        requests: s.requestCount,
        successRate: s.requestCount > 0 ? (s.successCount / s.requestCount) * 100 : 0,
      })),
    });
  } catch (error: unknown) {
    console.error('Stats error:', error);
    return c.json({ error: 'Failed to fetch statistics', details: getErrorMessage(error) }, 500);
  }
});

export default statsRoute;
