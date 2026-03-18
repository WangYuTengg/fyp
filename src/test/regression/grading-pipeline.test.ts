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
  answers: { id: 'id', content: 'content', submissionId: 'submissionId', questionId: 'questionId', aiGradingSuggestion: 'aiGradingSuggestion' },
  questions: { id: 'id', type: 'type', content: 'content', points: 'points', rubric: 'rubric' },
  marks: { id: 'id', submissionId: 'submissionId', answerId: 'answerId' },
  submissions: { id: 'id', status: 'status', gradedAt: 'gradedAt', updatedAt: 'updatedAt', userId: 'userId' },
  aiGradingJobs: { id: 'id', status: 'status', tokensUsed: 'tokensUsed', cost: 'cost', completedAt: 'completedAt', error: 'error' },
  aiUsageStats: { date: 'date', totalTokens: 'totalTokens', totalCost: 'totalCost', requestCount: 'requestCount', successCount: 'successCount', failureCount: 'failureCount', avgProcessingTime: 'avgProcessingTime' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => [a, b],
  and: (...args: unknown[]) => args,
  isNotNull: (a: unknown) => a,
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
    { join: (..._args: unknown[]) => '' },
  ),
}));

// Mock AI module
const mockGenerateAIObject = vi.fn();
vi.mock('../../server/lib/ai.js', () => ({
  generateAIObject: (...args: unknown[]) => mockGenerateAIObject(...args),
}));

// Mock prompts
vi.mock('../../server/config/prompts.js', () => ({
  getPrompt: vi.fn((type: string) => ({
    system: `You are a ${type} grading assistant.`,
    version: '1.0',
    user: vi.fn(({ studentAnswer, modelAnswer, maxPoints }: Record<string, unknown>) =>
      `Grade this: Student: ${studentAnswer}, Model: ${modelAnswer}, Max: ${maxPoints}`
    ),
    userText: vi.fn(({ studentUML, referenceUML, maxPoints }: Record<string, unknown>) =>
      `Compare UML: Student: ${studentUML}, Reference: ${referenceUML}, Max: ${maxPoints}`
    ),
  })),
}));

// Mock pricing
vi.mock('../../server/config/pricing.js', () => ({
  calculateCost: vi.fn(() => 0.005),
}));

// Mock content utils
vi.mock('../../server/lib/content-utils.js', () => ({
  getQuestionContent: vi.fn((content: unknown) => content || {}),
  getAnswerContent: vi.fn((content: unknown) => content || {}),
  getRubricCriteria: vi.fn(() => null),
  getAiGradingSuggestion: vi.fn((suggestion: unknown) => suggestion),
}));

// Mock error utils
vi.mock('../../server/lib/error-utils.js', () => ({
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
  getErrorStack: vi.fn(() => 'mock-stack'),
}));

// Mock auth middleware (used by accept/reject routes)
vi.mock('../../server/middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requireAuth: vi.fn((c: unknown, next: () => Promise<void>) => {
    const ctx = c as { get: (k: string) => unknown; json: (body: unknown, status?: number) => unknown };
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    return next();
  }),
  requireRole: vi.fn((..._roles: string[]) => {
    return (_c: unknown, next: () => Promise<void>) => next();
  }),
}));

// Mock notifications
const mockCheckBatchCompletion = vi.fn().mockResolvedValue(undefined);
const mockNotifyGradingFailed = vi.fn().mockResolvedValue(undefined);
vi.mock('../../server/lib/notifications.js', () => ({
  checkBatchCompletion: (...args: unknown[]) => mockCheckBatchCompletion(...args),
  notifyGradingFailed: (...args: unknown[]) => mockNotifyGradingFailed(...args),
}));

// Mock validation schemas (for single route)
vi.mock('../../server/lib/validation-schemas.js', () => ({
  singleAutoGradeSchema: {
    safeParse: vi.fn((body: unknown) => {
      const b = body as Record<string, unknown>;
      if (b && b.answerId) {
        return { success: true, data: b };
      }
      return { success: false, error: { issues: [{ path: ['answerId'], message: 'Required' }] } };
    }),
  },
}));

// Mock errors util
vi.mock('../../server/lib/errors.js', () => ({
  errorResponse: vi.fn((msg: string, details: unknown) => ({ error: msg, details })),
  ErrorCodes: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
}));

