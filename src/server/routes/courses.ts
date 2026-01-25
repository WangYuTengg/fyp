import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { courses, enrollments, users } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { eq, and, desc } from 'drizzle-orm';

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

export default app;
