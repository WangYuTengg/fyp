# Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database running
- Supabase project created

## Setup Steps

### 1. Environment Configuration
Create a `.env` file with your credentials:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fyp

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Server
PORT=3000
NODE_ENV=development
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Apply Database Migrations
```bash
npm run db:generate  # Generate migrations (already done)
npm run db:push      # Or manually apply the SQL in src/db/migrations/
```

Alternatively, apply the migration manually:
```bash
psql $DATABASE_URL < src/db/migrations/0001_optimal_quasar.sql
```

### 4. Start Development Servers

**Terminal 1** - Start the API server:
```bash
npm run dev:server
```

**Terminal 2** - Start the Vite dev server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

---

## Testing the Application

### 1. Create a Test User

Navigate to `http://localhost:5173/login` and sign up with an email address.

**Note**: The default role is `student`. To test staff features, you'll need to manually update the role in the database:

```sql
UPDATE users SET role = 'staff' WHERE email = 'your@email.com';
```

### 2. Test Student Flow

1. **Login as student** → You'll be redirected to `/student`
2. **Create a test course** (via staff account or SQL):
   ```sql
   INSERT INTO courses (code, name, academic_year, semester) 
   VALUES ('CS101', 'Introduction to Programming', '2024/2025', 'Semester 1');
   ```
3. **Enroll yourself**:
   ```sql
   INSERT INTO enrollments (user_id, course_id, role) 
   VALUES (
     (SELECT id FROM users WHERE email = 'your@email.com'),
     (SELECT id FROM courses WHERE code = 'CS101'),
     'student'
   );
   ```
4. **Refresh dashboard** → Course should appear
5. **Click course** → View course details
6. **Create an assignment** (via staff account):
   ```bash
   curl -X POST http://localhost:3000/api/assignments \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "courseId": "COURSE_UUID",
       "title": "Assignment 1",
       "description": "First assignment",
       "type": "uml",
       "maxAttempts": 3
     }'
   ```
7. **Publish assignment**:
   ```bash
   curl -X PATCH http://localhost:3000/api/assignments/ASSIGNMENT_ID/publish \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"isPublished": true}'
   ```
8. **Student can start assignment** → Click "Start" button
9. **Save answers** (via API):
   ```bash
   curl -X POST http://localhost:3000/api/submissions/SUBMISSION_ID/answers \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "questionId": "QUESTION_UUID",
       "content": {"answer": "My UML diagram description"},
       "fileUrl": "https://example.com/diagram.png"
     }'
   ```
10. **Submit assignment**:
    ```bash
    curl -X POST http://localhost:3000/api/submissions/SUBMISSION_ID/submit \
      -H "Authorization: Bearer YOUR_TOKEN"
    ```

### 3. Test Staff Flow

1. **Update user role to staff**:
   ```sql
   UPDATE users SET role = 'staff' WHERE email = 'staff@email.com';
   ```
2. **Login as staff** → Redirected to `/staff`
3. **Create a new course**:
   - Click "Create Course" button
   - Fill in the form (code, name, academic year, semester)
   - Submit
4. **Click course** → View course management page
5. **Create assignment**:
   - Click "Create Assignment"
   - Fill in details (title, description, type, due date)
   - Submit
6. **Publish assignment** → Click "Publish" button
7. **View enrollments** → See list of enrolled users
8. **Grade a submission** (via API):
   ```bash
   curl -X POST http://localhost:3000/api/submissions/SUBMISSION_ID/grade \
     -H "Authorization: Bearer STAFF_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "points": 85,
       "maxPoints": 100,
       "feedback": "Good work! Missing some relationships."
     }'
   ```

---

## API Testing with cURL

### Get Access Token
After logging in via the UI, open browser DevTools → Application → Local Storage → Look for Supabase session token.

Or use the Supabase client:
```javascript
const { data } = await supabase.auth.getSession();
console.log(data.session.access_token);
```

### Example API Calls

**Get current user**:
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**List courses**:
```bash
curl http://localhost:3000/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Create course (staff only)**:
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Authorization: Bearer STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CS2030",
    "name": "Object-Oriented Programming",
    "description": "Learn OOP principles",
    "academicYear": "2024/2025",
    "semester": "Semester 2"
  }'
```

**Enroll in course**:
```bash
curl -X POST http://localhost:3000/api/courses/COURSE_ID/enroll \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**List assignments for a course**:
```bash
curl http://localhost:3000/api/assignments/course/COURSE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Start a new submission**:
```bash
curl -X POST http://localhost:3000/api/submissions/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assignmentId": "ASSIGNMENT_ID"}'
```

---

## Database Inspection

### Useful Queries

**List all users**:
```sql
SELECT id, email, role, created_at FROM users;
```

**List all courses**:
```sql
SELECT code, name, academic_year, semester, is_active FROM courses;
```

**List enrollments for a course**:
```sql
SELECT u.email, e.role, e.created_at
FROM enrollments e
JOIN users u ON e.user_id = u.id
WHERE e.course_id = 'COURSE_UUID';
```

**List submissions for an assignment**:
```sql
SELECT u.email, s.status, s.submitted_at, s.attempt_number
FROM submissions s
JOIN users u ON s.user_id = u.id
WHERE s.assignment_id = 'ASSIGNMENT_UUID';
```

**View grading for a submission**:
```sql
SELECT m.points, m.max_points, m.feedback, u.email as graded_by
FROM marks m
JOIN users u ON m.marked_by = u.id
WHERE m.submission_id = 'SUBMISSION_UUID';
```

---

## Troubleshooting

### Issue: "Unauthorized" on API calls
- Check if token is valid (not expired)
- Ensure `Authorization: Bearer TOKEN` header is set
- Verify Supabase URL and anon key in `.env`

### Issue: Course not showing in student dashboard
- Check enrollment: `SELECT * FROM enrollments WHERE user_id = 'YOUR_ID';`
- Verify course exists and is active
- Check browser console for API errors

### Issue: Assignment not visible to student
- Ensure assignment is published: `UPDATE assignments SET is_published = true WHERE id = 'ASSIGNMENT_ID';`
- Check if student is enrolled in the course

### Issue: Build errors
- Run `npm run build` to check for TypeScript errors
- Ensure all dependencies are installed: `npm install`
- Check Node version: `node --version` (should be 18+)

---

## Next Steps

Once the basic flow is working:

1. **Create questions** → Currently no UI, but you can insert directly:
   ```sql
   INSERT INTO questions (course_id, type, title, content, points, created_by)
   VALUES (
     (SELECT id FROM courses WHERE code = 'CS101'),
     'uml',
     'Design a Library System',
     '{"instructions": "Create a UML class diagram for a library management system"}'::jsonb,
     100,
     (SELECT id FROM users WHERE email = 'staff@email.com')
   );
   ```

2. **Link questions to assignments**:
   ```sql
   INSERT INTO assignment_questions (assignment_id, question_id, "order", points)
   VALUES ('ASSIGNMENT_UUID', 'QUESTION_UUID', 1, 100);
   ```

3. **Test full submission flow** with answers linked to questions

4. **Implement Phase 2 features** (question management UI, timed attempts)

---

## Production Deployment

### Build for Production
```bash
npm run build
```

### Run Production Server
```bash
NODE_ENV=production node dist/server/server/index.js
```

### Docker Deployment
```bash
docker-compose up -d
```

Make sure to update `docker-compose.yml` with production database credentials and Supabase settings.

---

## Support

For issues or questions:
- Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for architecture details
- Review [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for roadmap
- Check API routes in `src/server/routes/` for endpoint documentation

---

*Last Updated: January 25, 2026*
