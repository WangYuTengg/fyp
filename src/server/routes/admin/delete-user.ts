import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { requireAuth, requireRole, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const deleteUserRoute = new Hono<AuthContext>();

// Soft delete (deactivate) a user
deleteUserRoute.delete('/:id', requireAuth, requireRole('admin'), async (c) => {
  const userId = c.req.param('id');
  const currentUser = c.get('user')!;

  if (userId === currentUser.id) {
    return c.json({ error: 'Cannot deactivate your own account' }, 400);
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existingUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  await db
    .update(users)
    .set({ deactivatedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});

export default deleteUserRoute;
