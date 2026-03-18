import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB + schema — use a flexible chainable proxy
// ---------------------------------------------------------------------------
const queryResults: unknown[][] = [];
let queryIndex = 0;

function createChainProxy(): unknown {
  const proxy: Record<string, unknown> = {};
  const handler = () =>
    new Proxy(() => {}, {
      apply: () => {
        // Check if we should resolve (terminal methods)
        return createChainProxy();
      },
      get: (_target, prop) => {
        if (prop === 'then') {
          // Make it thenable — resolve with next result
          const result = queryResults[queryIndex] ?? [];
          queryIndex++;
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        return handler();
      },
    });

  return new Proxy(proxy, {
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
    select: () => createChainProxy(),
    insert: () => createChainProxy(),
    update: () => createChainProxy(),
  },
}));

vi.mock('../../db/schema.js', () => ({
  answers: { id: 'id', content: 'content', submissionId: 'submissionId', questionId: 'questionId' },
  assignmentQuestions: { assignmentId: 'assignmentId', questionId: 'questionId', points: 'points' },
  assignments: {
    id: 'id', title: 'title', courseId: 'courseId', timeLimit: 'timeLimit',
    mcqPenaltyPerWrongSelection: 'mcq_penalty', latePenaltyType: 'lp_type',
    latePenaltyValue: 'lp_value', latePenaltyCap: 'lp_cap', dueDate: 'dueDate',
  },
  marks: { id: 'id', submissionId: 'submissionId', answerId: 'answerId' },
  questions: { id: 'id', type: 'type', content: 'content', points: 'points' },
  submissions: { id: 'id', assignmentId: 'assignmentId', userId: 'userId', status: 'status', startedAt: 'startedAt' },
  enrollments: { userId: 'userId', courseId: 'courseId', role: 'role' },
  staffNotifications: {},
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  sql: (strings: TemplateStringsArray) => strings.join(''),
  inArray: (col: unknown, vals: unknown[]) => [col, vals],
}));

vi.mock('../lib/grading-utils.js', () => ({
  applyLatePenalty: vi.fn(() => ({ applied: false, penaltyPercent: 0, minutesLate: 0 })),
  getEffectiveDueDate: vi.fn(() => new Date('2026-01-15T12:00:00Z')),
}));

vi.mock('../lib/mcq-grading.js', () => ({
  gradeMcqAnswer: vi.fn(() => ({ points: 8, feedback: 'Correct answer.' })),
}));

import autoSubmitExpired from './auto-submit-expired';
import { gradeMcqAnswer } from '../lib/mcq-grading.js';
import { applyLatePenalty, getEffectiveDueDate } from '../lib/grading-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeHelpers() {
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as import('graphile-worker').JobHelpers;
}

const expiredSubmission = {
  submissionId: 'sub-1',
  assignmentId: 'asgn-1',
  userId: 'user-1',
  startedAt: new Date('2026-01-15T10:00:00Z'),
  assignmentTitle: 'Midterm Exam',
  courseId: 'course-1',
  timeLimit: 60,
  mcqPenaltyPerWrongSelection: 1,
  latePenaltyType: 'none',
  latePenaltyValue: null,
  latePenaltyCap: null,
  dueDate: new Date('2026-01-15T12:00:00Z'),
};

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  queryResults.length = 0;
  queryIndex = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('autoSubmitExpired — no expired submissions', () => {
  it('exits early when no expired submissions found', async () => {
    queryResults.push([]); // expired submissions query → empty

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('no expired submissions found'),
    );
  });
});

