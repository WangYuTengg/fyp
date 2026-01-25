# UML Assessment Platform - Implementation Plan

## Project Overview
**Objective**: Build an automated assessment platform for UML diagrams with support for multiple assessment modes. Current implementation focuses on MCQ and written; UML is planned for later phases.

**Key Differentiator**: LLM-assisted UML diagram grading with human-in-the-loop oversight and audit trails.

---

## Implementation Phases

### ✅ Phase 0: Foundation (COMPLETED)
**Duration**: Week 1-2  
**Status**: ✅ Complete

- [x] Project scaffolding (Vite + React + TypeScript + Hono)
- [x] Supabase authentication setup
- [x] Drizzle ORM configuration
- [x] Docker setup
- [x] Basic routing with TanStack Router

---

### ✅ Phase 1: Core Learning Loop (COMPLETED)
**Duration**: Week 3-4  
**Status**: ✅ Complete (January 25, 2026)

#### Database Schema ✅
- [x] Users table with role enum (admin, staff, student)
- [x] Courses table (code, name, academic year, semester)
- [x] Enrollments table (course-scoped roles: lecturer, TA, lab_exec, student)
- [x] Assignments table (type: MCQ, written, coding, UML) (current UI supports MCQ and written)
- [x] Questions table (reusable question pool with rubrics)
- [x] Submissions table (attempt tracking, status lifecycle)
- [x] Answers table (file URL field for UML uploads in future)
- [x] Marks table (manual + AI-assisted grading flags)

#### Server APIs ✅
- [x] Auth middleware (JWT validation, auto-sync to local DB)
- [x] Course CRUD endpoints (with enrollment-based filtering)
- [x] Assignment CRUD (create, publish/unpublish)
- [x] Submission lifecycle (start, save answers, submit, grade)
- [x] Role-based access control

#### Client Dashboards ✅
- [x] Enhanced AuthContext with DB roles
- [x] Student dashboard (enrolled courses, assignments)
- [x] Staff dashboard (course management, assignment creation)
- [x] Auto-redirect based on role
- [x] API client utility with token injection

**Deliverables**:
- ✅ Students can view courses and assignments
- ✅ Students can start/submit assignments (basic workflow)
- ✅ Staff can create courses and assignments
- ✅ Staff can publish assignments
- ✅ Basic manual grading endpoint

---

### 🔲 Phase 2: Question Pools & Assignment Builder
**Duration**: Week 5-6  
**Status**: 🟡 In Progress

#### Question Management UI
- [x] Create questions (MCQ + written)
- [ ] Edit/delete questions
- [x] Question type-specific editors:
   - [x] MCQ: options (single-choice)
   - [x] Written: prompt entry
   - [ ] UML: reference diagram, PlantUML DSL (deferred)
- [ ] Tag manager component (CRUD tags for the course)
- [ ] Chip-based tag input on question create/edit
- [ ] Search and filter question pool:
   - [ ] Text search (title + prompt)
   - [ ] Tags multi-select filter (existing tags only)
   - [ ] Question type multi-select filter (default: all types)

#### Assignment Builder
- [x] Add questions to assignment at creation (MCQ/written only)
- [ ] Add/remove questions after creation
- [ ] Drag-drop question ordering
- [ ] Override points per question
- [ ] Preview assignment as student would see it

#### Attempt Enforcement
- [ ] Timer countdown UI (client-side)
- [ ] Server-side validation of time limits
- [x] Max attempts enforcement
- [x] Strict due date cutoff for draft saves (MCQ/written)

#### Auto-Save & Draft Management
- [x] Periodic auto-save of draft answers (every 30s, silent)
- [ ] Resume draft on re-entry
- [ ] Submission confirmation dialog

**Deliverables**:
- Students can take MCQ/written assignments with strict due dates
- Staff can build assignments from the question pool (MCQ/written)
- Silent auto-save for drafts

---

### 🔲 Phase 3: UML Submission & File Handling
**Duration**: Week 7-8  
**Status**: 🔲 Not Started

#### File Upload Infrastructure
- [ ] Integrate Supabase Storage (or self-hosted MinIO for on-prem)
- [ ] Upload API endpoint with validation
- [ ] File type restrictions (.png, .jpg, .puml, .svg)
- [ ] Size limits (e.g., 5MB per file)
- [ ] Secure signed URLs for file access

#### UML Diagram Viewer
- [ ] Image preview (PNG/JPG)
- [ ] PlantUML/Mermaid renderer (if textual format submitted)
- [ ] Side-by-side view (student submission vs. reference)

#### Submission Versioning
- [ ] Track file versions (if student re-uploads)
- [ ] Diff view for textual UML (PlantUML DSL)
- [ ] Submission history timeline

