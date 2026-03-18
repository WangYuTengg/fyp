import { Hono } from 'hono';
import crypto from 'node:crypto';
import { db } from '../../../db/index.js';
import { users, passwordResetTokens } from '../../../db/schema.js';
import type { AuthContext } from '../../middleware/auth.js';
import { safeValidateBody, forgotPasswordSchema } from '../../lib/validation-schemas.js';
import { sendEmail, buildPasswordResetEmail } from '../../lib/email.js';
import { eq, and, gte, sql } from 'drizzle-orm';

const RATE_LIMIT_PER_EMAIL_PER_HOUR = 3;
const TOKEN_EXPIRY_HOURS = 1;

const forgotPasswordRoute = new Hono<AuthContext>();

forgotPasswordRoute.post('/forgot-password', async (c) => {
  const body = await c.req.json();
  const validation = safeValidateBody(forgotPasswordSchema, body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const { email } = validation.data;

  // Always return success to prevent email enumeration
  const successResponse = () =>
    c.json({ message: 'If an account with that email exists, a reset link has been sent.' });

  // Find user by email
  const [user] = await db
    .select({ id: users.id, email: users.email, deactivatedAt: users.deactivatedAt })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user || user.deactivatedAt) {
    return successResponse();
  }

  // Rate limit: max N reset requests per email per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        gte(passwordResetTokens.createdAt, oneHourAgo)
      )
    );

  if (recentCount.count >= RATE_LIMIT_PER_EMAIL_PER_HOUR) {
    return successResponse();
  }

  // Generate token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });

  // Send email
  const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  const html = buildPasswordResetEmail(resetUrl);

  await sendEmail({
    to: user.email,
    subject: 'Password Reset — UML Platform',
    html,
  });

  return successResponse();
});

export default forgotPasswordRoute;
