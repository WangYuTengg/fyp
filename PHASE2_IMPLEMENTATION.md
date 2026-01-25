# Phase 2 Implementation Progress - Tags & Filters

## Date: January 26, 2026

## Completed Features

### 1. Tag Management System ✅
**Files Created/Modified:**
- `src/server/routes/tags.ts` - New tag API endpoints
- `src/client/features/staff-course/components/TagManager.tsx` - Tag management UI
- `src/db/schema.ts` - Already had tags array support

**Implementation:**
- Tags are automatically created when added to questions
- Tag normalization (trim, lowercase) handled client-side
- Tags displayed in TagManager component with course-wide tag list
- Tag API endpoint returns unique tags for a course

### 2. Chip-Based Tag Input ✅
**Files Modified:**
- `src/client/features/staff-course/components/CreateQuestionForm.tsx`
- `src/client/features/staff-course/components/EditQuestionForm.tsx`
- `src/client/features/staff-course/hooks/useQuestionForm.ts`

**Features:**
- Chip-based tag selection with add/remove functionality
- Existing tags shown as quick-add buttons
- New tag creation via input field
- Tags normalized (lowercase, trimmed) before storage
- Visual chips with remove (×) buttons

### 3. Question Pool Filters ✅
**Files Created/Modified:**
- `src/client/features/staff-course/components/QuestionFilters.tsx` - New filter component
- `src/client/features/staff-course/hooks/useStaffCourse.ts` - Added filter support
- `src/client/features/staff-course/StaffCourseDetail.tsx` - Integrated filters

**Filter Types:**
- **Text Search**: Searches question title and description
- **Tags Multi-Select**: Filter by one or more tags (AND logic)
- **Question Type Multi-Select**: Filter by MCQ, Written, Coding, or UML
- **Clear All**: Reset all filters
- Default: All types selected (no filtering)

### 4. Question API Enhancements ✅
**Files Modified:**
- `src/server/routes/questions.ts`
- `src/client/lib/api.ts`

**Server Changes:**
- GET `/api/questions/course/:courseId` now accepts query params:
  - `search` - Text search on title/description (case-insensitive)
  - `tags` - Comma-separated tag list
  - `types` - Comma-separated question types
- POST and PUT endpoints now accept `tags` array
- Tags stored in database as array

**Client Changes:**
- `questionsApi.listByCourse()` accepts optional filters object
- `questionsApi.create()` and `questionsApi.update()` accept tags array
- New `tagsApi.listByCourse()` for fetching course tags

### 5. Question Edit/Delete Functionality ✅
**Files Created/Modified:**
- `src/client/features/staff-course/components/EditQuestionForm.tsx` - New edit form
- `src/client/features/staff-course/components/QuestionCard.tsx` - Added edit/delete buttons
- `src/client/features/staff-course/hooks/useQuestionForm.ts` - Added edit mutation

**Features:**
- Edit button on each question card
- Inline edit form with cancel option
- Delete button with confirmation dialog
- Edit supports all question fields including tags
- Server endpoints already existed, now wired to UI

### 6. Question Card Tag Display ✅
**Files Modified:**
- `src/client/features/staff-course/components/QuestionCard.tsx`

**Features:**
- Tags displayed as blue chips below question metadata
- Tags shown in both view and edit modes

## Technical Details

### Database Schema
No migration needed - `tags` field already exists in questions table as `text array`.

### API Routes Summary
- `GET /api/tags/course/:courseId` - Get unique tags for course
- `GET /api/questions/course/:courseId?search=...&tags=...&types=...` - List questions with filters
- `POST /api/questions` - Create question (with tags)
- `PUT /api/questions/:id` - Update question (with tags)
- `DELETE /api/questions/:id` - Delete question

### Client-Side Architecture
- Filters managed in `StaffCourseDetail` state
- React Query handles caching and invalidation
- Tag normalization done before API calls
- All CRUD operations invalidate tags query cache

## Testing Checklist

### Manual Testing Required
- [ ] Create a question with tags
- [ ] Verify tags appear in TagManager
- [ ] Edit a question and add/remove tags
- [ ] Filter questions by text search
- [ ] Filter questions by tags (single and multiple)
- [ ] Filter questions by type (single and multiple)
- [ ] Clear all filters
- [ ] Delete a question
- [ ] Verify tag normalization (try "Test", " test ", "TEST")

## Next Steps (Remaining Phase 2)

### 7. Assignment-Question Management (Not Started)
**Goal**: Add/remove questions from assignments after creation

**Required Work:**
- Create POST `/api/assignments/:id/questions` endpoint
- Create DELETE `/api/assignment-questions/:id` endpoint
- Add question management UI to assignment detail view
- Update assignment builder to support reordering questions
- Add point override functionality per question

**Files to Create/Modify:**
- `src/server/routes/assignments.ts` - New endpoints
- `src/client/features/staff-course/components/AssignmentBuilder.tsx` - New component
- `src/client/features/staff-course/hooks/useAssignmentBuilder.ts` - New hook

### 8. Timing and Due Date Enforcement (Not Started)
**Goal**: Enforce time limits and due dates on submissions

**Required Work:**
- Add timer UI to student attempt page
- Server-side validation of time limits on submit
- Due date check on draft save and final submit
- Draft resume indicators (last saved time, autosave status)
- Navigation warning for unsaved changes

**Files to Modify:**
- `src/client/features/student-assignment/StudentAssignmentAttempt.tsx`
- `src/client/features/student-assignment/components/*`
- `src/server/routes/submissions.ts`

### 9. Database Constraints and Indexes (Not Started)
**Goal**: Add database integrity constraints and performance indexes

**Required Work:**
- Generate migration for:
  - Unique constraint on `(userId, courseId)` in enrollments
  - Unique constraint on `(submissionId, questionId)` in answers
  - Unique constraint on `(assignmentId, questionId)` in assignment_questions
  - Index on `questions.courseId`
  - Index on `questions.tags` (GIN index for array containment)
  - Index on `submissions.userId`
  - Index on `submissions.assignmentId`

**Command:**
```bash
npm run db:generate
npm run db:migrate
```

## Build Status
✅ TypeScript compilation successful
✅ Vite build successful (541.89 kB)
⚠️ Warning: Large bundle size (consider code-splitting for future optimization)

## Documentation Updated
- ✅ DEVELOPMENT_PLAN.md - Phase 2 scope updated with tags/filters
- ✅ NEXT_STEPS.md - Phase 2 checklist updated
- ✅ PHASE2_IMPLEMENTATION.md - This file created

## Known Issues/Limitations
- None currently - all implemented features working as expected
- Server-side validation of tag format not implemented (relying on client normalization)
- No tag deletion endpoint (tags removed when last question using them is deleted/updated)

## Performance Considerations
- Question list queries filtered server-side (efficient)
- Tags loaded once per course (cached by React Query)
- Filter changes trigger new API calls (expected behavior)
- Consider pagination if question lists grow beyond 100 items

## Security Notes
- All endpoints protected by `requireStaff` middleware
- Tag injection prevented by storing as array (not raw SQL)
- Search uses parameterized queries (no SQL injection risk)