#### Basic Validation
- [ ] Due date enforcement (hard deadline vs. late penalty)
- [ ] File type validation
- [ ] Completeness check (all required files uploaded)

**Deliverables**:
- Students can upload UML diagrams
- Staff can view submissions with diagrams
- Version history available

---

### 🔲 Phase 4: LLM-Assisted UML Grading (Stretch Goal)
**Duration**: Week 9-12  
**Status**: 🔲 Not Started

#### Rubric Builder
- [ ] Define grading criteria (e.g., "Correct class relationships: 20 pts")
- [ ] Map criteria to LLM evaluation prompts
- [ ] Weight rubric items

#### UML Conversion Pipeline
- [ ] Image → PlantUML converter (OCR + vision model)
- [ ] PlantUML → structured data (classes, relationships)
- [ ] UML → skeleton code generator (optional approach)

#### LLM Integration
- [ ] LLM prompt templates for grading
- [ ] API integration (OpenAI, Anthropic, or self-hosted LLM)
- [ ] Structured output parsing (scores + feedback per rubric item)
- [ ] Confidence scoring (flag low-confidence suggestions)

#### Human-in-the-Loop Workflow
- [ ] "AI Suggestions" panel in grading interface
- [ ] Accept/reject/modify suggestions
- [ ] Override mechanism with audit log
- [ ] Bulk accept for high-confidence suggestions

#### Queue System (NFR)
- [ ] Background job queue (BullMQ or similar)
- [ ] Concurrent worker pool (configurable: e.g., 4 workers)
- [ ] Progress tracking UI for staff
- [ ] Retry logic for failed grading jobs

#### Audit & Provenance
- [ ] Log all AI-generated suggestions
- [ ] Track human modifications
- [ ] Export grading reports with AI involvement flagged

**Deliverables**:
- LLM can suggest grades for UML submissions
- Staff can review and override suggestions
- System documents AI usage for academic integrity

---

## Functional Requirements Summary

### User Roles
| Role | Permissions |
|------|-------------|
| **Student** | View enrolled courses, take assignments, submit answers, view grades |
| **TA** | All student permissions + grade assigned sections |
| **Lab Executive** | All student permissions + manage lab resources |
| **Lecturer** | Create courses, create assignments, manage enrollments, grade all submissions |
| **Platform Admin** | Manage users, global settings, view analytics |
| **Super Admin** | All permissions + system configuration |

### Core Features
1. **Course Management**
   - Create/edit courses
   - Enroll users with course-specific roles
   - Archive courses

2. **Assignment Creation**
   - Support MCQ and Written (UML planned; coding deferred)
   - Question pools for reuse
   - Timed attempts, max attempts, due dates
   - Publish/unpublish workflow

3. **Student Workflow**
   - View assignments
   - Start attempt (creates draft submission)
   - Save answers (auto-save + manual save)
   - Submit finalized answers
   - View feedback and grades

4. **Grading Workflow**
   - Manual marking interface
   - AI-assisted suggestions (UML mode)
   - Rubric-based grading
   - Feedback comments
   - Grade release to students

---

## Non-Functional Requirements (NFRs)

### Performance
- **Concurrent Users**: Support 200+ concurrent logins
- **Submission Handling**: Process 50 simultaneous submissions without degradation
- **LLM Grading**: Queue-based processing, max 4 concurrent gradings (configurable)
- **Response Time**: API calls < 500ms (95th percentile), excluding LLM grading

### Scalability (On-Prem Deployment)
**Recommended Infrastructure**:
- **App Server**: 4 vCPUs, 8GB RAM (handles API + static serving)
- **Database**: PostgreSQL with 4GB RAM, SSD storage
- **LLM Workers**: 2-4 workers × 2GB RAM each (CPU or GPU depending on model)
- **Storage**: 100GB initial (scales with submissions)

**Scaling Strategies**:
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

## Technical Architecture

### Tech Stack (Confirmed)
- **Frontend**: Vite + React + TypeScript + TanStack Router
- **Backend**: Hono (Node.js)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **Deployment**: Docker + Docker Compose
- **LLM** (Phase 4): OpenAI API or self-hosted (Llama, Mistral)

### Deployment Architecture (On-Prem)
```
┌─────────────────┐
│   Load Balancer │ (Optional)
└────────┬────────┘
         │
    ┌────▼─────┐
    │  Nginx   │ (Reverse proxy, HTTPS termination)
    └────┬─────┘
         │
    ┌────▼─────────────────┐
    │  App Container       │ (Hono API + Vite static files)
    │  - API endpoints     │
    │  - Static serving    │
    └────┬─────────────────┘
         │
    ┌────▼──────────┐
    │  PostgreSQL   │ (Managed or containerized)
    └───────────────┘

    ┌────────────────┐
    │  Supabase Auth │ (Self-hosted or managed)
    └────────────────┘

    ┌────────────────┐
    │  LLM Workers   │ (Phase 4, queue-based)
    │  - BullMQ      │
    │  - Redis       │
    └────────────────┘
```

