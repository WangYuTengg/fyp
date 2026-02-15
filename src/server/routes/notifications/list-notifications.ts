import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { staffNotifications } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq, desc } from 'drizzle-orm';

const listNotificationsRoute = new Hono<AuthContext>();

/**
 * GET /api/notifications
 * 
 * Get all notifications for the current user
 */
listNotificationsRoute.get('/', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const notifications = await db
      .select()
      .from(staffNotifications)
      .where(eq(staffNotifications.userId, user.id))
      .orderBy(desc(staffNotifications.createdAt));

    return c.json({ notifications });
  } catch (error: any) {
    console.error('Failed to fetch notifications:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

export default listNotificationsRoute;
