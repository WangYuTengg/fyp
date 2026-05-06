import { Hono } from 'hono';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { courses, systemSettings } from '../../../db/schema.js';
import { authMiddleware, requireRole, type AuthContext } from '../../middleware/auth.js';
import { HTTPException } from 'hono/http-exception';

const automationSettingsRoute = new Hono<AuthContext>();

const AUTO_GRADE_ON_SUBMIT_KEY = (id: string) => `course.${id}.auto_grade_on_submit`;
const AUTO_GRADE_MCQ_ONLY_KEY = (id: string) => `course.${id}.auto_grade_mcq_only`;

const updateSchema = z.object({
  autoGradeOnSubmit: z.boolean(),
  autoGradeMcqOnly: z.boolean(),
});

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

/**
 * GET /api/courses/:id/automation-settings
 * Returns the course's auto-grading toggles. Defaults: off / mcq-only on.
 */
automationSettingsRoute.get(
  '/:id/automation-settings',
  authMiddleware,
  requireRole('staff', 'admin'),
  async (c) => {
    const courseId = c.req.param('id');

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return c.json({ error: 'Course not found' }, 404);

    const rows = await db
      .select()
      .from(systemSettings)
      .where(
        inArray(systemSettings.key, [
          AUTO_GRADE_ON_SUBMIT_KEY(courseId),
          AUTO_GRADE_MCQ_ONLY_KEY(courseId),
        ])
      );

    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    return c.json({
      autoGradeOnSubmit: parseBool(byKey.get(AUTO_GRADE_ON_SUBMIT_KEY(courseId)), false),
      autoGradeMcqOnly: parseBool(byKey.get(AUTO_GRADE_MCQ_ONLY_KEY(courseId)), true),
    });
  }
);

/**
 * PUT /api/courses/:id/automation-settings
 */
automationSettingsRoute.put(
  '/:id/automation-settings',
  authMiddleware,
  requireRole('staff', 'admin'),
  async (c) => {
    const user = c.get('user')!;
    const courseId = c.req.param('id');

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return c.json({ error: 'Course not found' }, 404);

    const body = await c.req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPException(400, { message: 'Invalid request', cause: parsed.error });
    }

    const { autoGradeOnSubmit, autoGradeMcqOnly } = parsed.data;
    const now = new Date();

    const upsert = async (key: string, value: string, description: string) => {
      await db
        .insert(systemSettings)
        .values({ key, value, description, updatedBy: user.id })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value, updatedAt: now, updatedBy: user.id },
        });
    };

    await upsert(
      AUTO_GRADE_ON_SUBMIT_KEY(courseId),
      String(autoGradeOnSubmit),
      'Per-course: auto-grade on submission'
    );
    await upsert(
      AUTO_GRADE_MCQ_ONLY_KEY(courseId),
      String(autoGradeMcqOnly),
      'Per-course: auto-grade MCQ questions only'
    );

    return c.json({ success: true, autoGradeOnSubmit, autoGradeMcqOnly });
  }
);

export default automationSettingsRoute;
