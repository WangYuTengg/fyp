import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, answers, assignments, assignmentQuestions, fileUploads } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';
import { uploadFile, validateFile } from '../../lib/storage.js';

const uploadFileRoute = new Hono<AuthContext>();

// Upload file for UML question answer
uploadFileRoute.post('/:submissionId/upload', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  // Verify ownership
  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  if (submission.userId !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (submission.status !== 'draft') {
    return c.json({ error: 'Cannot upload files to submitted assignment' }, 400);
  }

  // Get form data
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const questionId = formData.get('questionId') as string | null;

  if (!file || !questionId) {
    return c.json({ error: 'File and questionId required' }, 400);
  }

  // Validate file
  const validation = validateFile({
    size: file.size,
    type: file.type,
    name: file.name,
  });

  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  try {
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to storage
    const uploadResult = await uploadFile(
      user.id,
      submissionId,
      questionId,
      buffer,
      file.name
    );

    // Update or create answer with file URL
    const [existingAnswer] = await db
      .select()
      .from(answers)
      .where(
        and(
          eq(answers.submissionId, submissionId),
          eq(answers.questionId, questionId)
        )
      )
      .limit(1);

    // Validate that questionId belongs to this assignment
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, submission.assignmentId))
      .limit(1);

    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404);
    }

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

    if (existingAnswer) {
      // Update existing answer with file path
      const [updated] = await db
        .update(answers)
        .set({
          fileUrl: uploadResult.path,
          updatedAt: new Date(),
        })
        .where(eq(answers.id, existingAnswer.id))
        .returning();

      // Record in file upload history
      await db.insert(fileUploads).values({
        answerId: updated.id,
        fileUrl: uploadResult.path,
        filePath: uploadResult.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      return c.json({
        answer: { ...updated, fileUrl: uploadResult.signedUrl },
        fileUrl: uploadResult.signedUrl,
        filePath: uploadResult.path,
      });
    }

    // Create new answer with file path
    const [newAnswer] = await db
      .insert(answers)
      .values({
        submissionId,
        questionId,
        content: { umlText: '' }, // Placeholder for UML questions
        fileUrl: uploadResult.path,
      })
      .returning();

    // Record in file upload history
    await db.insert(fileUploads).values({
      answerId: newAnswer.id,
      fileUrl: uploadResult.path,
      filePath: uploadResult.path,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    });

    return c.json({
      answer: { ...newAnswer, fileUrl: uploadResult.signedUrl },
      fileUrl: uploadResult.signedUrl,
      filePath: uploadResult.path,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Upload failed: ${message}` }, 500);
  }
});

export default uploadFileRoute;
