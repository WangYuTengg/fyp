# API Design with Hono

## Server Entry Point

`src/server/index.ts`:
```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';

const app = new Hono();

// Middleware
app.use('*', cors({
  origin: process.env.VITE_APP_URL || 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/courses', courseRoutes);

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
```

## Route File Structure

Each resource gets its own file in `src/server/routes/`:
- `auth.ts` - Authentication endpoints
- `courses.ts` - Course CRUD
- `assignments.ts` - Assignment management
- `submissions.ts` - Submission handling
- `questions.ts` - Question bank

## Route Patterns

### Basic CRUD Example

`src/server/routes/courses.ts`:
```typescript
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { db } from '@/db';
import { courses } from '@/db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/courses
app.get('/', async (c) => {
  try {
    const allCourses = await db.select().from(courses);
    return c.json({ success: true, data: allCourses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return c.json({ success: false, error: 'Failed to fetch courses' }, 500);
  }
});

// GET /api/courses/:id
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const [course] = await db.select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);
    
    if (!course) {
      return c.json({ success: false, error: 'Course not found' }, 404);
    }
    
    return c.json({ success: true, data: course });
  } catch (error) {
    console.error('Error fetching course:', error);
    return c.json({ success: false, error: 'Failed to fetch course' }, 500);
  }
});

// POST /api/courses
app.post('/', async (c) => {
  const user = c.get('user');
  
  // Check role
  if (user.role !== 'staff' && user.role !== 'admin') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const body = await c.req.json();
    const [newCourse] = await db.insert(courses)
      .values(body)
      .returning();
    
    return c.json({ success: true, data: newCourse }, 201);
  } catch (error) {
    console.error('Error creating course:', error);
    return c.json({ success: false, error: 'Failed to create course' }, 500);
  }
});

// PUT /api/courses/:id
app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  
  // Check ownership/permissions
  // ... (check if user is course lecturer or admin)
  
  try {
    const body = await c.req.json();
    const [updated] = await db.update(courses)
      .set({ ...body, updated_at: new Date() })
      .where(eq(courses.id, id))
      .returning();
    
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating course:', error);
    return c.json({ success: false, error: 'Failed to update course' }, 500);
  }
});

// DELETE /api/courses/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    await db.delete(courses).where(eq(courses.id, id));
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting course:', error);
    return c.json({ success: false, error: 'Failed to delete course' }, 500);
  }
});

export default app;
```

## Response Format

Always use consistent response structure:

**Success**:
```typescript
return c.json({ success: true, data: {...} });
```

**Error**:
```typescript
return c.json({ success: false, error: 'Error message' }, statusCode);
```

## HTTP Status Codes

- `200` - OK (successful GET, PUT, DELETE)
- `201` - Created (successful POST)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (valid auth, insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Accessing Authenticated User

Auth middleware attaches user to context:

```typescript
app.get('/profile', authMiddleware, async (c) => {
  const user = c.get('user'); // { id, email, role }
  return c.json({ success: true, data: user });
});
```

## Request Body Validation

```typescript
app.post('/courses', authMiddleware, async (c) => {
  const body = await c.req.json();
  
  // Validate required fields
  if (!body.name || !body.code) {
    return c.json({ 
      success: false, 
      error: 'Missing required fields: name, code' 
    }, 400);
  }
  
  // Validate types/formats
  if (typeof body.name !== 'string' || body.name.length > 255) {
    return c.json({ 
      success: false, 
      error: 'Invalid course name' 
    }, 400);
  }
  
  // Proceed with insertion
  // ...
});
```

## Query Parameters

```typescript
// GET /api/courses?published=true&page=1
app.get('/courses', async (c) => {
  const published = c.req.query('published');
  const page = c.req.query('page');
  
  // Use in query
  let query = db.select().from(courses);
  if (published === 'true') {
    query = query.where(eq(courses.published, true));
  }
  
  const results = await query;
  return c.json({ success: true, data: results });
});
```

## File Uploads

For UML diagram uploads (future enhancement):

```typescript
import { Hono } from 'hono';
import { streamToBuffer } from 'some-utility';

app.post('/submissions/:id/file', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const file = body['file'] as File;
  
  if (!file) {
    return c.json({ success: false, error: 'No file uploaded' }, 400);
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return c.json({ success: false, error: 'Invalid file type' }, 400);
  }
  
  // Process file (save to storage, etc.)
  // ...
  
  return c.json({ success: true, data: { fileUrl: '...' } });
});
```

## Error Handling Middleware

Create global error handler:

```typescript
// src/server/middleware/error.ts
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ 
    success: false, 
    error: 'Internal server error' 
  }, 500);
});
```

## Nested Routes

For related resources:

```typescript
// GET /api/courses/:courseId/assignments
app.get('/:courseId/assignments', authMiddleware, async (c) => {
  const courseId = c.req.param('courseId');
  
  const assignments = await db.select()
    .from(assignments)
    .where(eq(assignments.course_id, courseId));
  
  return c.json({ success: true, data: assignments });
});
```

## Role-Based Route Protection

```typescript
function requireRole(...allowedRoles: string[]) {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || !allowedRoles.includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    await next();
  };
}

// Usage
app.post('/courses', authMiddleware, requireRole('staff', 'admin'), async (c) => {
  // Only staff and admin can create courses
});
```
