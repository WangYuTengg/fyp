import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { staffNotifications } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const markReadRoute = new Hono<AuthContext>();

/**
 * PATCH /api/notifications/:id/read
 * 
 * Mark a notification as read
 */
markReadRoute.patch('/:id/read', authMiddleware, async (c) => {
  const user = c.get('user');
  const notificationId = c.req.param('id');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    // Verify notification belongs to user
    const [notification] = await db
      .select()
      .from(staffNotifications)
      .where(eq(staffNotifications.id, notificationId))
      .limit(1);

    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    if (notification.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Mark as read
    await db
      .update(staffNotifications)
      .set({ read: true })
      .where(eq(staffNotifications.id, notificationId));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Failed to mark notification as read:', error);
    return c.json({ error: 'Failed to update notification' }, 500);
  }
});

export default markReadRoute;
