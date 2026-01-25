# TypeScript Conventions

## Type Safety

- **Always** use explicit types for function parameters and return values
- **Avoid** `any` - use `unknown` if type is truly unknown
- **Prefer** interfaces for object shapes, types for unions/intersections
- **Use** Drizzle's inferred types from schema: `typeof users.$inferSelect`

## Example Patterns

### API Response Types

```typescript
// Define response shape
interface CourseResponse {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

// API function with explicit types
async function getCourse(id: string): Promise<CourseResponse> {
  const response = await fetch(`/api/courses/${id}`);
  if (!response.ok) throw new Error('Failed to fetch course');
  return response.json();
}
```

### Drizzle Schema Types

```typescript
// schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 20 }).notNull(),
});

// Infer types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### React Component Props

```typescript
// Use interface for component props
interface CourseCardProps {
  course: Course;
  onEnroll?: (courseId: string) => void;
  isEnrolled: boolean;
}

export function CourseCard({ course, onEnroll, isEnrolled }: CourseCardProps) {
  // ...
}
```

### Async/Await Error Handling

```typescript
// Always handle errors explicitly
async function submitAssignment(data: SubmissionData) {
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Submission failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Submission error:', error);
    throw error; // Re-throw or handle gracefully
  }
}
```

## Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `auth-context.ts`, `route-guards.ts`)
- **Components**: `PascalCase.tsx` (e.g., `CourseCard.tsx`, `UserInfo.tsx`)
- **Variables/Functions**: `camelCase` (e.g., `getCourse`, `isEnrolled`)
- **Types/Interfaces**: `PascalCase` (e.g., `Course`, `UserRole`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`, `MAX_FILE_SIZE`)

## Utility Types

```typescript
// Extract subset of fields
type CoursePreview = Pick<Course, 'id' | 'name' | 'code'>;

// Make all fields optional
type PartialCourse = Partial<Course>;

// Make all fields required
type RequiredCourse = Required<Course>;

// Exclude fields
type CourseWithoutTimestamps = Omit<Course, 'created_at' | 'updated_at'>;
```

## Discriminated Unions for Question Types

```typescript
type QuestionType = 'mcq' | 'written' | 'coding' | 'uml';

interface BaseQuestion {
  id: string;
  text: string;
  points: number;
}

interface MCQQuestion extends BaseQuestion {
  type: 'mcq';
  options: string[];
  correctAnswer: number;
}

interface WrittenQuestion extends BaseQuestion {
  type: 'written';
  maxWords?: number;
}

// Union type with discriminator
type Question = MCQQuestion | WrittenQuestion | CodingQuestion | UMLQuestion;

// Type guard
function isMCQQuestion(q: Question): q is MCQQuestion {
  return q.type === 'mcq';
}
```

## Avoid Common Pitfalls

❌ **Don't** use implicit any:
```typescript
function getData(id) { // Missing type
  return fetch(`/api/data/${id}`);
}
```

✅ **Do** specify types:
```typescript
function getData(id: string): Promise<Response> {
  return fetch(`/api/data/${id}`);
}
```

❌ **Don't** ignore errors:
```typescript
async function loadData() {
  const data = await fetch('/api/data').then(r => r.json()); // No error handling
}
```

✅ **Do** handle errors:
```typescript
async function loadData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Fetch failed');
    return await response.json();
  } catch (error) {
    console.error('Failed to load data:', error);
    throw error;
  }
}
```
