# UML Assessment Platform - Project Status

**Last Updated:** January 27, 2026  
**Stabilization Sprint Completed:** ✅ P0/P1 Issues Resolved

## Project Overview

An automated assessment platform for UML diagrams with LLM-assisted grading, designed for on-premise school deployment.

**Key Differentiator**: LLM-assisted UML diagram grading with vision model integration, human-in-the-loop oversight, and comprehensive audit trails.

---

## Tech Stack

- **Frontend**: Vite + React + TypeScript + TanStack Router + Tailwind CSS
- **Backend**: Hono + Supabase Auth + PostgreSQL + Drizzle ORM
- **Background Jobs**: Graphile Worker
- **LLM**: OpenAI GPT-4o / Anthropic Claude 3.5 Sonnet (configurable)
- **DevOps**: Docker + GitHub Actions

---

## Current Status: Phase 2.5 (85% Complete) - Post-Stabilization

### 🎯 Recent Stabilization Sprint (Jan 27, 2026)

**Completed:**
- ✅ Fixed 5 critical P0 bugs (worker init, token calc, vision API, auth bypass, payload mismatch)
- ✅ Implemented 8 P1 features (validation, error boundaries, rate limiting, indexes)
- ✅ Created comprehensive documentation (API + Deployment guides)
- ✅ Centralized configuration constants
- ✅ Extended signed URL expiry to 24 hours
- ✅ Added database indexes for performance

**See:** [docs/STABILIZATION_REPORT.md](docs/STABILIZATION_REPORT.md) for full details.

### ✅ Completed Features

#### Phase 0-1: Foundation & Core Loop (100% Complete)
- ✅ Full project scaffolding (Vite + React + TypeScript + Hono)
- ✅ Supabase authentication with JWT validation
- ✅ Drizzle ORM configuration with PostgreSQL
- ✅ Docker setup
- ✅ TanStack Router
- ✅ Tailwind CSS styling

#### Database Schema (100% Complete)
**9 Tables Fully Implemented:**
- ✅ `users` - User accounts with global roles (admin, staff, student)
- ✅ `courses` - Course information (code, name, academic year, semester)
- ✅ `enrollments` - Course-scoped roles (lecturer, TA, lab_exec, student)
- ✅ `assignments` - Supports 4 types (MCQ, written, coding, UML); current UI supports MCQ/written
- ✅ `questions` - Reusable question pool with tags, rubrics, and type-specific content
- ✅ `assignment_questions` - Many-to-many mapping with ordering and point overrides
- ✅ `submissions` - Attempt tracking with status lifecycle (draft → submitted → grading → graded)
- ✅ `answers` - Individual question responses with file URL support (for future UML uploads)
- ✅ `marks` - Grading results with manual/AI-assisted flags

**Key Features:**
- Full Drizzle ORM relations for easy querying
- Course-scoped roles (separate from global roles)
- Extensible JSONB fields for content/rubrics
- Migration: `src/db/migrations/0001_optimal_quasar.sql`

#### Server APIs (100% Complete)
**Authentication & Authorization:**
- ✅ JWT validation middleware via Supabase
- ✅ Auto-sync Supabase users to local DB on first login
- ✅ Role-based access control (RBAC) with `requireAuth()` and `requireRole()`
- ✅ Request context enrichment with user data

**API Routes:**
- ✅ **Auth** (`/api/auth`):
  - `GET /me` - Get current user with DB role
- ✅ **Courses** (`/api/courses`):
  - `GET /` - List courses (filtered by enrollment for students)
  - `GET /:id` - Get course details
  - `POST /` - Create course (staff/admin only)
  - `POST /:id/enroll` - Enroll user
  - `GET /:id/enrollments` - List enrollments (staff only)
- ✅ **Assignments** (`/api/assignments`):
  - `GET /course/:courseId` - List assignments
  - `GET /:id` - Get assignment with questions
  - `POST /` - Create assignment (MCQ/written only)
  - `PATCH /:id/publish` - Publish/unpublish
- ✅ **Submissions** (`/api/submissions`):
  - `GET /assignment/:assignmentId` - List submissions (own for students, all for staff)
  - `POST /start` - Start new submission (creates draft)
  - `POST /:submissionId/answers` - Save answer (strict due date cutoff)
  - `POST /:submissionId/submit` - Finalize submission
  - `POST /:submissionId/grade` - Grade submission (staff only)
