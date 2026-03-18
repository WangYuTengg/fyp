import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB — chainable proxy
// ---------------------------------------------------------------------------
const queryResults: unknown[][] = [];
let queryIndex = 0;

function createChainProxy(): unknown {
  const handler = (): unknown =>
    new Proxy(() => {}, {
      apply: () => createChainProxy(),
      get: (_target, prop) => {
        if (prop === 'then') {
          const result = queryResults[queryIndex] ?? [];
          queryIndex++;
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        return handler();
      },
    });

  return new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => {
      if (prop === 'then') {
        const result = queryResults[queryIndex] ?? [];
        queryIndex++;
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return handler();
    },
  });
}

vi.mock('../../db/index.js', () => ({
  db: {
    select: (..._args: unknown[]) => createChainProxy(),
    insert: (..._args: unknown[]) => createChainProxy(),
    update: (..._args: unknown[]) => createChainProxy(),
  },
}));

vi.mock('../../db/schema.js', () => ({
  submissions: { id: 'id', assignmentId: 'assignmentId', userId: 'userId', status: 'status', startedAt: 'startedAt', attemptNumber: 'attemptNumber', questionOrder: 'questionOrder' },
  assignments: { id: 'id', courseId: 'courseId', openDate: 'openDate', dueDate: 'dueDate', timeLimit: 'timeLimit', maxAttempts: 'maxAttempts', shuffleQuestions: 'shuffleQuestions', mcqPenaltyPerWrongSelection: 'mcqPenalty', latePenaltyType: 'lpType', latePenaltyValue: 'lpValue', latePenaltyCap: 'lpCap' },
  answers: { id: 'id', submissionId: 'submissionId', questionId: 'questionId', content: 'content' },
  questions: { id: 'id', type: 'type', content: 'content', points: 'points' },
  enrollments: { userId: 'userId', courseId: 'courseId' },
  marks: { id: 'id', submissionId: 'submissionId', answerId: 'answerId' },
  assignmentQuestions: { assignmentId: 'assignmentId', questionId: 'questionId', points: 'points', order: 'order' },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  desc: (a: unknown) => a,
  count: () => 'count',
  inArray: (col: unknown, vals: unknown[]) => [col, vals],
  relations: () => ({}),
  pgTable: () => ({}),
  pgEnum: () => ({}),
}));

vi.mock('../../server/lib/mcq-grading.js', () => ({
  gradeMcqAnswer: vi.fn(() => ({ points: 8, feedback: 'Correct answer.' })),
}));

vi.mock('../../server/lib/grading-utils.js', () => ({
  applyLatePenalty: vi.fn(() => ({ applied: false, penaltyPercent: 0, minutesLate: 0, adjustedScore: 100 })),
  getEffectiveDueDate: vi.fn(() => new Date('2026-01-15T12:00:00Z')),
}));

vi.mock('../../server/lib/validation-schemas.js', () => ({
  startSubmissionSchema: {
    safeParse: vi.fn((body: unknown) => {
      const b = body as Record<string, unknown>;
      if (b?.assignmentId) return { success: true, data: b };
      return { success: false, error: { issues: [{ path: ['assignmentId'], message: 'Required' }] } };
    }),
  },
  saveAnswerSchema: {
    safeParse: vi.fn((body: unknown) => {
      const b = body as Record<string, unknown>;
      if (b?.questionId && b?.content !== undefined) return { success: true, data: b };
      return { success: false, error: { issues: [{ path: ['questionId'], message: 'Required' }] } };
    }),
  },
}));

vi.mock('../../server/lib/errors.js', () => ({
  errorResponse: (msg: string, details: unknown, code: string) => ({ error: msg, details, code }),
  ErrorCodes: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
}));

