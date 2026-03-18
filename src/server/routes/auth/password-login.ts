import { Hono } from 'hono';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { db } from '../../../db/index.js';
import { users, refreshTokens } from '../../../db/schema.js';
import type { AuthContext } from '../../middleware/auth.js';
import { safeValidateBody, loginSchema } from '../../lib/validation-schemas.js';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const JWT_EXPIRY = '24h'; // S9: shortened from 7d

const passwordLoginRoute = new Hono<AuthContext>();

passwordLoginRoute.post('/password-login', async (c) => {
  const body = await c.req.json();
  const validation = safeValidateBody(loginSchema, body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const { email, password } = validation.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (user.deactivatedAt) {
    return c.json({ error: 'Account deactivated' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Issue JWT
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);

  // S9: Issue refresh token (7-day, single-use)
  const refreshToken = crypto.randomUUID();
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: refreshExpiresAt,
  });

  return c.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

export default passwordLoginRoute;
