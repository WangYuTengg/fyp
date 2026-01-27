import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { submissions, assignments, answers, marks, enrollments, fileUploads, questions, users, assignmentQuestions } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { eq, and, desc, count } from 'drizzle-orm';
import { uploadFile, validateFile, getSignedUrl } from '../lib/storage.js';
import { startSubmissionSchema, saveAnswerSchema, bulkGradeSchema } from '../lib/validation-schemas.js';
import { errorResponse, ErrorCodes } from '../lib/errors.js';

const app = new Hono<AuthContext>();

// Get submissions for an assignment (students see only theirs, staff see all)
app.get('/assignment/:assignmentId', requireAuth, async (c) => {
  const assignmentId = c.req.param('assignmentId');
  const user = c.get('user')!;

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  if (user.role === 'student') {
    // Students see only their submissions
    const userSubmissions = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          eq(submissions.userId, user.id)
        )
      )
      .orderBy(desc(submissions.createdAt));

    return c.json(userSubmissions);
  } else {
    // Staff see all submissions
    const allSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId))
      .orderBy(desc(submissions.createdAt));

    return c.json(allSubmissions);
  }
});

// Get a single submission by ID with all details (answers, marks, user info)
app.get('/:submissionId', requireAuth, async (c) => {
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

// Start a new submission (creates draft)
app.post('/start', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json();
  
  // Validate request body
  const validation = startSubmissionSchema.safeParse(body);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return c.json(
      errorResponse(
        'Validation failed',
        { field: firstError?.path.join('.'), message: firstError?.message },
        ErrorCodes.VALIDATION_ERROR
      ),
      400
    );
  }

  const { assignmentId } = validation.data;

  // Check enrollment
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  // Check if assignment is open
  if (assignment.openDate && new Date() < assignment.openDate) {
    return c.json({ error: 'Assignment not yet open' }, 403);
  }

  // Check for any existing submission (draft or submitted)
  const [existingSubmission] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, user.id)
      )
    )
    .orderBy(desc(submissions.createdAt))
    .limit(1);

  if (existingSubmission) {
    // Load answers for the submission
    const existingAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.submissionId, existingSubmission.id));

    return c.json({ ...existingSubmission, answers: existingAnswers });
  }

  // Admins can start a submission for UI inspection without enrollment.
  if (user.role === 'admin') {
    const [{ value: attemptCount }] = await db
      .select({ value: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          eq(submissions.userId, user.id)
        )
      );

    const [submission] = await db
      .insert(submissions)
      .values({
        assignmentId,
        userId: user.id,
        attemptNumber: attemptCount + 1,
        status: 'draft',
        startedAt: new Date(),
      })
      .returning();

    return c.json({ ...submission, answers: [] }, 201);
  }

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, assignment.courseId)
      )
    )
    .limit(1);

  if (!enrollment) {
    return c.json({ error: 'Not enrolled in this course' }, 403);
  }

  // Check attempt limit
  const [{ value: attemptCount }] = await db
    .select({ value: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, user.id)
      )
    );

  if (assignment.maxAttempts && attemptCount >= assignment.maxAttempts) {
    return c.json({ error: 'Maximum attempts reached' }, 400);
  }

  const [submission] = await db
    .insert(submissions)
    .values({
      assignmentId,
      userId: user.id,
      attemptNumber: attemptCount + 1,
      status: 'draft',
      startedAt: new Date(),
    })
    .returning();

  return c.json({ ...submission, answers: [] }, 201);
});

// Save answer to a submission
app.post('/:submissionId/answers', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;
  const body = await c.req.json();
  
  // Validate request body
  const validation = saveAnswerSchema.safeParse(body);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return c.json(
      errorResponse(
        'Validation failed',
        { field: firstError?.path.join('.'), message: firstError?.message },
        ErrorCodes.VALIDATION_ERROR
      ),
      400
    );
  }

  const { questionId, content, fileUrl } = validation.data;

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
    return c.json({ error: 'Not your submission' }, 403);
  }

  if (submission.status !== 'draft') {
    return c.json({ error: 'Cannot modify submitted assignment' }, 400);
  }

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

  // Check if assignment is open (prevent saves before open date)
  if (assignment.openDate && new Date() < assignment.openDate) {
    return c.json({ error: 'Assignment is not yet open' }, 403);
  }

  // Allow saves after due date (will be marked late on submit)

  // Upsert answer
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

  if (existingAnswer) {
    const [updated] = await db
      .update(answers)
      .set({ content, fileUrl, updatedAt: new Date() })
      .where(eq(answers.id, existingAnswer.id))
      .returning();

    return c.json(updated);
  } else {
    const [answer] = await db
      .insert(answers)
      .values({
        submissionId,
        questionId,
        content,
        fileUrl,
      })
      .returning();

    return c.json(answer, 201);
  }
});

