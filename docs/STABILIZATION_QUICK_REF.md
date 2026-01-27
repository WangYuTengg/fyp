# Quick Reference: Stabilization Changes

## New Status: `late`

### Server
```typescript
// Enum updated in schema.ts
export const submissionStatusEnum = pgEnum('submission_status', 
  ['draft', 'submitted', 'late', 'grading', 'graded']
);

// Submission logic in submissions.ts
let status: 'submitted' | 'late' = 'submitted';

// Check time limit
if (assignment?.timeLimit) {
  const startTime = new Date(submission.startedAt).getTime();
  const endTime = startTime + assignment.timeLimit * 60 * 1000;
  if (now.getTime() > endTime) {
    status = 'late';
  }
}

// Check due date
if (assignment?.dueDate && now > assignment.dueDate) {
  status = 'late';
}
```

### Client
```typescript
// Type definition
type SubmissionStatus = 'draft' | 'submitted' | 'late' | 'grading' | 'graded';

// UI badge
{status === 'late' && (
  <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
    Late
  </span>
)}

// Status color mapping
case 'late':
  return 'bg-orange-100 text-orange-800';
```

## Signed URLs

### Storage Helper
```typescript
// Returns signed URL valid for 1 hour
export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 3600);
  
  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}
```

### Upload Flow
```typescript
// Server: Store path, return signed URL
const uploadResult = await uploadFile(userId, submissionId, questionId, buffer, fileName);
// uploadResult = { path: string, signedUrl: string }

await db.update(answers)
  .set({ fileUrl: uploadResult.path })  // Store path only
  .where(eq(answers.id, answerId));

return c.json({
  answer: { ...answer, fileUrl: uploadResult.signedUrl },  // Return signed URL
});
```

### Read Flow
```typescript
// Server: Generate signed URLs on read
const answersWithSignedUrls = await Promise.all(
  submissionAnswers.map(async (answer) => {
    if (answer.fileUrl) {
      const signedUrl = await getSignedUrl(answer.fileUrl);
      return { ...answer, fileUrl: signedUrl };
    }
    return answer;
  })
);
```

## Validation

### Question Belongs to Assignment
```typescript
// Check in save answer and upload endpoints
const [assignmentQuestion] = await db
  .select()
  .from(assignmentQuestions)
  .where(
    and(
      eq(assignmentQuestions.assignmentId, submission.assignmentId),
      eq(assignmentQuestions.questionId, questionId)
    )
  )
  .limit(1);

if (!assignmentQuestion) {
  return c.json({ error: 'Question does not belong to this assignment' }, 400);
}
```

### Open Date Check
```typescript
// Check when starting submission
if (assignment.openDate && new Date() < assignment.openDate) {
  return c.json({ error: 'Assignment not yet open' }, 403);
}
```

## Duplicate Prevention

### Mark Upsert
```typescript
// Check for existing mark before inserting
const [existingMark] = await db
  .select()
  .from(marks)
  .where(
    and(
      eq(marks.submissionId, submissionId),
      eq(marks.answerId, answerId)
    )
  )
  .limit(1);

if (existingMark) {
  // Update instead of insert
  const [updated] = await db
    .update(marks)
    .set({ points, maxPoints, feedback, markedBy: user.id })
    .where(eq(marks.id, existingMark.id))
    .returning();
  
  return c.json(updated);
}
```

## File Upload Refresh

### Hook Pattern
```typescript
// Add refresh function to useAssignmentData
const refreshSubmission = async () => {
  if (!user || !assignment) return;
  const submissionData = await submissionsApi.start(assignmentId);
  setSubmission(submissionData as Submission);
};

return { ...otherData, refreshSubmission };
```

### Usage
```typescript
const handleFileUpload = async (questionId: string, file: File) => {
  await submissionsApi.uploadFile(submission.id, questionId, file);
  await refreshSubmission();  // Refresh to get new signed URL
};
```

## Migration & Backfill

### Apply Migration
```bash
npm run db:migrate
```

### Run Backfill (Production)
```bash
npx tsx scripts/backfill-file-paths.ts
```

### Manual SQL (if needed)
```sql
-- Add late status
ALTER TYPE "public"."submission_status" ADD VALUE 'late' BEFORE 'grading';

-- Convert URLs to paths (example)
UPDATE answers 
SET file_url = regexp_replace(
  file_url, 
  '.*/storage/v1/object/public/submissions/', 
  ''
)
WHERE file_url LIKE '%/storage/v1/object/public/submissions/%';
```

## Testing Checklist

- [ ] Submit assignment before due date → status = 'submitted'
- [ ] Submit assignment after due date → status = 'late'
- [ ] Save answer after due date → succeeds (no error)
- [ ] Submit with time limit exceeded → status = 'late'
- [ ] Upload file → see signed URL (contains `?token=`)
- [ ] Upload file → UI updates immediately
- [ ] Save answer for wrong question → 400 error
- [ ] Start assignment before open date → 403 error
- [ ] Grade same answer twice → updates existing mark
- [ ] View file history → all uploads shown with signed URLs
- [ ] Late badge shows orange in student view
- [ ] Late badge shows orange in staff view
