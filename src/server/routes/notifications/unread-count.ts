import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { staffNotifications } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';
import { getErrorMessage } from '../../lib/error-utils.js';

const unreadCountRoute = new Hono<AuthContext>();

/**
 * GET /api/notifications/unread-count
 * 
 * Get count of unread notifications for badge
 */
unreadCountRoute.get('/unread-count', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const unreadNotifications = await db
      .select()
      .from(staffNotifications)
      .where(
        and(
          eq(staffNotifications.userId, user.id),
          eq(staffNotifications.read, false)
        )
      );

    return c.json({ count: unreadNotifications.length });
  } catch (error: unknown) {
    console.error('Failed to fetch unread count:', error);
    return c.json({ error: 'Failed to fetch unread count', details: getErrorMessage(error) }, 500);
  }
});

export default unreadCountRoute;