---

## UML Grading Approaches (Phase 4)

### Approach 1: Textual DSL (PlantUML/Mermaid) → LLM
**Pros**: LLMs excel at text reasoning, precise comparison  
**Cons**: Requires students to use DSL or conversion step  
**Implementation**:
1. Students upload `.puml` files or images converted to PlantUML
2. LLM compares student DSL vs. reference DSL
3. Rubric: missing classes, incorrect relationships, visibility errors

**Example Prompt**:
```
You are grading a UML class diagram. Reference:
[PlantUML code here]

Student submission:
[Student's PlantUML code]

Rubric:
- Correct classes (10 pts)
- Correct associations (10 pts)
- Correct multiplicities (5 pts)

Grade and provide feedback.
```

---

### Approach 2: LLM as Code Reviewer
**Pros**: Leverage LLM strength in code comparison  
**Cons**: Adds UML → code generation step  
**Implementation**:
1. Convert UML diagrams to skeleton code (many tools support this)
2. Feed student code + reference code to LLM
3. Ask LLM to compare structure, relationships

---

### Approach 3: Narrative Descriptions
**Pros**: Very interpretable, works with vision models  
**Cons**: Risk of losing precision  
**Implementation**:
1. Convert UML to natural language ("The system has 3 classes: User, Account, Transaction...")
2. Feed both descriptions to LLM
3. LLM grades based on conceptual alignment

---

### Recommended: Hybrid Approach
1. **Tier 1**: Simple structural checks (automated, no LLM)
   - Class count, naming conventions
2. **Tier 2**: LLM-assisted semantic checks
   - Relationship correctness, design pattern usage
3. **Tier 3**: Human review
   - Creative solutions, edge cases

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| LLM unreliable | Human override mandatory, confidence thresholds |
| On-prem compute limited | Queue system, prioritize grading, async processing |
| Student gaming AI | Randomize rubrics, manual spot-checks |
| Data privacy concerns | Self-host LLM or use private APIs, no data retention |
| Scalability bottleneck | Profile early, document resource requirements clearly |

---

## Success Metrics

### Phase 1 (Core Loop)
- [ ] 100% of students can submit assignments
- [ ] 100% of staff can create and publish assignments
- [ ] < 2% error rate on submissions

### Phase 2 (Question Pools)
- [ ] 80% of assignments use question pool (vs. one-off questions)
- [ ] Average assignment creation time < 15 minutes

### Phase 3 (UML Submissions)
- [ ] 100% of UML assignments support file upload
- [ ] File upload success rate > 98%

### Phase 4 (AI Grading)
- [ ] AI suggestions available for 90% of UML submissions
- [ ] Staff accept 60%+ of AI suggestions (indicates trust)
- [ ] Grading time reduced by 30% vs. fully manual

---

## Timeline (12-Week FYP)

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1-2 | Phase 0 | Project scaffold, auth working |
| 3-4 | Phase 1 | Core CRUD, dashboards, basic submission flow |
| 5-6 | Phase 2 | Question pools, timed attempts, auto-save |
| 7-8 | Phase 3 | File upload, UML viewer, versioning |
| 9-10 | Phase 4a | LLM integration, rubric builder, AI suggestions |
| 11 | Phase 4b | Queue system, audit logs |
| 12 | Testing & Documentation | Load testing, user guide, deployment docs |

---

## Documentation Deliverables

1. **User Guide** (Students, Staff, Admins)
2. **API Documentation** (OpenAPI/Swagger)
3. **Deployment Guide** (Docker Compose, on-prem setup)
4. **NFR Report** (Load test results, resource estimates)
5. **FYP Report** (Introduction, methodology, results, conclusion)

---

## References

### Similar Platforms
- GitLab for Education (coding assignments)
- Google Classroom (general assignment management)
- Gradescope (auto-grading with AI)
- LeetCode/HackerRank (technical assessments)

### Academic Papers
- "Automated Grading of UML Diagrams: A Survey" (to research)
- "LLM-Assisted Code Review" (transfer learning to UML)

### Tools
- PlantUML (text → diagram)
- Mermaid (alternative DSL)
- Drizzle ORM (type-safe SQL)
- BullMQ (job queue)

---

*Plan Version: 1.0*  
*Last Updated: January 25, 2026*
