import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AuthContext } from '../../middleware/auth.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-dev-secret-change-me'
);

const passwordLoginRoute = new Hono<AuthContext>();

passwordLoginRoute.post('/password-login', async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // Look up user in local DB
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Issue a custom JWT
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

export default passwordLoginRoute;
