import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { courses, enrollments, users } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, inArray, sql } from 'drizzle-orm';

const bulkEnrollRoute = new Hono<AuthContext>();

// Bulk enroll users by email (staff/admin only)
bulkEnrollRoute.post('/:id/enrollments/bulk', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const rawEmails: unknown[] = Array.isArray(body?.emails) ? body.emails : [];
  const role = typeof body?.role === 'string' ? body.role : 'student';

  if (!['lecturer', 'ta', 'lab_exec', 'student'].includes(role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  if (rawEmails.length === 0) {
    return c.json({ error: 'No emails provided' }, 400);
  }

  const normalizedEmails = rawEmails
    .filter((email): email is string => typeof email === 'string')
    .map((email: string) => email.trim().toLowerCase())
    .filter((email: string) => email.length > 0);

  const seen = new Set<string>();
  const uniqueEmails: string[] = [];
  for (const email of normalizedEmails) {
    if (!seen.has(email)) {
      seen.add(email);
      uniqueEmails.push(email);
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = new Set(uniqueEmails.filter((email) => !emailRegex.test(email)));
  const validEmails = uniqueEmails.filter((email) => !invalidEmails.has(email));

  // Check if course exists
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  const results: Array<{
    email: string;
    status: 'enrolled' | 'already_enrolled' | 'not_found' | 'invalid';
    enrollmentId?: string;
  }> = [];

  if (validEmails.length > 0) {
    const matchedUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(sql`lower(${users.email})`, validEmails));

    const userByEmail = new Map<string, { id: string; email: string }>();
    for (const matched of matchedUsers) {
      userByEmail.set(matched.email.toLowerCase(), matched);
    }

    const userIds = matchedUsers.map((u) => u.id);
    const existingEnrollments = userIds.length
      ? await db
          .select({ id: enrollments.id, userId: enrollments.userId })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.courseId, courseId),
              inArray(enrollments.userId, userIds)
            )
          )
      : [];

    const existingByUserId = new Map<string, string>();
    for (const existing of existingEnrollments) {
      existingByUserId.set(existing.userId, existing.id);
    }

    const newEnrollmentValues = matchedUsers
      .filter((matched) => !existingByUserId.has(matched.id))
      .map((matched) => ({
        userId: matched.id,
        courseId,
        role,
      }));

    const inserted = newEnrollmentValues.length
      ? await db
          .insert(enrollments)
          .values(newEnrollmentValues)
          .onConflictDoNothing()
          .returning({ id: enrollments.id, userId: enrollments.userId })
      : [];

    const insertedByUserId = new Map<string, string>();
    for (const created of inserted) {
      insertedByUserId.set(created.userId, created.id);
    }

    for (const email of uniqueEmails) {
      if (invalidEmails.has(email)) {
        results.push({ email, status: 'invalid' });
        continue;
      }

      const matched = userByEmail.get(email);
      if (!matched) {
        results.push({ email, status: 'not_found' });
        continue;
      }

      const existingId = existingByUserId.get(matched.id);
      if (existingId) {
        results.push({ email, status: 'already_enrolled', enrollmentId: existingId });
        continue;
      }

      const createdId = insertedByUserId.get(matched.id);
      results.push({ email, status: 'enrolled', enrollmentId: createdId });
    }
  } else {
    for (const email of uniqueEmails) {
      results.push({ email, status: 'invalid' });
    }
  }

  const counts = {
    enrolled: results.filter((r) => r.status === 'enrolled').length,
    alreadyEnrolled: results.filter((r) => r.status === 'already_enrolled').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
  };

  return c.json({ results, counts });
});

export default bulkEnrollRoute;