// Mock worker (for single route job queueing)
const mockAddJob = vi.fn().mockResolvedValue(undefined);
vi.mock('../../server/lib/worker.js', () => ({
  addJob: (...args: unknown[]) => mockAddJob(...args),
}));

import { Hono } from 'hono';
import autoGradeWritten from '../../server/jobs/auto-grade-written.js';
import autoGradeUML from '../../server/jobs/auto-grade-uml.js';
import acceptRoute from '../../server/routes/auto-grade/accept.js';
import rejectRoute from '../../server/routes/auto-grade/reject.js';
import batchAcceptRoute from '../../server/routes/auto-grade/batch-accept.js';
import singleRoute from '../../server/routes/auto-grade/single.js';

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

const basePayload = {
  answerId: 'ans-1',
  questionId: 'q-1',
  submissionId: 'sub-1',
  userId: 'user-1',
  jobId: 'job-1',
};

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  queryResults.length = 0;
  queryIndex = 0;
});

// ---------------------------------------------------------------------------
// T12: Regression Tests — Grading Pipeline (Written)
// ---------------------------------------------------------------------------
describe('T12: Written answer grading', () => {
  it('LLM returns structured JSON — parsed correctly', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockResolvedValueOnce({
      object: { points: 8, reasoning: 'Good analysis of the topic.', confidence: 85 },
      tokensUsed: 500,
    });

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: 'Student essay about databases' } }], // answer data
      [{ id: 'q-1', content: { modelAnswer: 'The correct approach involves...' }, points: 10, rubric: null }], // question data
      [], // update answer with suggestion
      [], // update job → completed
      [], // usage stats check → none
      [], // insert usage stats
    );

    await autoGradeWritten(basePayload, helpers);

    expect(mockGenerateAIObject).toHaveBeenCalledOnce();
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Completed auto-grade'),
    );
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('8/10'),
    );
  });

  it('LLM returns malformed response — graceful failure', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockRejectedValueOnce(new Error('Zod validation failed: points must be a number'));

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: 'Student answer' } }],
      [{ id: 'q-1', content: { modelAnswer: 'Model answer' }, points: 10, rubric: null }],
      // LLM call throws here
      [], // update job → failed
      [], // usage stats check → none
      [], // insert failure stats
      [], // notify grading failed
    );

    await expect(autoGradeWritten(basePayload, helpers)).rejects.toThrow('Zod validation failed');

    expect(mockNotifyGradingFailed).toHaveBeenCalledWith(
      'user-1', 'ans-1', 'sub-1', 'q-1',
      expect.stringContaining('Zod validation failed'),
      undefined,
    );
  });

  it('answer not found — job marked as failed', async () => {
    const helpers = makeHelpers();

    queryResults.push(
      [], // update job → processing
      [], // answer not found
      [], // update job → failed
      [], // usage stats
      [], // insert stats
    );

    await expect(autoGradeWritten(basePayload, helpers)).rejects.toThrow('Answer ans-1 not found');
    expect(mockNotifyGradingFailed).toHaveBeenCalled();
  });

  it('empty student answer — job marked as failed', async () => {
    const helpers = makeHelpers();

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: '' } }],
      [{ id: 'q-1', content: { modelAnswer: 'Model answer' }, points: 10, rubric: null }],
      [], // update job → failed
      [], // usage stats
      [], // insert stats
    );

    await expect(autoGradeWritten(basePayload, helpers)).rejects.toThrow('Student answer is empty');
  });

  it('no model answer — job marked as failed', async () => {
    const helpers = makeHelpers();

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: 'Student answer' } }],
      [{ id: 'q-1', content: {}, points: 10, rubric: null }], // no modelAnswer
      [], // update job → failed
      [], // usage stats
      [], // insert stats
    );

    await expect(autoGradeWritten(basePayload, helpers)).rejects.toThrow('has no model answer');
  });

  it('LLM awards more than maxPoints — clamped correctly', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockResolvedValueOnce({
      object: { points: 15, reasoning: 'Exceptional work', confidence: 95 },
      tokensUsed: 600,
    });

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: 'Excellent answer' } }],
      [{ id: 'q-1', content: { modelAnswer: 'Model' }, points: 10, rubric: null }],
      [], // update answer
      [], // update job → completed
      [], // usage stats
      [], // insert stats
    );

    await autoGradeWritten(basePayload, helpers);

    expect(helpers.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('clamping to 10'),
    );
  });

  it('checks batch completion when batchId is provided', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockResolvedValueOnce({
      object: { points: 7, reasoning: 'Decent analysis', confidence: 70 },
      tokensUsed: 400,
    });

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: 'Student answer' } }],
      [{ id: 'q-1', content: { modelAnswer: 'Model' }, points: 10, rubric: null }],
      [], // update answer
      [], // update job → completed
      [], // usage stats
      [], // insert stats
    );

    await autoGradeWritten({ ...basePayload, batchId: 'batch-1' }, helpers);

    expect(mockCheckBatchCompletion).toHaveBeenCalledWith('batch-1', 'user-1');
  });

  it('updates existing usage stats instead of creating new', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockResolvedValueOnce({
      object: { points: 5, reasoning: 'Average', confidence: 60 },
      tokensUsed: 300,
    });

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: 'Student answer' } }],
      [{ id: 'q-1', content: { modelAnswer: 'Model' }, points: 10, rubric: null }],
      [], // update answer
      [], // update job → completed
      [{ totalTokens: 1000, totalCost: '0.010000', requestCount: 5, successCount: 4, failureCount: 1, avgProcessingTime: 2000 }], // existing stats
      [], // update stats
    );

    await autoGradeWritten(basePayload, helpers);

    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('5/10'),
    );
  });
});