describe('autoSubmitExpired — processes expired submissions', () => {
  it('grades MCQ answers on auto-submit', async () => {
    queryResults.push(
      [expiredSubmission],           // 1: expired submissions
      [{                              // 2: submission answers (MCQ)
        answerId: 'ans-1',
        answerContent: { selectedOptionIds: ['a'] },
        questionType: 'mcq',
        questionContent: { options: [{ id: 'a', isCorrect: true }] },
        questionPoints: 10,
        assignmentQuestionPoints: null,
      }],
      [],                             // 3: existing mark check → none
      [],                             // 4: insert mark (resolved)
      [],                             // 5: non-MCQ questions → none (all MCQ)
      [],                             // 6: update submission
      [{ userId: 'staff-1' }],        // 7: enrolled staff
      [],                             // 8: insert notification
    );

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(gradeMcqAnswer).toHaveBeenCalledWith(
      { options: [{ id: 'a', isCorrect: true }] },
      { selectedOptionIds: ['a'] },
      10,
      1,
    );
  });

  it('skips non-MCQ answers during auto-grading', async () => {
    queryResults.push(
      [expiredSubmission],           // 1: expired submissions
      [{                              // 2: submission answers (written)
        answerId: 'ans-2',
        answerContent: { text: 'Essay answer' },
        questionType: 'written',
        questionContent: {},
        questionPoints: 20,
        assignmentQuestionPoints: null,
      }],
      [{ id: 'q-1' }],              // 3: non-MCQ questions exist
      [],                             // 4: update submission
      [],                             // 5: staff
    );

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(gradeMcqAnswer).not.toHaveBeenCalled();
  });

  it('completes successfully when all questions are MCQ-only', async () => {
    queryResults.push(
      [expiredSubmission],           // 1: expired submissions
      [{                              // 2: MCQ answer
        answerId: 'ans-1',
        answerContent: { selectedOptionIds: ['a'] },
        questionType: 'mcq',
        questionContent: { options: [{ id: 'a', isCorrect: true }] },
        questionPoints: 10,
        assignmentQuestionPoints: null,
      }],
      [],                             // 3: no existing mark
      [],                             // 4: insert mark
      [],                             // 5: no non-MCQ questions → all MCQ
      [],                             // 6: update submission
      [],                             // 7: no staff
    );

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('auto-submitted submission sub-1'),
    );
  });

  it('applies late penalty when configured', async () => {
    const lateSubmission = {
      ...expiredSubmission,
      latePenaltyType: 'per_hour',
      latePenaltyValue: '5',
      latePenaltyCap: '25',
    };

    vi.mocked(applyLatePenalty).mockReturnValueOnce({
      applied: true,
      penaltyPercent: 10,
      minutesLate: 120,
      adjustedScore: 90,
    });

    queryResults.push(
      [lateSubmission],              // 1: expired submissions
      [],                             // 2: no answers
      [],                             // 3: no non-MCQ
      [],                             // 4: update submission
      [],                             // 5: no staff
    );

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(getEffectiveDueDate).toHaveBeenCalled();
    expect(applyLatePenalty).toHaveBeenCalled();
  });

  it('sends notification to enrolled staff after auto-submit', async () => {
    queryResults.push(
      [expiredSubmission],           // 1: expired submissions
      [],                             // 2: no answers
      [],                             // 3: no non-MCQ
      [],                             // 4: update submission
      [{ userId: 'staff-1' }, { userId: 'staff-2' }], // 5: enrolled staff
      [],                             // 6: insert notification for staff-1
      [],                             // 7: insert notification for staff-2
    );

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('completed'),
    );
  });

  it('handles submissions with no answers gracefully', async () => {
    queryResults.push(
      [expiredSubmission],           // 1: expired submissions
      [],                             // 2: no answers at all
      [],                             // 3: no non-MCQ
      [],                             // 4: update submission
      [],                             // 5: no staff
    );

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('auto-submitted submission sub-1'),
    );
  });

  it('handles individual submission errors without failing the batch', async () => {
    const sub1 = { ...expiredSubmission, submissionId: 'sub-err' };
    const sub2 = { ...expiredSubmission, submissionId: 'sub-ok' };

    // For this test, we need the second select (answers query for sub-err) to throw.
    // Since the proxy resolves sequentially, we'll simulate this by making
    // gradeMcqAnswer throw for the first submission
    vi.mocked(gradeMcqAnswer)
      .mockImplementationOnce(() => { throw new Error('Grading error'); })
      .mockReturnValueOnce({ points: 5, feedback: 'Correct answer.' });

    queryResults.push(
      [sub1, sub2],                  // 1: two expired submissions
      // sub-err processing:
      [{                              // 2: MCQ answer for sub-err (will throw in grading)
        answerId: 'ans-1',
        answerContent: { selectedOptionIds: ['a'] },
        questionType: 'mcq',
        questionContent: { options: [{ id: 'a', isCorrect: true }] },
        questionPoints: 10,
        assignmentQuestionPoints: null,
      }],
      // sub-ok processing:
      [],                             // 3: no answers for sub-ok
      [],                             // 4: no non-MCQ for sub-ok
      [],                             // 5: update sub-ok
      // notifications
      [],                             // 6: staff lookup
    );

    const helpers = makeHelpers();
    await autoSubmitExpired({}, helpers);

    expect(helpers.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to auto-submit sub-err'),
    );
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('auto-submitted submission sub-ok'),
    );
  });
});
