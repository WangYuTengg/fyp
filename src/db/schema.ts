import { pgTable, text, timestamp, uuid, pgEnum, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'staff', 'student']);
export const courseRoleEnum = pgEnum('course_role', ['lecturer', 'ta', 'lab_exec', 'student']);
export const assignmentTypeEnum = pgEnum('assignment_type', ['mcq', 'written', 'coding', 'uml']);
export const submissionStatusEnum = pgEnum('submission_status', ['draft', 'submitted', 'grading', 'graded']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: userRoleEnum('role').default('student').notNull(),
  supabaseId: text('supabase_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
});

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
});

// Assignments
export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: assignmentTypeEnum('type').notNull(),
  dueDate: timestamp('due_date'),
  openDate: timestamp('open_date').defaultNow(),
  maxAttempts: integer('max_attempts').default(1),
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
});

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
});

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
});

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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