// ---------------------------------------------------------------------------
// T12: Regression Tests — UML Grading
// ---------------------------------------------------------------------------
describe('T12: UML grading', () => {
  it('PlantUML text input — graded correctly', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockResolvedValueOnce({
      object: { points: 9, reasoning: 'Accurate class diagram', confidence: 90 },
      tokensUsed: 700,
    });

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { umlText: '@startuml\nclass Student\n@enduml' } }],
      [{ id: 'q-1', content: { modelAnswer: '@startuml\nclass Student\nclass Course\n@enduml' }, points: 10, rubric: null }],
      [], // update answer
      [], // update job → completed
      [], // usage stats
      [], // insert stats
    );

    await autoGradeUML(basePayload, helpers);

    expect(mockGenerateAIObject).toHaveBeenCalledOnce();
    expect(helpers.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('9/10'),
    );
  });

  it('falls back to referenceDiagram when modelAnswer empty', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockResolvedValueOnce({
      object: { points: 7, reasoning: 'Missing associations', confidence: 75 },
      tokensUsed: 500,
    });

    queryResults.push(
      [],
      [{ id: 'ans-1', content: { umlText: '@startuml\nclass A\n@enduml' } }],
      [{ id: 'q-1', content: { modelAnswer: '', referenceDiagram: '@startuml\nclass A\nclass B\nA --> B\n@enduml' }, points: 10, rubric: null }],
      [], [], [], [],
    );

    await autoGradeUML(basePayload, helpers);

    expect(mockGenerateAIObject).toHaveBeenCalledOnce();
  });

  it('no UML text in answer — job fails', async () => {
    const helpers = makeHelpers();

    queryResults.push(
      [],
      [{ id: 'ans-1', content: {} }], // no umlText
      [{ id: 'q-1', content: { modelAnswer: '@startuml\nclass A\n@enduml' }, points: 10, rubric: null }],
      [], [], [],
    );

    await expect(autoGradeUML(basePayload, helpers)).rejects.toThrow('No UML text provided');
    expect(mockNotifyGradingFailed).toHaveBeenCalled();
  });

  it('no reference diagram — job fails', async () => {
    const helpers = makeHelpers();

    queryResults.push(
      [],
      [{ id: 'ans-1', content: { umlText: '@startuml\nclass A\n@enduml' } }],
      [{ id: 'q-1', content: {}, points: 10, rubric: null }], // no modelAnswer or referenceDiagram
      [], [], [],
    );

    await expect(autoGradeUML(basePayload, helpers)).rejects.toThrow('has no UML answer diagram');
  });

  it('UML grading clamps points exceeding maxPoints', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockResolvedValueOnce({
      object: { points: 20, reasoning: 'Perfect', confidence: 99 },
      tokensUsed: 600,
    });

    queryResults.push(
      [],
      [{ id: 'ans-1', content: { umlText: '@startuml\nclass A\n@enduml' } }],
      [{ id: 'q-1', content: { modelAnswer: '@startuml\nclass A\n@enduml' }, points: 10, rubric: null }],
      [], [], [], [],
    );

    await autoGradeUML(basePayload, helpers);

    expect(helpers.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('clamping to 10'),
    );
  });
});

