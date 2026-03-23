# Database & Drizzle ORM

## Schema Location

All schema definitions: `src/db/schema.ts`

## Schema Patterns

### Table Definitions

```typescript
import { pgTable, uuid, varchar, timestamp, integer, text, jsonb } from 'drizzle-orm/pg-core';

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
```

### Relationships

```typescript
import { relations } from 'drizzle-orm';

export const coursesRelations = relations(courses, ({ many }) => ({
  enrollments: many(enrollments),
  assignments: many(assignments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  course: one(courses, {
    fields: [enrollments.course_id],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [enrollments.user_id],
    references: [users.id],
  }),
}));
```

### Foreign Keys

```typescript
export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  course_id: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  // ... other fields
});
```

## Type Inference

```typescript
// Infer select type (reading from DB)
export type Course = typeof courses.$inferSelect;

// Infer insert type (writing to DB)
export type NewCourse = typeof courses.$inferInsert;

// Use in functions
async function createCourse(data: NewCourse): Promise<Course> {
  const [course] = await db.insert(courses).values(data).returning();
  return course;
}
```

## Common Query Patterns

### Select All

```typescript
import { db } from '@/db';
import { courses } from '@/db/schema';

const allCourses = await db.select().from(courses);
```

### Select with Filter

```typescript
import { eq } from 'drizzle-orm';

const course = await db.select()
  .from(courses)
  .where(eq(courses.id, courseId))
  .limit(1);
```

### Insert

```typescript
const [newCourse] = await db.insert(courses)
  .values({
    name: 'Introduction to UML',
    code: 'CS101',
    description: 'Learn UML diagrams',
  })
  .returning();
```

### Update

```typescript
const [updatedCourse] = await db.update(courses)
  .set({ name: 'Advanced UML', updated_at: new Date() })
  .where(eq(courses.id, courseId))
  .returning();
```

### Delete

```typescript
await db.delete(courses)
  .where(eq(courses.id, courseId));
```

### Join Queries

```typescript
const enrollments = await db.select({
  enrollment: enrollments,
  course: courses,
  user: users,
})
  .from(enrollments)
  .leftJoin(courses, eq(enrollments.course_id, courses.id))
  .leftJoin(users, eq(enrollments.user_id, users.id))
  .where(eq(enrollments.user_id, userId));
```

### Using Relational Queries

```typescript
// More intuitive than joins
const courseWithEnrollments = await db.query.courses.findFirst({
  where: eq(courses.id, courseId),
  with: {
    enrollments: {
      with: {
        user: true,
      },
    },
    assignments: true,
  },
});
```

## Migration Workflow

### 1. Update Schema

Edit `src/db/schema.ts` to add/modify tables or columns.

### 2. Generate Migration

```bash
npm run db:generate
```

This creates SQL migration files in `src/db/migrations/`.

### 3. Review Migration

Check generated SQL in `src/db/migrations/XXXX_*.sql` to ensure correctness.

### 4. Apply Migration

**Option A**: Use Drizzle Kit (development)
```bash
npm run db:migrate
```

**Option B**: Apply SQL manually (production)
```bash
psql -U user -d fyp -f src/db/migrations/XXXX_*.sql
```

## Database Client Setup

`src/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

## JSONB Fields

For flexible data (e.g., question options, rubrics):

```typescript
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 20 }).notNull(),
  options: jsonb('options'), // For MCQ options, coding tests, etc.
});

// Usage
await db.insert(questions).values({
  type: 'mcq',
  options: { 
    choices: ['A', 'B', 'C', 'D'],
    correct: 1,
  },
});
```

## Timestamps

Always include `created_at` and `updated_at`:

```typescript
{
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}
```

Update `updated_at` manually in update queries:
```typescript
.set({ name: 'New Name', updated_at: new Date() })
```

## Enums

Use Postgres enums via `pgEnum`:

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'staff', 'student']);
export const submissionStatusEnum = pgEnum('submission_status', ['draft', 'submitted', 'late', 'grading', 'graded']);
export const aiJobStatusEnum = pgEnum('ai_job_status', ['pending', 'processing', 'completed', 'failed']);
```

## Current Tables (16)

- **Auth & Users**: `users`, `passwordResetTokens`, `refreshTokens`
- **Courses**: `courses`, `enrollments`
- **Assessment**: `questions`, `assignments`, `assignmentQuestions`
- **Submissions**: `submissions`, `answers`, `marks`, `rubrics`
- **AI Grading**: `aiGradingJobs`, `aiUsageStats`
- **Platform**: `staffNotifications`, `systemSettings`
