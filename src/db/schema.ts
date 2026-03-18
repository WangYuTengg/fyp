import { pgTable, text, timestamp, uuid, pgEnum, integer, boolean, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'staff', 'student']);
export const courseRoleEnum = pgEnum('course_role', ['lecturer', 'ta', 'lab_exec', 'student']);
export const assignmentTypeEnum = pgEnum('assignment_type', ['mcq', 'written', 'coding', 'uml']);
export const submissionStatusEnum = pgEnum('submission_status', ['draft', 'submitted', 'late', 'grading', 'graded']);
export const aiJobStatusEnum = pgEnum('ai_job_status', ['pending', 'processing', 'completed', 'failed']);
export const notificationTypeEnum = pgEnum('notification_type', ['grading_failed', 'grading_completed', 'batch_completed']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').default('student').notNull(),
  supabaseId: text('supabase_id').unique(),
  deactivatedAt: timestamp('deactivated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Password reset tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Courses table
export const courses = pgTable('courses', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // e.g., "CS2030"
  name: text('name').notNull(), // e.g., "Software Engineering"
  description: text('description'),
  academicYear: text('academic_year').notNull(), // e.g., "2024/2025"
  semester: text('semester').notNull(), // e.g., "Semester 1"
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Course enrollments (student/staff membership in courses)
export const enrollments = pgTable('enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  role: courseRoleEnum('role').default('student').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserCourse: unique().on(table.userId, table.courseId),
}));

// Question pool (reusable questions)
export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  type: assignmentTypeEnum('type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  content: jsonb('content').notNull(), // Question-specific data (MCQ options, code template, etc.)
  rubric: jsonb('rubric'), // Grading criteria
  points: integer('points').default(10).notNull(),
  tags: text('tags').array(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  courseIdIdx: index('questions_course_id_idx').on(table.courseId),
}));

// Assignments
export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: timestamp('due_date'),
  openDate: timestamp('open_date').defaultNow(),
  maxAttempts: integer('max_attempts').default(1),
  mcqPenaltyPerWrongSelection: integer('mcq_penalty_per_wrong_selection').default(1).notNull(),
  timeLimit: integer('time_limit'), // in minutes
  isPublished: boolean('is_published').default(false).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Assignment-Question mapping (which questions are in which assignment)
export const assignmentQuestions = pgTable('assignment_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  assignmentId: uuid('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  points: integer('points'), // Override question's default points
}, (table) => ({
  uniqueAssignmentQuestion: unique().on(table.assignmentId, table.questionId),
}));

// Student submissions (one per assignment attempt)
export const submissions = pgTable('submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  assignmentId: uuid('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').default(1).notNull(),
  status: submissionStatusEnum('status').default('draft').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  gradedAt: timestamp('graded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('submissions_user_id_idx').on(table.userId),
  assignmentIdIdx: index('submissions_assignment_id_idx').on(table.assignmentId),
}));

// Individual answers to questions
export const answers = pgTable('answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  submissionId: uuid('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  content: jsonb('content').notNull(), // Student's answer data
  fileUrl: text('file_url'), // For UML diagrams or code files
  aiGradingSuggestion: jsonb('ai_grading_suggestion'), // LLM output for stretch goal
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueSubmissionQuestion: unique().on(table.submissionId, table.questionId),
}));

