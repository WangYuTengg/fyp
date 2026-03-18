import { z } from 'zod';

/**
 * Validation schemas for API request bodies
 * Use these to validate and type-check incoming requests
 */

// User/Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Course schemas
export const createCourseSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
  name: z.string().min(1, 'Course name is required'),
  description: z.string().optional(),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/, 'Academic year must be in format YYYY/YYYY'),
  semester: z.string().min(1, 'Semester is required'),
  isActive: z.boolean().optional().default(true),
});

export const updateCourseSchema = createCourseSchema.partial();

export const enrollmentSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  courseId: z.string().uuid('Invalid course ID'),
  role: z.enum(['lecturer', 'ta', 'lab_exec', 'student']),
});

// Assignment schemas
export const createAssignmentSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  openDate: z.string().datetime().optional(),
  maxAttempts: z.number().int().min(1).optional().default(1),
  mcqPenaltyPerWrongSelection: z.number().int().min(0).optional().default(1),
  timeLimit: z.number().int().min(1).optional(),
  latePenaltyType: z.enum(['none', 'fixed', 'per_day', 'per_hour']).optional().default('none'),
  latePenaltyValue: z.number().min(0).max(100).optional(),
  latePenaltyCap: z.number().min(0).max(100).optional(),
  attemptScoringMethod: z.enum(['latest', 'highest']).optional().default('latest'),
  isPublished: z.boolean().optional().default(false),
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

export const addQuestionToAssignmentSchema = z.object({
  questionId: z.string().uuid('Invalid question ID'),
  order: z.number().int().min(0),
  points: z.number().int().min(0).optional(),
});

// Question schemas
export const mcqOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Option text is required'),
  isCorrect: z.boolean().optional(),
});

export const createQuestionSchema = z.object({
  courseId: z.string().uuid('Invalid course ID').optional(),
  type: z.enum(['mcq', 'written', 'uml']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  content: z.record(z.string(), z.unknown()), // Type depends on question type
  rubric: z.record(z.string(), z.unknown()).optional(),
  points: z.number().int().min(0).optional().default(10),
  tags: z.array(z.string()).optional(),
  assignmentId: z.string().uuid().optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial().omit({ courseId: true });

// Submission schemas
export const startSubmissionSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
});

export const saveAnswerSchema = z.object({
  questionId: z.string().uuid('Invalid question ID'),
  content: z.record(z.string(), z.unknown()),
  fileUrl: z.string().optional(),
});

export const gradeSchema = z.object({
  answerId: z.string().uuid('Invalid answer ID'),
  points: z.number(),
  maxPoints: z.number().min(0),
  feedback: z.string().optional(),
});

export const bulkGradeSchema = z.object({
  grades: z.array(gradeSchema).min(1, 'At least one grade is required'),
});

// Auto-grading schemas
export const rubricCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  maxPoints: z.number().min(0),
});

export const batchAutoGradeSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
  questionTypes: z.array(z.enum(['written', 'uml'])).optional(),
  rubricOverride: z.array(rubricCriterionSchema).optional(), // Optional rubric override for all questions
});

export const singleAutoGradeSchema = z.object({
  answerId: z.string().uuid('Invalid answer ID'),
  rubric: z.array(rubricCriterionSchema).optional(), // Optional custom rubric for this answer
  forceRegrade: z.boolean().optional().default(false), // Allow re-grading even if already graded
});

// Admin user management schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'staff', 'student']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'staff', 'student']).optional(),
  isActive: z.boolean().optional(),
});

export const adminResetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const bulkCreateUsersSchema = z.object({
  users: z.array(z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['admin', 'staff', 'student']),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  })).min(1, 'At least one user is required').max(500, 'Maximum 500 users per batch'),
});

// Password reset schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Tag schemas
export const createTagSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  name: z.string().min(1, 'Tag name is required'),
});

// Notification schemas
export const markNotificationReadSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID'),
});

/**
 * Helper to validate request body and return typed result
 */
export function validateBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  return schema.parse(body);
}

/**
 * Helper to safely validate request body and return error on failure
 */
type ValidationSuccess<T> = { success: true; data: T; error?: never };
type ValidationFailure = { success: false; error: string; data?: never };

export function safeValidateBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): ValidationSuccess<z.infer<T>> | ValidationFailure {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const firstError = result.error.issues[0];
  return {
    success: false,
    error: firstError ? `${firstError.path.join('.')}: ${firstError.message}` : 'Validation failed',
  };
}
