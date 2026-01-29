import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { courses, enrollments, users } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';

const app = new Hono<AuthContext>();

// Get all courses (filtered by user's enrollments for students)
app.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role === 'admin' || user.role === 'staff') {
    // Staff/admin see all courses
    const allCourses = await db
      .select()
      .from(courses)
      .orderBy(desc(courses.createdAt));
    
    return c.json(allCourses);
  } else {
    // Students see only enrolled courses
    const enrolledCourses = await db
      .select({
        id: courses.id,
        code: courses.code,
        name: courses.name,
        description: courses.description,
        academicYear: courses.academicYear,
        semester: courses.semester,
        isActive: courses.isActive,
        enrollmentRole: enrollments.role,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, user.id))
      .orderBy(desc(courses.createdAt));
    
    return c.json(enrolledCourses);
  }
});

// Get a single course by ID
app.get('/:id', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user')!;

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  // Check if user has access
  if (user.role !== 'admin' && user.role !== 'staff') {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, user.id),
          eq(enrollments.courseId, courseId)
        )
      )
      .limit(1);

    if (!enrollment) {
      return c.json({ error: 'Not enrolled in this course' }, 403);
    }
  }

  return c.json(course);
});

// Create a new course (staff/admin only)
app.post('/', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { code, name, description, academicYear, semester } = body;

  if (!code || !name || !academicYear || !semester) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const [course] = await db
    .insert(courses)
    .values({
      code,
      name,
      description,
      academicYear,
      semester,
      isActive: true,
    })
    .returning();

  return c.json(course, 201);
});

// Enroll a user in a course
app.post('/:id/enroll', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user')!;
  const body = await c.req.json();
  
  // Only staff/admin can enroll others; students can self-enroll if allowed
  const targetUserId = body.userId || user.id;
  const enrollmentRole = body.role || 'student';

  if (targetUserId !== user.id && user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Cannot enroll other users' }, 403);
  }

  // Check if course exists
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  // Check if already enrolled
  const [existing] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, targetUserId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: 'Already enrolled' }, 400);
  }

  const [enrollment] = await db
    .insert(enrollments)
    .values({
      userId: targetUserId,
      courseId,
      role: enrollmentRole,
    })
    .returning();

  return c.json(enrollment, 201);
});

// Get enrollments for a course (staff/admin only)
app.get('/:id/enrollments', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const courseEnrollments = await db
    .select({
      id: enrollments.id,
      role: enrollments.role,
      createdAt: enrollments.createdAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, courseId))
    .orderBy(desc(enrollments.createdAt));

  return c.json(courseEnrollments);
});

// Bulk enroll users by email (staff/admin only)
app.post('/:id/enrollments/bulk', requireAuth, async (c) => {
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

  const results: Array<{ email: string; status: 'enrolled' | 'already_enrolled' | 'not_found' | 'invalid'; enrollmentId?: string }> = [];

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

// Remove an enrollment from a course (staff/admin only)
app.delete('/:id/enrollments/:enrollmentId', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const enrollmentId = c.req.param('enrollmentId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.id, enrollmentId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);

  if (!enrollment) {
    return c.json({ error: 'Enrollment not found' }, 404);
  }

  await db
    .delete(enrollments)
    .where(eq(enrollments.id, enrollmentId));

  return c.json({ success: true });
});

export default app;
