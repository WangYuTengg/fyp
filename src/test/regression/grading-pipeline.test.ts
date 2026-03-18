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
  aiGradingJobs: { id: 'id', status: 'status', tokensUsed: 'tokensUsed', cost: 'cost', completedAt: 'completedAt', error: 'error' },
  aiUsageStats: { date: 'date', totalTokens: 'totalTokens', totalCost: 'totalCost', requestCount: 'requestCount', successCount: 'successCount', failureCount: 'failureCount', avgProcessingTime: 'avgProcessingTime' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => [a, b],
  and: (...args: unknown[]) => args,
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

import autoGradeWritten from '../../server/jobs/auto-grade-written.js';
import autoGradeUML from '../../server/jobs/auto-grade-uml.js';
import { checkBatchCompletion, notifyGradingFailed } from '../../server/lib/notifications.js';

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
      [], // update job → failed
      [], // usage stats check → none
      [], // insert failure stats
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
  it('accepting AI grade creates mark with correct fields', async () => {
    // This tests the data flow through the accept endpoint
    const { Hono } = await import('hono');
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'staff-1', email: 'prof@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-1' });
      return next();
    });

    const { default: acceptRoute } = await import('../../server/routes/auto-grade/accept.js');
    app.route('/', acceptRoute);

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
    const { Hono } = await import('hono');
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'staff-1', email: 'prof@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-1' });
      return next();
    });

    const { default: rejectRoute } = await import('../../server/routes/auto-grade/reject.js');
    app.route('/', rejectRoute);

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
    const { Hono } = await import('hono');
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user', { id: 'staff-1', email: 'prof@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-1' });
      return next();
    });

    const { getAiGradingSuggestion } = await import('../../server/lib/content-utils.js');
    vi.mocked(getAiGradingSuggestion).mockReturnValueOnce(null);

    const { default: acceptRoute } = await import('../../server/routes/auto-grade/accept.js');
    app.route('/', acceptRoute);

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
