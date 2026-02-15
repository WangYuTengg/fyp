import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, answers, marks, questions, users } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { getSignedUrl } from '../../lib/storage.js';

const getSubmissionRoute = new Hono<AuthContext>();

// Get a single submission by ID with all details (answers, marks, user info)
getSubmissionRoute.get('/:submissionId', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  // Check authorization
  const isOwner = submission.userId === user.id;
  const isStaff = user.role === 'admin' || user.role === 'staff';

  if (!isOwner && !isStaff) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Load answers with question details
  const submissionAnswers = await db
    .select({
      id: answers.id,
      submissionId: answers.submissionId,
      questionId: answers.questionId,
      content: answers.content,
      fileUrl: answers.fileUrl,
      createdAt: answers.createdAt,
      updatedAt: answers.updatedAt,
      question: {
        id: questions.id,
        title: questions.title,
        type: questions.type,
        content: questions.content,
        points: questions.points,
      },
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(answers.submissionId, submissionId));

  // Generate signed URLs for file paths
  const answersWithSignedUrls = await Promise.all(
    submissionAnswers.map(async (answer) => {
      if (answer.fileUrl) {
        try {
          const signedUrl = await getSignedUrl(answer.fileUrl);
          return { ...answer, fileUrl: signedUrl };
        } catch (err) {
          console.error('Error generating signed URL:', err);
          // If signed URL generation fails, keep the path
          return answer;
        }
      }
      return answer;
    })
  );

  // If a student is viewing their own submission, do not leak model answers / keys via question.content.
  const sanitizedAnswers = !isStaff
    ? answersWithSignedUrls.map((answer) => {
        const q = answer.question;
        const content = (q?.content ?? {}) as any;

        if (!q) return answer;

        if (q.type === 'written' || q.type === 'uml') {
          const rest = { ...content };
          delete rest.modelAnswer;
          return { ...answer, question: { ...q, content: rest } };
        }

        if (q.type === 'mcq') {
          const options = Array.isArray(content.options) ? content.options : [];
          const safeOptions = options.map((opt: any) => ({
            id: opt.id,
            text: opt.text,
          }));

          return {
            ...answer,
            question: {
              ...q,
              content: {
                ...content,
                options: safeOptions,
                showCorrectAnswers: false,
              },
            },
          };
        }

        return answer;
      })
    : answersWithSignedUrls;

  // Load marks
  const submissionMarks = await db
    .select()
    .from(marks)
    .where(eq(marks.submissionId, submissionId));

  // Load user info if staff is viewing
  let userInfo = null;
  if (isStaff) {
    const [submitter] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.name,
      })
      .from(users)
      .where(eq(users.id, submission.userId))
      .limit(1);
    userInfo = submitter;
  }

  return c.json({
    ...submission,
    answers: sanitizedAnswers,
    marks: submissionMarks,
    user: userInfo,
  });
});

export default getSubmissionRoute;