- ✅ **Questions** (`/api/questions`):
  - `GET /course/:courseId?search=...&tags=...&types=...` - List questions with filters
  - `POST /` - Create question with tags
  - `PUT /:id` - Update question
  - `DELETE /:id` - Delete question
- ✅ **Tags** (`/api/tags`):
  - `GET /course/:courseId` - Get unique tags for course

#### Client Features (100% Complete)
**Authentication:**
- ✅ Enhanced AuthContext with DB roles
- ✅ `hasRole()` and `isStaff()` helper methods
- ✅ Auto-redirect based on role (student → `/student`, staff → `/staff`)

**Student Features:**
- ✅ Student dashboard (view enrolled courses)
- ✅ Student course detail page (view published assignments)
- ✅ Assignment attempt page (view questions, type answers)
- ✅ Save answers (manual + auto-save every 30s)
- ✅ Submit assignment (finalize)
- ✅ **Strict due date enforcement** (cannot save drafts after due date)

**Staff Features:**
- ✅ Staff dashboard (view all courses)
- ✅ Staff course management page with tabs (Assignments, Questions, Enrollments)
- ✅ Create courses
- ✅ Create assignments (MCQ/written) with questions selected at creation
- ✅ Publish/unpublish assignments
- ✅ View enrollments
- ✅ Create questions (MCQ/written) with chip-based tag input
- ✅ Edit/delete questions (inline editing)
- ✅ Tag management (view course tags, auto-created from questions)
- ✅ **Question filters**:
  - Text search (title + description + prompt)
  - Tags multi-select (AND logic)
  - Question type multi-select (MCQ/written/coding/UML)
  - Clear all filters

**UI Components:**
- ✅ Modal component (reusable)
- ✅ Sidebar navigation
- ✅ API client utility with automatic token injection
- ✅ Route guards (client-side)

---

## ✅ Phase 2: Complete (100%)

### Completed Features

1. ✅ **Tag Management System**
   - Tags automatically created when added to questions
   - Tag normalization (lowercase, trim)
   - TagManager component displays all course tags
   - Tags stored as array in database

2. ✅ **Chip-Based Tag Input**
   - Visual chip-based tag selection on create/edit forms
   - Quick-add buttons for existing tags
   - Remove chips with × button

3. ✅ **Question Pool Filters**
   - Server-side filtering by search, tags, types
   - QuestionFilters component with clear all
   - Client-side filter state management

4. ✅ **Question CRUD**
   - Create questions (MCQ/written) with tags
   - Edit questions (inline form)
   - Delete questions (with confirmation)
   - Tag display on question cards

5. ✅ **Auto-Save**
   - Periodic auto-save every 30 seconds (silent)
   - Due date cutoff enforcement (cannot save drafts after due date)
   - Last saved timestamp display
   - Auto-save spinner indicator

6. ✅ **Assignment-Question Management**
   - POST /api/assignments/:id/questions - Add questions to assignment
   - DELETE /api/assignment-questions/:questionLinkId - Remove question from assignment
   - PATCH /api/assignment-questions/reorder - Reorder questions
   - Server-side validation (type match, course match, duplicate prevention)

7. ✅ **Timer Enforcement**
   - Timer countdown component with visual feedback
   - Auto-submit when time expires
   - Warning alert at 5 minutes remaining
   - Server-side time limit validation on submit
   - Elapsed time calculation from submission startedAt

8. ✅ **Draft Indicators & Navigation Warnings**
   - "Last saved" timestamp in AssignmentHeader
   - Auto-save spinner when saving
   - Draft/Submitted badges on student assignment list
   - Resume/View/Start button labels based on status
   - beforeunload warning for unsaved changes

9. ✅ **Database Constraints & Indexes**
   - Unique constraint on (userId, courseId) in enrollments
   - Unique constraint on (submissionId, questionId) in answers
   - Unique constraint on (assignmentId, questionId) in assignment_questions
   - Index on questions.courseId
   - Index on submissions.userId
   - Index on submissions.assignmentId

---

## 🔲 Phase 3: UML Submission & File Handling (Not Started)

**Estimated Duration:** 2 weeks