// Submit an assignment (finalize)
app.post('/:submissionId/submit', requireAuth, async (c) => {
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

  if (submission.userId !== user.id) {
    return c.json({ error: 'Not your submission' }, 403);
  }

  if (submission.status !== 'draft') {
    return c.json({ error: 'Already submitted' }, 400);
  }

  // Determine if submission is late
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);

  const now = new Date();
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

  const [updated] = await db
    .update(submissions)
    .set({
      status,
      submittedAt: now,
      updatedAt: now,
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  return c.json(updated);
});

// Grade a submission (staff/admin only)
app.post('/:submissionId/grade', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json(errorResponse('Forbidden', undefined, ErrorCodes.FORBIDDEN), 403);
  }

  const body = await c.req.json();
  
  // Validate request body - support both bulk and single grade formats
  const bulkValidation = bulkGradeSchema.safeParse(body);
  
  let gradesList;
  if (bulkValidation.success) {
    gradesList = bulkValidation.data.grades;
  } else {
    // Try legacy single-grade format
    gradesList = [body as { answerId: string; points: number; maxPoints: number; feedback?: string }];
    
    // Validate single grade has required fields
    if (gradesList[0].points === undefined || gradesList[0].maxPoints === undefined) {
      return c.json(
        errorResponse('Points and maxPoints required for all grades', undefined, ErrorCodes.VALIDATION_ERROR),
        400
      );
    }
  }

  const createdMarks = [];

  for (const grade of gradesList) {
    const { answerId, points, maxPoints, feedback } = grade;

    // Prevent duplicate marks: check if this answer already has a mark
    if (answerId) {
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
        // Update existing mark instead of creating duplicate
        const [updated] = await db
          .update(marks)
          .set({
            points,
            maxPoints,
            feedback,
            markedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(marks.id, existingMark.id))
          .returning();

        createdMarks.push(updated);
        continue;
      }
    }

    const [mark] = await db
      .insert(marks)
      .values({
        submissionId,
        answerId: answerId || null,
        points,
        maxPoints,
        feedback,
        markedBy: user.id,
        isAiAssisted: false,
      })
      .returning();

    createdMarks.push(mark);
  }

  // Update submission status
  await db
    .update(submissions)
    .set({
      status: 'graded',
      gradedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId));

  return c.json(createdMarks, 201);
});

// Upload file for UML question answer
app.post('/:submissionId/upload', requireAuth, async (c) => {
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
    } else {
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
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Upload failed: ${message}` }, 500);
  }
});

// Get file upload history for an answer
app.get('/answer/:answerId/file-history', requireAuth, async (c) => {
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
      } catch (err) {
        // If signed URL generation fails, keep the path
        return upload;
      }
    })
  );

  return c.json(historyWithSignedUrls);
});

/**
 * GET /api/submissions/:submissionId/results
 * 
 * Get submission results with grades and feedback for student view.
 * Includes answers, marks, AI grading suggestions, and course/assignment info.
 */
app.get('/:submissionId/results', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  // Fetch submission with assignment and course info
  const [submission] = await db
    .select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
      userId: submissions.userId,
      status: submissions.status,
      startedAt: submissions.startedAt,
      submittedAt: submissions.submittedAt,
      assignment: {
        id: assignments.id,
        title: assignments.title,
        courseId: assignments.courseId,
      },
    })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  // Check authorization - must be submission owner or staff
  const isOwner = submission.userId === user.id;
  const isStaff = user.role === 'admin' || user.role === 'staff';

  if (!isOwner && !isStaff) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Fetch course info
  const { courses } = await import('../../db/schema.js');
  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
    })
    .from(courses)
    .where(eq(courses.id, submission.assignment.courseId))
    .limit(1);

  // Fetch answers with questions and AI grading suggestions
  const submissionAnswers = await db
    .select({
      id: answers.id,
      questionId: answers.questionId,
      content: answers.content,
      fileUrl: answers.fileUrl,
      aiGradingSuggestion: answers.aiGradingSuggestion,
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

  // Generate signed URLs and attach marks
  const submissionMarks = await db
    .select()
    .from(marks)
    .where(eq(marks.submissionId, submissionId));

  const marksByAnswerId = new Map(
    submissionMarks.map((m) => [m.answerId, m])
  );

  const answersWithDetails = await Promise.all(
    submissionAnswers.map(async (answer) => {
      let fileUrl = answer.fileUrl;
      if (fileUrl) {
        try {
          fileUrl = await getSignedUrl(fileUrl);
        } catch {
          // Keep original path if signed URL fails
        }
      }

      return {
        ...answer,
        fileUrl,
        mark: marksByAnswerId.get(answer.id) || null,
      };
    })
  );

  // Calculate totals
  const totalPoints = answersWithDetails.reduce((sum, a) => sum + a.question.points, 0);
  const earnedPoints = answersWithDetails.reduce((sum, a) => sum + (a.mark?.points || 0), 0);

  return c.json({
    ...submission,
    assignment: {
      ...submission.assignment,
      course: course || { id: submission.assignment.courseId, code: 'Unknown', name: 'Unknown' },
    },
    answers: answersWithDetails,
    totalPoints,
    earnedPoints,
  });
});

export default app;