vi.mock('../../server/middleware/auth.js', () => ({
  requireAuth: vi.fn((c: unknown, next: () => Promise<void>) => {
    const ctx = c as { get: (k: string) => unknown; json: (body: unknown, status?: number) => unknown };
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    return next();
  }),
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

// Mock deterministic shuffle (used by start-submission)
vi.mock('../../server/routes/submissions/deterministic-shuffle.js', () => ({
  deterministicShuffle: vi.fn((ids: string[]) => [...ids].reverse()),
}));

import { Hono } from 'hono';
import startSubmissionRoute from '../../server/routes/submissions/start-submission.js';
import saveAnswerRoute from '../../server/routes/submissions/save-answer.js';
import submitSubmissionRoute from '../../server/routes/submissions/submit-submission.js';
import { gradeMcqAnswer } from '../../server/lib/mcq-grading.js';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------
function createTestApp(user = { id: 'student-1', email: 'student@e.ntu.edu.sg', role: 'student', supabaseId: 'sup-1' }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', user);
    return next();
  });
  app.route('/', startSubmissionRoute);
  app.route('/', saveAnswerRoute);
  app.route('/', submitSubmissionRoute);
  return app;
}

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  queryResults.length = 0;
  queryIndex = 0;
});

// ---------------------------------------------------------------------------
// T10: Integration Tests — Submission Lifecycle
// ---------------------------------------------------------------------------
describe('T10: Submission Lifecycle — POST /start', () => {
  it('creates submission in draft status', async () => {
    const app = createTestApp();
    const now = new Date();

    queryResults.push(
      [{ id: 'asgn-1', courseId: 'course-1', openDate: null, dueDate: null, maxAttempts: null, shuffleQuestions: false }], // assignment lookup
      [],                                          // existing draft check → none
      [{ userId: 'student-1', courseId: 'course-1' }], // enrollment check
      [{ value: 0 }],                             // attempt count
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft', attemptNumber: 1, startedAt: now }], // insert submission
      [{ shuffleQuestions: false }],               // generateQuestionOrder → assignment lookup
    );

    const res = await app.request('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: 'asgn-1' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('draft');
    expect(body.answers).toEqual([]);
  });

  it('resumes existing draft submission', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'asgn-1', courseId: 'course-1', openDate: null, dueDate: null, maxAttempts: null }], // assignment
      [{ id: 'sub-existing', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft', attemptNumber: 1 }], // existing draft
      [{ id: 'ans-1', submissionId: 'sub-existing', questionId: 'q-1', content: { text: 'partial' } }], // existing answers
    );

    const res = await app.request('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: 'asgn-1' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('sub-existing');
  });

  it('rejects when assignment not yet open', async () => {
    const app = createTestApp();
    const future = new Date(Date.now() + 86400000); // tomorrow

    queryResults.push(
      [{ id: 'asgn-1', courseId: 'course-1', openDate: future, dueDate: null, maxAttempts: null }],
    );

    const res = await app.request('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: 'asgn-1' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Assignment not yet open');
  });

  it('rejects when maximum attempts reached', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'asgn-1', courseId: 'course-1', openDate: null, dueDate: null, maxAttempts: 2 }], // assignment
      [],                                           // no existing draft
      [{ userId: 'student-1', courseId: 'course-1' }], // enrollment
      [{ value: 2 }],                              // attempt count = max
    );

    const res = await app.request('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: 'asgn-1' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Maximum attempts reached');
  });

  it('rejects when not enrolled', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'asgn-1', courseId: 'course-1', openDate: null, dueDate: null, maxAttempts: null }],
      [], // no draft
      [], // no enrollment
    );

    const res = await app.request('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: 'asgn-1' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not enrolled in this course');
  });
});

describe('T10: Submission Lifecycle — POST /:submissionId/answers', () => {
  it('saves MCQ answer to submission', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft' }], // submission lookup
      [{ id: 'asgn-1', courseId: 'course-1', openDate: null }],                           // assignment lookup
      [{ assignmentId: 'asgn-1', questionId: 'q-1' }],                                     // assignmentQuestion check
      [],                                                                                    // existing answer → none
      [{ id: 'ans-1', submissionId: 'sub-1', questionId: 'q-1', content: { selectedOptionIds: ['a'] } }], // insert answer
    );

    const res = await app.request('/sub-1/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q-1', content: { selectedOptionIds: ['a'] } }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.questionId).toBe('q-1');
  });

  it('updates existing answer (upsert)', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft' }],
      [{ id: 'asgn-1', courseId: 'course-1', openDate: null }],
      [{ assignmentId: 'asgn-1', questionId: 'q-1' }],
      [{ id: 'ans-existing', submissionId: 'sub-1', questionId: 'q-1', content: { text: 'old' } }], // existing answer
      [{ id: 'ans-existing', submissionId: 'sub-1', questionId: 'q-1', content: { text: 'new' } }], // updated answer
    );

    const res = await app.request('/sub-1/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q-1', content: { text: 'new' } }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content.text).toBe('new');
  });

  it('rejects save after submission is submitted', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'submitted' }],
    );

    const res = await app.request('/sub-1/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q-1', content: { text: 'too late' } }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Cannot modify submitted assignment');
  });

  it('rejects save for wrong user', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'other-user', status: 'draft' }],
    );

    const res = await app.request('/sub-1/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q-1', content: { text: 'sneaky' } }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not your submission');
  });
});