### File Upload Infrastructure
- [ ] Integrate Supabase Storage (or self-hosted MinIO for on-prem)
- [ ] `POST /api/submissions/:id/upload` endpoint
- [ ] File type validation (.png, .jpg, .puml, .svg)
- [ ] File size limits (5MB)
- [ ] Generate signed URLs for secure access
- [ ] Multiple file uploads per submission (versioning)

### UML Diagram Viewer
- [ ] Image preview component (PNG/JPG/SVG)
- [ ] PlantUML/Mermaid renderer (if textual format)
- [ ] Side-by-side comparison view (student vs. reference)
- [ ] Zoom/pan for large diagrams

### Submission Versioning
- [ ] Track file versions (upload history)
- [ ] Timestamp each version
- [ ] Allow grader to view all versions
- [ ] Diff view for textual UML (PlantUML DSL)

### Client Updates
- [ ] File upload component with drag-drop
- [ ] Upload progress indicator
- [ ] File preview before submit
- [ ] View uploaded files in submission detail

---

## 🔲 Phase 4: LLM-Assisted UML Grading (Stretch Goal)

**Estimated Duration:** 4 weeks

### Rubric Builder
- [ ] Rubric editor UI (add/remove criteria)
- [ ] Assign weights to criteria
- [ ] Map criteria to LLM prompts
- [ ] Save rubrics per assignment

### UML Conversion Pipeline
- [ ] Image OCR (optional, for handwritten diagrams)
- [ ] Vision model integration (GPT-4 Vision, Claude Vision)
- [ ] PlantUML converter (image → DSL)
- [ ] Structured data extraction (classes, relationships, attributes)

### LLM Grading Engine
- [ ] Prompt template system
- [ ] API integration (OpenAI, Anthropic, or self-hosted)
- [ ] Structured output parsing (JSON rubric scores)
- [ ] Confidence scoring for each criterion
- [ ] Error handling (API failures, malformed responses)

### Grading UI
- [ ] "Request AI Suggestions" button
- [ ] AI suggestions panel (scores + feedback per rubric item)
- [ ] Accept/reject/modify suggestions
- [ ] Diff view (original vs. AI suggestion)
- [ ] Override with audit log

### Queue System (NFR: Concurrency)
- [ ] Install BullMQ + Redis
- [ ] Create grading worker pool (configurable: 2-4 workers)
- [ ] Job creation on "Request AI Grading"
- [ ] Progress tracking (queued → processing → completed)
- [ ] Retry logic (exponential backoff)

### Queue UI
- [ ] Grading queue status page (staff)
- [ ] Real-time progress updates (WebSocket or polling)
- [ ] Estimated completion time
- [ ] Cancel job option

### Audit & Provenance
- [ ] Audit log table (all grading actions)
- [ ] Track AI vs. human grades
- [ ] Export grading report (CSV/PDF)
- [ ] Flag submissions with AI assistance
- [ ] Admin analytics page (AI usage stats)

---

## 🔲 Testing & Deployment (Week 12)

### Testing
- [ ] Unit tests for API routes (Vitest)
- [ ] Integration tests (submission flow)
- [ ] Load testing (simulate 100+ concurrent users)
- [ ] LLM grading accuracy evaluation (sample dataset)

### Performance Profiling
- [ ] Measure API response times (95th percentile)
- [ ] Database query optimization (indexes)
- [ ] Identify bottlenecks (concurrent submissions)

### NFR Documentation
- [ ] Document resource requirements (CPU, RAM, storage)
- [ ] Max concurrent users supported
- [ ] LLM grading throughput (submissions/hour)
- [ ] Scaling recommendations (horizontal vs. vertical)

### Deployment
- [ ] Production Docker Compose configuration
- [ ] Nginx reverse proxy setup
- [ ] HTTPS/SSL configuration
- [ ] Database backup strategy
- [ ] Deployment guide for on-prem

### User Documentation
- [ ] Student user guide (how to take assignments)
- [ ] Staff user guide (how to create courses, grade)
- [ ] Admin user guide (user management, analytics)
- [ ] API documentation (Swagger/OpenAPI)

---

## Priority Roadmap (Next Immediate Tasks)

### Week 1 (Next 7 Days)
1. **Assignment-Question Management** (2 days)
   - POST/DELETE endpoints for adding/removing questions
   - AssignmentBuilder component
   - Question reordering

2. **Timer Enforcement** (1 day)
   - Client-side countdown timer
   - Server-side time validation
   - Auto-submit on timeout

