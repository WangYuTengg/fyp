import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { fileUploads, answers, submissions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, desc } from 'drizzle-orm';
import { getSignedUrl } from '../../lib/storage.js';

const fileHistoryRoute = new Hono<AuthContext>();

// Get file upload history for an answer
fileHistoryRoute.get('/answer/:answerId/file-history', requireAuth, async (c) => {
  const answerId = c.req.param('answerId');
  const user = c.get('user')!;

  // Get answer to verify ownership
  const [answer] = await db
    .select({
      id: answers.id,
      submission: {
        id: submissions.id,
        userId: submissions.userId,
      },
    })
    .from(answers)
    .innerJoin(submissions, eq(answers.submissionId, submissions.id))
    .where(eq(answers.id, answerId))
    .limit(1);

  if (!answer) {
    return c.json({ error: 'Answer not found' }, 404);
  }

  const isOwner = answer.submission.userId === user.id;
  const isStaff = user.role === 'admin' || user.role === 'staff';

  if (!isOwner && !isStaff) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Get upload history
  const history = await db
    .select()
    .from(fileUploads)
    .where(eq(fileUploads.answerId, answerId))
    .orderBy(desc(fileUploads.uploadedAt));

  // Generate signed URLs for file paths
  const historyWithSignedUrls = await Promise.all(
    history.map(async (upload) => {
      try {
        const signedUrl = await getSignedUrl(upload.filePath);
        return { ...upload, fileUrl: signedUrl };
      } catch {
        // If signed URL generation fails, keep the path
        return upload;
      }
    })
  );

  return c.json(historyWithSignedUrls);
});

export default fileHistoryRoute;
