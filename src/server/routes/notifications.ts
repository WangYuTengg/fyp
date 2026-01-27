import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { staffNotifications } from '../../db/schema.js';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';

const app = new Hono<AuthContext>();

/**
 * GET /api/notifications
 * 
 * Get all notifications for the current user
 */
app.get('/', authMiddleware, async (c) => {
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

/**
 * GET /api/notifications/unread-count
 * 
 * Get count of unread notifications for badge
 */
app.get('/unread-count', authMiddleware, async (c) => {
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
  } catch (error: any) {
    console.error('Failed to fetch unread count:', error);
    return c.json({ error: 'Failed to fetch unread count' }, 500);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * 
 * Mark a notification as read
 */
app.patch('/:id/read', authMiddleware, async (c) => {
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

/**
 * PATCH /api/notifications/mark-all-read
 * 
 * Mark all notifications as read for the current user
 */
app.patch('/mark-all-read', authMiddleware, async (c) => {
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
  } catch (error: any) {
    console.error('Failed to mark all as read:', error);
    return c.json({ error: 'Failed to update notifications' }, 500);
  }
});

export default app;