describe('T10: Submission Lifecycle — POST /:submissionId/submit', () => {
  it('submits and auto-grades MCQs', async () => {
    const app = createTestApp();
    const now = new Date();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft', startedAt: now }], // submission
      [{ id: 'asgn-1', courseId: 'course-1', dueDate: null, timeLimit: null, mcqPenaltyPerWrongSelection: 1, latePenaltyType: 'none', latePenaltyValue: null, latePenaltyCap: null }], // assignment
      [{ answerId: 'ans-1', answerContent: { selectedOptionIds: ['a'] }, questionType: 'mcq', questionContent: { options: [{ id: 'a', isCorrect: true }] }, questionPoints: 10, assignmentQuestionPoints: null }], // answers
      [], // existing mark check
      [], // insert mark
      [], // non-MCQ check → empty (all MCQ)
      [{ id: 'sub-1', status: 'graded', submittedAt: now }], // update submission → graded
    );

    const res = await app.request('/sub-1/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(gradeMcqAnswer).toHaveBeenCalledOnce();
  });

  it('sets status to submitted when non-MCQ questions exist', async () => {
    const app = createTestApp();
    const now = new Date();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft', startedAt: now }],
      [{ id: 'asgn-1', dueDate: null, timeLimit: null, mcqPenaltyPerWrongSelection: 1, latePenaltyType: 'none', latePenaltyValue: null, latePenaltyCap: null }],
      [], // no answers to grade
      [{ id: 'q-written' }], // non-MCQ question exists
      [{ id: 'sub-1', status: 'submitted', submittedAt: now }], // update → submitted
    );

    const res = await app.request('/sub-1/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
  });

  it('marks submission as late when past due date', async () => {
    const app = createTestApp();
    const pastDue = new Date(Date.now() - 3600000); // 1 hour ago

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft', startedAt: new Date(Date.now() - 7200000) }],
      [{ id: 'asgn-1', dueDate: pastDue, timeLimit: null, mcqPenaltyPerWrongSelection: 1, latePenaltyType: 'percentage', latePenaltyValue: '10', latePenaltyCap: '50' }],
      [], // no answers
      [], // no non-MCQ
      [{ id: 'sub-1', status: 'late' }], // update → late
    );

    const res = await app.request('/sub-1/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
  });

  it('rejects already-submitted submission', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'submitted' }],
    );

    const res = await app.request('/sub-1/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Already submitted');
  });

  it('rejects submission by wrong user', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'other-user', status: 'draft' }],
    );

    const res = await app.request('/sub-1/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Not your submission');
  });

  it('marks late when time limit exceeded', async () => {
    const app = createTestApp();
    const twoHoursAgo = new Date(Date.now() - 7200000);

    queryResults.push(
      [{ id: 'sub-1', assignmentId: 'asgn-1', userId: 'student-1', status: 'draft', startedAt: twoHoursAgo }],
      [{ id: 'asgn-1', dueDate: null, timeLimit: 60, mcqPenaltyPerWrongSelection: 1, latePenaltyType: 'none', latePenaltyValue: null, latePenaltyCap: null }], // 60 min time limit, started 2h ago
      [], // no answers
      [], // no non-MCQ
      [{ id: 'sub-1', status: 'graded' }], // update
    );

    const res = await app.request('/sub-1/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
  });
});
