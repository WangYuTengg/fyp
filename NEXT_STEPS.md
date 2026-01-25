# Implementation Checklist & Next Steps

## ✅ Completed (Phase 0-1)

### Infrastructure
- [x] Vite + React + TypeScript scaffolding
- [x] Hono server setup
- [x] Supabase authentication
- [x] Drizzle ORM configuration
- [x] Docker setup
- [x] TanStack Router
- [x] Tailwind CSS

### Database
- [x] Users table with roles
- [x] Courses table
- [x] Enrollments table (course-scoped roles)
- [x] Assignments table (4 types: MCQ, written, coding, UML)
- [x] Questions table (question pool)
- [x] Submissions table (attempt tracking)
- [x] Answers table (with file URL support)
- [x] Marks table (manual + AI-assisted flags)
- [x] All relations defined
- [x] Migration generated

### Server APIs
- [x] Auth middleware (JWT validation)
- [x] Auto-sync Supabase users to local DB
- [x] Role-based access control (RBAC)
- [x] `/api/auth/me` endpoint
- [x] Course CRUD endpoints
- [x] Assignment CRUD endpoints
- [x] Submission lifecycle endpoints
- [x] Enrollment management

### Client
- [x] Enhanced AuthContext with DB roles
- [x] API client utility with token injection
- [x] Student dashboard
- [x] Staff dashboard
- [x] Student course detail page
- [x] Staff course management page
- [x] Role-based navigation
- [x] Auto-redirect by role

### Documentation
- [x] Implementation summary
- [x] Development plan with phases
- [x] Quick start guide
- [x] Updated README

---

## 🔲 Phase 2: Question Pools & Simple Assignments (Week 5-6)

### Question Management
- [ ] Create question form UI
  - [ ] MCQ editor (options, correct answers)
  - [ ] Written question editor (rubric, sample answers)
  - [ ] Coding question editor (test cases, starter code)
  - [ ] UML question editor (reference diagram upload)
- [ ] Edit/delete questions
- [ ] Question list/search page (staff only)
- [ ] Tag/categorize questions
- [ ] Filter by type, tags, course

### Assignment Builder
- [ ] "Add Questions" UI for assignments
- [ ] Drag-drop question ordering
- [ ] Override points per question
- [ ] Preview assignment as student
- [ ] Bulk import questions from pool

### Student Attempt Flow (No Timer)
- [ ] Student assignment attempt page (view questions, type answers)
- [ ] Save answers endpoint integration (manual save)
- [ ] Submit assignment (finalize)

### Auto-Save
- [ ] Periodic auto-save (every 30 seconds)
- [ ] Resume draft on page reload
- [ ] Draft indicator UI
- [ ] Unsaved changes warning on navigation

### API Updates
- [ ] `POST /api/questions` - Create question
- [ ] `GET /api/questions/course/:courseId` - List questions
- [ ] `PUT /api/questions/:id` - Update question
- [ ] `DELETE /api/questions/:id` - Delete question
- [ ] `POST /api/assignments/:id/questions` - Add question to assignment
- [ ] `DELETE /api/assignment-questions/:id` - Remove question from assignment

---

## 🔲 Deferred / Tech Debt

### Database Integrity
- [ ] Add unique constraints + indexes (enrollments, answers, assignment_questions) and generate a migration

---

## 🔲 Phase 3: UML File Upload & Viewing (Week 7-8)

### File Upload
- [ ] Integrate Supabase Storage (or MinIO for on-prem)
- [ ] `POST /api/submissions/:id/upload` endpoint
- [ ] File type validation (PNG, JPG, SVG, PUML)
- [ ] File size limits (5MB)
- [ ] Generate signed URLs for secure access
- [ ] Multiple file uploads per submission (versioning)

### UML Viewer
- [ ] Image preview component (PNG/JPG/SVG)
- [ ] PlantUML renderer (if textual format)
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

## 🔲 Phase 4a: LLM Integration (Week 9-10)

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

### API Updates
- [ ] `POST /api/submissions/:id/ai-grade` - Trigger AI grading
- [ ] `GET /api/submissions/:id/ai-suggestions` - Fetch suggestions
- [ ] `POST /api/marks/:id/accept-ai` - Accept AI suggestion
- [ ] Update marks table to log AI usage

---

## 🔲 Phase 4b: Queue System & Audit (Week 11)

### Background Job Queue
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

## 🔲 Future Enhancements (Post-FYP)

### Advanced Features
- [ ] Peer review system
- [ ] Plagiarism detection (compare UML diagrams)
- [ ] Analytics dashboard (assignment stats, grade distributions)
- [ ] Email notifications (assignment published, graded)
- [ ] Calendar integration (due dates)
- [ ] Mobile app (React Native)

### LLM Improvements
- [ ] Multi-model comparison (GPT vs. Claude vs. Llama)
- [ ] Fine-tuned model for UML grading
- [ ] Active learning (feedback loop to improve prompts)
- [ ] Explainable AI (highlight diagram issues visually)

### Scalability
- [ ] Read replicas for database
- [ ] CDN for static assets
- [ ] Horizontal scaling (multiple app servers)
- [ ] Kubernetes deployment

---

## Priority Order (Next Immediate Tasks)

1. **Question Management UI** (2 days)
   - Create question form
   - List questions page
   - Add questions to assignments

2. **Timed Attempts** (1 day)
   - Timer component
   - Server-side validation

3. **Auto-Save** (1 day)
   - Periodic save logic
   - Draft recovery

4. **File Upload** (2 days)
   - Supabase Storage integration
   - Upload API
   - Preview component

5. **UML Viewer** (1 day)
   - Image preview
   - Side-by-side view

6. **Rubric Builder** (2 days)
   - Rubric form
   - Save to assignment

7. **LLM Integration** (3-4 days)
   - Prompt templates
   - API integration
   - Suggestions UI

8. **Queue System** (2-3 days)
   - BullMQ setup
   - Worker pool
   - Progress tracking

---

## Testing Checklist (Before Each Phase)

- [ ] All TypeScript errors resolved (`npm run build`)
- [ ] API endpoints tested with cURL/Postman
- [ ] UI manually tested (happy path + edge cases)
- [ ] Database migrations applied
- [ ] Documentation updated
- [ ] Code reviewed (self or peer)

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

*Last Updated: January 25, 2026*
