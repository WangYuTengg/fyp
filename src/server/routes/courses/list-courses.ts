import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { courses, enrollments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, desc } from 'drizzle-orm';

const listCoursesRoute = new Hono<AuthContext>();

// Get all courses (filtered by user's enrollments for students)
listCoursesRoute.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role === 'admin' || user.role === 'staff') {
    // Staff/admin see all courses
    const allCourses = await db
      .select()
      .from(courses)
      .orderBy(desc(courses.createdAt));

    return c.json(allCourses);
  }

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
});

export default listCoursesRoute;