3. **Draft Indicators** (1 day)
   - Last saved timestamp
   - Auto-save spinner
   - Navigation warning

4. **Database Constraints** (0.5 days)
   - Add unique constraints and indexes
   - Generate migration

### Week 2-3
5. **File Upload** (2 days)
   - Supabase Storage integration
   - Upload API
   - Preview component

6. **UML Viewer** (1 day)
   - Image preview
   - Side-by-side view

### Week 4-5
7. **Rubric Builder** (2 days)
   - Rubric form
   - Save to assignment

8. **LLM Integration** (3-4 days)
   - Prompt templates
   - API integration
   - Suggestions UI

### Week 6
9. **Queue System** (2-3 days)
   - BullMQ setup
   - Worker pool
   - Progress tracking

---

## Non-Functional Requirements (NFRs)

### Performance
- **Concurrent Users**: Support 200+ concurrent logins
- **Submission Handling**: Process 50 simultaneous submissions without degradation
- **LLM Grading**: Queue-based processing, max 4 concurrent gradings (configurable)
- **Response Time**: API calls < 500ms (95th percentile), excluding LLM grading

### Scalability (On-Prem Deployment)
**Recommended Infrastructure:**
- **App Server**: 4 vCPUs, 8GB RAM (handles API + static serving)
- **Database**: PostgreSQL with 4GB RAM, SSD storage
- **LLM Workers**: 2-4 workers × 2GB RAM each (CPU or GPU depending on model)
- **Storage**: 100GB initial (scales with submissions)

**Scaling Strategies:**
- Horizontal scaling: Add app servers behind load balancer
- Database: Read replicas for analytics queries
- LLM: Increase worker count or use external API (OpenAI)

### Security
- **Authentication**: Supabase Auth (email OTP, SSO-ready)
- **Authorization**: Role-based access control (global + course-scoped)
- **Data Protection**: JWT tokens, HTTPS only, file upload sanitization
- **Audit Logs**: Track all grading actions, AI usage

### Availability
- **Uptime Target**: 99% during academic term
- **Backup**: Daily database backups, retained for 30 days
- **Recovery**: RTO < 4 hours, RPO < 24 hours

### Compliance
- **Academic Integrity**: All AI-assisted grades flagged and auditable
- **Data Privacy**: Student submissions not used for LLM training (use private APIs or self-hosted models)

---

## Risk Tracking

| Risk | Status | Mitigation |
|------|--------|------------|
| LLM unreliable | 🟡 Monitoring | Human override required, confidence thresholds |
| On-prem compute limited | 🟢 Planned | Queue system, async processing |
| Student gaming AI | 🟡 To Address | Randomize rubrics, spot-checks |
| Data privacy | 🟢 Addressed | Self-host option, no data retention |
| Scalability | 🟡 To Profile | Load testing in Phase 4 |

---

## Known Limitations / Tech Debt

1. **No Bulk Enrollment**: Currently one-by-one API calls (future: CSV import)
2. **No Pagination**: All lists returned in full (future: implement for large datasets)
3. **No Search/Filter on Dashboards**: Students/staff see all items (future: add filters)
4. **Route Guards**: Client-side only (server middleware protects APIs)
5. **No Email Notifications**: Assignment published/graded events (future: integrate email service)
6. **No Analytics Dashboard**: Grade distributions, assignment stats (future: admin analytics page)

---

## Development Commands

**Package Manager**: `npm`

**Dev Commands:**
```bash
npm run dev          # Start both client + server
npm run dev:client   # Vite dev server (port 5173)
npm run dev:server   # Hono API server (port 3000)
```

**Build Commands:**
```bash
npm run build        # Build both client + server
npm run build:client # Build client only
npm run build:server # Build server only
```

**Database Commands:**
```bash
npm run db:generate  # Generate migrations from schema
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio
```

---

## Environment Setup

Required in `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/fyp
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
PORT=3000
```

---

## Testing Checklist (Before Each Phase)

- [ ] All TypeScript errors resolved (`npm run build`)
- [ ] API endpoints tested with cURL/Postman
- [ ] UI manually tested (happy path + edge cases)
- [ ] Database migrations applied
- [ ] Documentation updated
- [ ] Code reviewed (self or peer)

---

## Success Metrics