// File upload history for version tracking
export const fileUploads = pgTable('file_uploads', {
  id: uuid('id').defaultRandom().primaryKey(),
  answerId: uuid('answer_id').notNull().references(() => answers.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  filePath: text('file_path').notNull(), // Storage path
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(), // in bytes
  mimeType: text('mime_type').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (table) => ({
  answerIdIdx: index('file_uploads_answer_id_idx').on(table.answerId),
}));

// Marks/grades for submissions
export const marks = pgTable('marks', {
  id: uuid('id').defaultRandom().primaryKey(),
  submissionId: uuid('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  answerId: uuid('answer_id').references(() => answers.id, { onDelete: 'cascade' }),
  points: integer('points').notNull(),
  maxPoints: integer('max_points').notNull(),
  feedback: text('feedback'),
  markedBy: uuid('marked_by').references(() => users.id),
  isAiAssisted: boolean('is_ai_assisted').default(false),
  aiSuggestionAccepted: boolean('ai_suggestion_accepted').default(false), // Track if AI suggestion was accepted
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Rubrics for questions
export const rubrics = pgTable('rubrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }).unique(),
  criteria: jsonb('criteria').notNull(), // Array of { id, description, maxPoints }
  totalPoints: integer('total_points').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// AI Grading Jobs tracking
export const aiGradingJobs = pgTable('ai_grading_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: text('job_id'), // Graphile Worker job ID
  batchId: uuid('batch_id'), // Group jobs from same batch trigger
  answerId: uuid('answer_id').notNull().references(() => answers.id, { onDelete: 'cascade' }),
  status: aiJobStatusEnum('status').default('pending').notNull(),
  tokensUsed: integer('tokens_used'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: text('cost'), // Store as string to preserve precision (e.g., "0.000123")
  error: jsonb('error'), // Error details if failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  answerIdIdx: index('ai_grading_jobs_answer_id_idx').on(table.answerId),
  batchIdIdx: index('ai_grading_jobs_batch_id_idx').on(table.batchId),
  statusIdx: index('ai_grading_jobs_status_idx').on(table.status),
}));

// AI Usage Statistics (daily aggregates)
export const aiUsageStats = pgTable('ai_usage_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: timestamp('date').notNull(),
  provider: text('provider').notNull(), // openai, anthropic
  model: text('model').notNull(), // gpt-4o, claude-3-5-sonnet, etc.
  totalTokens: integer('total_tokens').default(0).notNull(),
  totalCost: text('total_cost').default('0').notNull(), // Store as string for precision
  requestCount: integer('request_count').default(0).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  failureCount: integer('failure_count').default(0).notNull(),
  avgProcessingTime: integer('avg_processing_time'), // in milliseconds
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueDateProviderModel: unique().on(table.date, table.provider, table.model),
  dateIdx: index('ai_usage_stats_date_idx').on(table.date),
}));

// Staff Notifications
export const staffNotifications = pgTable('staff_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message'),
  data: jsonb('data'), // Additional context (e.g., { jobId, answerId, error })
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('staff_notifications_user_id_idx').on(table.userId),
  readIdx: index('staff_notifications_read_idx').on(table.read),
}));

// System settings (global configuration)
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  submissions: many(submissions),
  createdQuestions: many(questions),
  createdAssignments: many(assignments),
  markedSubmissions: many(marks),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  enrollments: many(enrollments),
  assignments: many(assignments),
  questions: many(questions),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  course: one(courses, { fields: [assignments.courseId], references: [courses.id] }),
  creator: one(users, { fields: [assignments.createdBy], references: [users.id] }),
  assignmentQuestions: many(assignmentQuestions),
  submissions: many(submissions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  course: one(courses, { fields: [questions.courseId], references: [courses.id] }),
  creator: one(users, { fields: [questions.createdBy], references: [users.id] }),
  assignmentQuestions: many(assignmentQuestions),
  answers: many(answers),
}));

export const assignmentQuestionsRelations = relations(assignmentQuestions, ({ one }) => ({
  assignment: one(assignments, { fields: [assignmentQuestions.assignmentId], references: [assignments.id] }),
  question: one(questions, { fields: [assignmentQuestions.questionId], references: [questions.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  assignment: one(assignments, { fields: [submissions.assignmentId], references: [assignments.id] }),
  user: one(users, { fields: [submissions.userId], references: [users.id] }),
  answers: many(answers),
  marks: many(marks),
}));

export const answersRelations = relations(answers, ({ one, many }) => ({
  submission: one(submissions, { fields: [answers.submissionId], references: [submissions.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
  marks: many(marks),
}));

export const marksRelations = relations(marks, ({ one }) => ({
  submission: one(submissions, { fields: [marks.submissionId], references: [submissions.id] }),
  answer: one(answers, { fields: [marks.answerId], references: [answers.id] }),
  marker: one(users, { fields: [marks.markedBy], references: [users.id] }),
}));

export const rubricsRelations = relations(rubrics, ({ one }) => ({
  question: one(questions, { fields: [rubrics.questionId], references: [questions.id] }),
}));

export const aiGradingJobsRelations = relations(aiGradingJobs, ({ one }) => ({
  answer: one(answers, { fields: [aiGradingJobs.answerId], references: [answers.id] }),
}));

export const staffNotificationsRelations = relations(staffNotifications, ({ one }) => ({
  user: one(users, { fields: [staffNotifications.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));
