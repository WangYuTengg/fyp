import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { requireAuth, requireRole, type AuthContext } from '../../middleware/auth.js';
import { safeValidateBody, updateUserSchema } from '../../lib/validation-schemas.js';
import { eq } from 'drizzle-orm';

const updateUserRoute = new Hono<AuthContext>();

updateUserRoute.put('/:id', requireAuth, requireRole('admin'), async (c) => {
  const userId = c.req.param('id');
  const currentUser = c.get('user')!;
  const body = await c.req.json();
  const validation = safeValidateBody(updateUserSchema, body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const { name, role, isActive } = validation.data;

  // Find the user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existingUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Prevent admin from demoting themselves
  if (userId === currentUser.id && role && role !== 'admin') {
    return c.json({ error: 'Cannot change your own role' }, 400);
  }

  // Prevent admin from deactivating themselves
  if (userId === currentUser.id && isActive === false) {
    return c.json({ error: 'Cannot deactivate your own account' }, 400);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) {
    updateData.deactivatedAt = isActive ? null : new Date();
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      deactivatedAt: users.deactivatedAt,
      createdAt: users.createdAt,
    });

  return c.json(updated);
});

export default updateUserRoute;
