import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { requireAuth, requireRole, type AuthContext } from '../../middleware/auth.js';
import { safeValidateBody, adminResetPasswordSchema } from '../../lib/validation-schemas.js';
import { eq } from 'drizzle-orm';

const BCRYPT_ROUNDS = 10;

const resetUserPasswordRoute = new Hono<AuthContext>();

// Admin override: reset any user's password
resetUserPasswordRoute.put('/:id/reset-password', requireAuth, requireRole('admin'), async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json();
  const validation = safeValidateBody(adminResetPasswordSchema, body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const { password } = validation.data;

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existingUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});

export default resetUserPasswordRoute;
