import { Hono } from 'hono';
import crypto from 'node:crypto';
import { SignJWT } from 'jose';
import { db } from '../../../db/index.js';
import { users, refreshTokens } from '../../../db/schema.js';
import type { AuthContext } from '../../middleware/auth.js';
import { eq, and, isNull, gte, lt } from 'drizzle-orm';
import { env } from '../../config/env.js';

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const JWT_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const refreshRoute = new Hono<AuthContext>();

refreshRoute.post('/refresh', async (c) => {
  const body = await c.req.json();
  const { refreshToken } = body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return c.json({ error: 'Refresh token is required' }, 400);
  }

  // Find valid, unused, non-expired refresh token
  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.token, refreshToken),
        isNull(refreshTokens.usedAt),
        gte(refreshTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }

  // Mark old token as used (single-use rotation)
  await db
    .update(refreshTokens)
    .set({ usedAt: new Date() })
    .where(eq(refreshTokens.id, existing.id));

  // Verify user still exists and is active
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, existing.userId))
    .limit(1);

  if (!user || user.deactivatedAt) {
    return c.json({ error: 'Account not found or deactivated' }, 401);
  }

  // Issue new JWT
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);

  // Issue new refresh token
  const newRefreshToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: newRefreshToken,
    expiresAt,
  });

  // Clean up expired tokens for this user (housekeeping)
  await db
    .delete(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, user.id),
        lt(refreshTokens.expiresAt, new Date())
      )
    );

  return c.json({
    token,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

export default refreshRoute;