### Phase 1 (Core Loop) - ✅ Achieved
- ✅ 100% of students can submit assignments
- ✅ 100% of staff can create and publish assignments
- ✅ < 2% error rate on submissions

### Phase 2 (Question Pools) - 🟡 In Progress
- [ ] 80% of assignments use question pool (vs. one-off questions)
- [ ] Average assignment creation time < 15 minutes

### Phase 3 (UML Submissions) - 🔲 Not Started
- [ ] 100% of UML assignments support file upload
- [ ] File upload success rate > 98%

### Phase 4 (LLM Grading) - 🔲 Not Started
- [ ] LLM suggestions accepted rate > 60%
- [ ] Average grading time reduction > 40%
- [ ] Zero false positives in academic integrity flagging

---

## How to Test Current Features

### Setup
1. Configure `.env` with Supabase credentials
2. Run `npm run db:migrate` to apply migrations
3. Start dev servers:
   - `npm run dev` (runs both client and server)

### Test Workflow
1. **Sign up** via `/login` (creates user with role `student` by default)
2. **Upgrade to staff** (manually update in DB):
   ```sql
   UPDATE users SET role = 'staff' WHERE email = 'your@email.com';
   ```
3. **Staff can:**
   - Create courses (Code, Name, Academic Year, Semester)
   - Create MCQ/written questions with tags
   - Filter questions by search, tags, type
   - Edit/delete questions
   - Create assignments (select questions at creation)
   - Publish assignments
   - View enrollments

4. **Students can:**
   - View enrolled courses (need manual enrollment via API or SQL)
   - Start assignments (creates draft submission)
   - Answer MCQ/written questions
   - Auto-save drafts (every 30s)
   - Submit assignments (cannot save after due date)

### Manual Enrollment Example
```bash
curl -X POST http://localhost:3000/api/courses/{courseId}/enroll \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid"}'
```

---

## File Structure

```
src/
├── client/
│   ├── lib/
│   │   ├── api.ts              # API client with token injection
│   │   └── route-guards.ts     # (placeholder for future server-side guards)
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Enhanced auth provider with roles
│   │   └── auth-context.ts     # Auth context types
│   ├── hooks/
│   │   └── useAuth.ts          # Auth hook
│   ├── components/
│   │   ├── Modal.tsx           # Reusable modal
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── UMLEditor.tsx       # (future)
│   │   ├── UMLViewer.tsx       # (future)
│   │   └── UserInfo.tsx        # User profile display
│   ├── features/
│   │   ├── staff-course/       # Staff course management
│   │   ├── staff-dashboard/    # Staff dashboard
│   │   ├── student-assignment/ # Student assignment attempt
│   │   ├── student-course/     # Student course detail
│   │   └── student-dashboard/  # Student dashboard
│   └── routes/
│       ├── __root.tsx          # Root layout with nav
│       ├── index.tsx           # Landing page with auto-redirect
│       ├── login.tsx           # Login page
│       ├── student.tsx         # Student dashboard route
│       ├── staff.tsx           # Staff dashboard route
│       ├── student/
│       │   ├── index.tsx
│       │   ├── assignments/$assignmentId.tsx
│       │   └── courses/$courseId.tsx
│       └── staff/
│           ├── index.tsx
│           └── courses/$courseId.tsx
├── server/
│   ├── lib/
│   │   └── supabase.ts         # Server Supabase client
│   ├── middleware/
│   │   └── auth.ts             # JWT validation & RBAC
│   ├── routes/
│   │   ├── auth.ts             # Auth endpoints
│   │   ├── courses.ts          # Course CRUD
│   │   ├── assignments.ts      # Assignment CRUD
│   │   ├── questions.ts        # Question CRUD with filters
│   │   ├── submissions.ts      # Submission lifecycle
│   │   └── tags.ts             # Tag endpoints
│   └── index.ts                # Hono app setup
├── db/
│   ├── schema.ts               # Drizzle schema (9 tables)
│   ├── index.ts                # DB connection
│   ├── migrate.ts              # Migration runner
│   └── migrations/
│       └── 0001_optimal_quasar.sql
└── lib/
    └── supabase.ts             # Client Supabase client
```

---

*This document consolidates NEXT_STEPS.md, IMPLEMENTATION_SUMMARY.md, DEVELOPMENT_PLAN.md, and PHASE2_IMPLEMENTATION.md into a single source of truth.*