// ---------------------------------------------------------------------------
// T12: Accept/Reject regression
// ---------------------------------------------------------------------------
describe('T12: Accept/Reject AI suggestions', () => {
  const staffUser = { id: 'staff-1', email: 'prof@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-1' };

  function createStaffApp() {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', staffUser);
      return next();
    });
    app.route('/', acceptRoute);
    app.route('/', rejectRoute);
    return app;
  }

  it('accepting AI grade creates mark with correct fields', async () => {
    const app = createStaffApp();

    queryResults.push(
      [{ id: 'ans-1', submissionId: 'sub-1', aiGradingSuggestion: { points: 8, reasoning: 'Good answer' }, maxPoints: 10 }],
      [{ id: 'mark-1', submissionId: 'sub-1', answerId: 'ans-1', points: 8, maxPoints: 10, isAiAssisted: true, aiSuggestionAccepted: true }],
    );

    const res = await app.request('/ans-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.points).toBe(8);
    expect(body.maxPoints).toBe(10);
  });

  it('rejecting AI grade preserves manual override', async () => {
    const app = createStaffApp();

    queryResults.push(
      [{ id: 'ans-1', submissionId: 'sub-1', maxPoints: 10 }],
      [{ id: 'mark-1', submissionId: 'sub-1', answerId: 'ans-1', points: 6, maxPoints: 10, isAiAssisted: true, aiSuggestionAccepted: false }],
    );

    const res = await app.request('/ans-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: 6, feedback: 'Missing key argument' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.points).toBe(6);
  });

  it('accept with no AI suggestion returns 400', async () => {
    const app = createStaffApp();

    const { getAiGradingSuggestion } = await import('../../server/lib/content-utils.js');
    vi.mocked(getAiGradingSuggestion).mockReturnValueOnce(null);

    queryResults.push(
      [{ id: 'ans-1', submissionId: 'sub-1', aiGradingSuggestion: null, maxPoints: 10 }],
    );

    const res = await app.request('/ans-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No AI grading suggestion');
  });
});

// ---------------------------------------------------------------------------
// T12: Failure tracking & notifications
// ---------------------------------------------------------------------------
describe('T12: Failure tracking', () => {
  it('failed grading job updates stats with failure count', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockRejectedValueOnce(new Error('LLM timeout'));

    queryResults.push(
      [], // update job → processing
      [{ id: 'ans-1', content: { text: 'Student answer' } }],
      [{ id: 'q-1', content: { modelAnswer: 'Model' }, points: 10, rubric: null }],
      [], // update job → failed
      [], // usage stats check → none
      [], // insert failure stats
    );

    await expect(autoGradeWritten(basePayload, helpers)).rejects.toThrow('LLM timeout');

    expect(helpers.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to auto-grade'),
    );
    expect(mockNotifyGradingFailed).toHaveBeenCalledWith(
      'user-1', 'ans-1', 'sub-1', 'q-1', 'LLM timeout', undefined,
    );
  });

  it('failed grading with batchId still notifies', async () => {
    const helpers = makeHelpers();

    mockGenerateAIObject.mockRejectedValueOnce(new Error('Rate limited'));

    queryResults.push(
      [],
      [{ id: 'ans-1', content: { text: 'Student answer' } }],
      [{ id: 'q-1', content: { modelAnswer: 'Model' }, points: 10, rubric: null }],
      [], [], [],
    );

    await expect(autoGradeWritten({ ...basePayload, batchId: 'batch-1' }, helpers)).rejects.toThrow('Rate limited');

    expect(mockNotifyGradingFailed).toHaveBeenCalledWith(
      'user-1', 'ans-1', 'sub-1', 'q-1', 'Rate limited', 'batch-1',
    );
  });
});

