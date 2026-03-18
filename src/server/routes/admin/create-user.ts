import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { requireAuth, requireRole, type AuthContext } from '../../middleware/auth.js';
import { safeValidateBody, createUserSchema } from '../../lib/validation-schemas.js';
import { eq } from 'drizzle-orm';

const BCRYPT_ROUNDS = 10;

const createUserRoute = new Hono<AuthContext>();

createUserRoute.post('/', requireAuth, requireRole('admin'), async (c) => {
  const body = await c.req.json();
  const validation = safeValidateBody(createUserSchema, body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const { email, name, role, password } = validation.data;

  // Check if email already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing) {
    return c.json({ error: 'A user with this email already exists' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [newUser] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      name,
      role,
      passwordHash,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    });

  return c.json(newUser, 201);
});

export default createUserRoute;
