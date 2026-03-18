import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { requireAuth, requireRole, type AuthContext } from '../../middleware/auth.js';
import { safeValidateBody, bulkCreateUsersSchema } from '../../lib/validation-schemas.js';
import { inArray } from 'drizzle-orm';

const BCRYPT_ROUNDS = 10;

type BulkCreateResult = {
  email: string;
  status: 'created' | 'already_exists' | 'error';
  userId?: string;
  error?: string;
};

const bulkCreateUsersRoute = new Hono<AuthContext>();

bulkCreateUsersRoute.post('/bulk', requireAuth, requireRole('admin'), async (c) => {
  const body = await c.req.json();
  const validation = safeValidateBody(bulkCreateUsersSchema, body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const { users: usersToCreate } = validation.data;
  const emails = usersToCreate.map(u => u.email.toLowerCase());

  // Check for duplicates in the input
  const uniqueEmails = new Set(emails);
  if (uniqueEmails.size !== emails.length) {
    return c.json({ error: 'Duplicate emails found in input' }, 400);
  }

  // Check which emails already exist
  const existingUsers = await db
    .select({ email: users.email })
    .from(users)
    .where(inArray(users.email, emails));

  const existingEmailSet = new Set(existingUsers.map(u => u.email));

  const results: BulkCreateResult[] = [];
  const toInsert: Array<{
    email: string;
    name: string;
    role: 'admin' | 'staff' | 'student';
    passwordHash: string;
  }> = [];

  // Hash passwords and separate existing from new
  for (const user of usersToCreate) {
    const email = user.email.toLowerCase();
    if (existingEmailSet.has(email)) {
      results.push({ email, status: 'already_exists' });
    } else {
      const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
      toInsert.push({
        email,
        name: user.name,
        role: user.role,
        passwordHash,
      });
    }
  }

  // Bulk insert new users
  if (toInsert.length > 0) {
    const inserted = await db
      .insert(users)
      .values(toInsert)
      .returning({ id: users.id, email: users.email });

    for (const row of inserted) {
      results.push({ email: row.email, status: 'created', userId: row.id });
    }
  }

  const counts = {
    created: results.filter(r => r.status === 'created').length,
    alreadyExists: results.filter(r => r.status === 'already_exists').length,
    errors: results.filter(r => r.status === 'error').length,
  };

  return c.json({ results, counts }, 201);
});

export default bulkCreateUsersRoute;