// ---------------------------------------------------------------------------
// T12: Batch operations — accept all in assignment
// ---------------------------------------------------------------------------
describe('T12: Batch accept operations', () => {
  const staffUser = { id: 'staff-1', email: 'prof@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-1' };

  function createBatchApp() {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', staffUser);
      return next();
    });
    app.route('/', batchAcceptRoute);
    return app;
  }

  it('batch-accept creates marks for multiple answers', async () => {
    const app = createBatchApp();

    // Fetch answers with AI suggestions
    queryResults.push([
      { id: 'ans-1', submissionId: 'sub-1', aiGradingSuggestion: { points: 8, reasoning: 'Good' }, maxPoints: 10 },
      { id: 'ans-2', submissionId: 'sub-1', aiGradingSuggestion: { points: 9, reasoning: 'Great' }, maxPoints: 10 },
    ]);
    // Check existing marks — none
    queryResults.push([]);
    // Insert marks
    queryResults.push([
      { id: 'mark-1', answerId: 'ans-1' },
      { id: 'mark-2', answerId: 'ans-2' },
    ]);
    // Answer count for sub-1
    queryResults.push([{ count: 2 }]);
    // Mark count for sub-1
    queryResults.push([{ count: 2 }]);
    // Update submission to graded
    queryResults.push([]);

    const res = await app.request('/batch-accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accepted).toBe(2);
    expect(body.skipped).toBe(0);
  });

  it('batch-accept skips already-marked answers', async () => {
    const app = createBatchApp();

    // Fetch answers with AI suggestions
    queryResults.push([
      { id: 'ans-1', submissionId: 'sub-1', aiGradingSuggestion: { points: 8, reasoning: 'Good' }, maxPoints: 10 },
    ]);
    // Existing marks — ans-1 already has a mark
    queryResults.push([{ answerId: 'ans-1' }]);

    const res = await app.request('/batch-accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerIds: ['00000000-0000-4000-8000-000000000001'] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accepted).toBe(0);
    expect(body.skipped).toBe(1);
  });

  it('batch-accept rejects invalid request (empty array)', async () => {
    const app = createBatchApp();

    const res = await app.request('/batch-accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerIds: [] }),
    });

    expect(res.status).toBe(400);
  });

  it('batch-accept rejects student access', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'student-1', email: 'student@e.ntu.edu.sg', role: 'student' });
      return next();
    });
    app.route('/', batchAcceptRoute);

    const res = await app.request('/batch-accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerIds: ['00000000-0000-4000-8000-000000000001'] }),
    });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// T12: Re-grading — triggering re-grade creates new AI job
// ---------------------------------------------------------------------------
describe('T12: Re-grading via single route', () => {
  const staffUser = { id: 'staff-1', email: 'prof@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-1' };

  function createSingleApp() {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', staffUser);
      return next();
    });
    app.route('/', singleRoute);
    return app;
  }

  it('re-grade with forceRegrade creates new job', async () => {
    const app = createSingleApp();

    // Answer with existing AI suggestion
    queryResults.push([{
      id: 'ans-1',
      questionId: 'q-1',
      submissionId: 'sub-1',
      aiGradingSuggestion: { points: 5, reasoning: 'Old grade' },
      questionType: 'written',
      userId: 'user-1',
    }]);
    // Clear existing AI suggestion (update)
    queryResults.push([]);
    // Insert new job record
    queryResults.push([{ id: 'job-2' }]);

    const res = await app.request('/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId: 'ans-1', forceRegrade: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBe('job-2');
    expect(mockAddJob).toHaveBeenCalledWith('auto-grade-written', expect.objectContaining({
      answerId: 'ans-1',
      questionId: 'q-1',
    }));
  });

  it('rejects re-grade without forceRegrade flag', async () => {
    const app = createSingleApp();

    // Answer with existing AI suggestion
    queryResults.push([{
      id: 'ans-1',
      questionId: 'q-1',
      submissionId: 'sub-1',
      aiGradingSuggestion: { points: 5, reasoning: 'Existing' },
      questionType: 'written',
      userId: 'user-1',
    }]);

    const res = await app.request('/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId: 'ans-1' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already has AI grading suggestion');
  });

  it('grades answer without existing suggestion (no forceRegrade needed)', async () => {
    const app = createSingleApp();

    // Answer without AI suggestion
    queryResults.push([{
      id: 'ans-1',
      questionId: 'q-1',
      submissionId: 'sub-1',
      aiGradingSuggestion: null,
      questionType: 'uml',
      userId: 'user-1',
    }]);
    // Insert new job record
    queryResults.push([{ id: 'job-3' }]);

    const res = await app.request('/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId: 'ans-1' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAddJob).toHaveBeenCalledWith('auto-grade-uml', expect.objectContaining({
      answerId: 'ans-1',
    }));
  });

  it('returns 404 for non-existent answer', async () => {
    const app = createSingleApp();

    // No answer found
    queryResults.push([]);

    const res = await app.request('/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId: 'non-existent' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Answer not found');
  });
});
