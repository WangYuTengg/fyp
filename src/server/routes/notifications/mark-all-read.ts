import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { staffNotifications } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';
import { getErrorMessage } from '../../lib/error-utils.js';

const markAllReadRoute = new Hono<AuthContext>();

/**
 * PATCH /api/notifications/mark-all-read
 * 
 * Mark all notifications as read for the current user
 */
markAllReadRoute.patch('/mark-all-read', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    await db
      .update(staffNotifications)
      .set({ read: true })
      .where(
        and(
          eq(staffNotifications.userId, user.id),
          eq(staffNotifications.read, false)
        )
      );

    return c.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to mark all as read:', error);
    return c.json({ error: 'Failed to update notifications', details: getErrorMessage(error) }, 500);
  }
});

export default markAllReadRoute;
