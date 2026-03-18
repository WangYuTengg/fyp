import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../../../db/index.js';
import { users, passwordResetTokens, refreshTokens } from '../../../db/schema.js';
import type { AuthContext } from '../../middleware/auth.js';
import { safeValidateBody, resetPasswordSchema } from '../../lib/validation-schemas.js';
import { eq, and, isNull, gte } from 'drizzle-orm';

const BCRYPT_ROUNDS = 10;

const resetPasswordRoute = new Hono<AuthContext>();

resetPasswordRoute.post('/reset-password', async (c) => {
  const body = await c.req.json();
  const validation = safeValidateBody(resetPasswordSchema, body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const { token, password } = validation.data;

  // Find valid, unused, non-expired token
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        isNull(passwordResetTokens.usedAt),
        gte(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!resetToken) {
    return c.json({ error: 'Invalid or expired reset token' }, 400);
  }

  // Hash new password and update user
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, resetToken.userId));

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, resetToken.id));

  // S9: Revoke all refresh tokens on password change
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.userId, resetToken.userId));

  return c.json({ message: 'Password reset successfully' });
});

export default resetPasswordRoute;
