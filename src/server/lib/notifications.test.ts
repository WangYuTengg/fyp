import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------
const mockInsertValues = vi.fn(() => Promise.resolve());
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockSelectWhere = vi.fn();

vi.mock('../../db/index.js', () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: () => ({
      from: () => ({
        where: () => mockSelectWhere(),
      }),
    }),
  },
}));

vi.mock('../../db/schema.js', () => ({
  staffNotifications: { __table: 'staff_notifications' },
  aiGradingJobs: { batchId: 'batch_id', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => [a, b],
}));

import {
  createNotification,
  checkBatchCompletion,
  notifyGradingCompleted,
  notifyGradingFailed,
} from './notifications';

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createNotification
// ---------------------------------------------------------------------------
describe('createNotification', () => {
  it('inserts notification with correct fields', async () => {
    await createNotification('user-1', 'grading_completed', 'Test Title', 'Test message', {
      answerId: 'a-1',
      submissionId: 's-1',
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'grading_completed',
      title: 'Test Title',
      message: 'Test message',
      data: { answerId: 'a-1', submissionId: 's-1' },
      read: false,
    });
  });

  it('sets data to null when no data provided', async () => {
    await createNotification('user-1', 'batch_completed', 'Done', 'All done');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ data: null }),
    );
  });

  it('always sets read to false', async () => {
    await createNotification('user-1', 'grading_failed', 'Failed', 'Error occurred');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ read: false }),
    );
  });
});

// ---------------------------------------------------------------------------
// notifyGradingCompleted
// ---------------------------------------------------------------------------
describe('notifyGradingCompleted', () => {
  it('creates notification with score and confidence', async () => {
    await notifyGradingCompleted('user-1', 'ans-1', 'sub-1', 8, 10, 85);

    expect(mockInsertValues).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'grading_completed',
      title: 'Auto-grading completed',
      message: 'Graded answer with 8/10 points (85% confidence)',
      data: {
        answerId: 'ans-1',
        submissionId: 'sub-1',
        points: 8,
        maxPoints: 10,
        confidence: 85,
      },
      read: false,
    });
  });
});

// ---------------------------------------------------------------------------
// notifyGradingFailed
// ---------------------------------------------------------------------------
describe('notifyGradingFailed', () => {
  it('creates failure notification with error details', async () => {
    await notifyGradingFailed('user-1', 'ans-1', 'sub-1', 'q-1', 'LLM timeout');

    expect(mockInsertValues).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'grading_failed',
      title: 'Auto-grading failed',
      message: 'Failed to auto-grade answer for submission',
      data: {
        answerId: 'ans-1',
        questionId: 'q-1',
        submissionId: 'sub-1',
        error: 'LLM timeout',
        batchId: null,
      },
      read: false,
    });
  });

  it('includes batchId when provided', async () => {
    await notifyGradingFailed('user-1', 'ans-1', 'sub-1', 'q-1', 'error', 'batch-123');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ batchId: 'batch-123' }),
      }),
    );
  });

  it('sets batchId to null when not provided', async () => {
    await notifyGradingFailed('user-1', 'ans-1', 'sub-1', 'q-1', 'error');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ batchId: null }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// checkBatchCompletion
// ---------------------------------------------------------------------------
describe('checkBatchCompletion', () => {
  it('does nothing when batchId is empty', async () => {
    await checkBatchCompletion('', 'user-1');
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it('creates notification when all jobs are completed', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
    ]);

    await checkBatchCompletion('batch-1', 'user-1');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'batch_completed',
        title: 'Batch grading completed',
        message: 'Graded 3 of 3 answers',
      }),
    );
  });

  it('includes failed count in message when some jobs failed', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { status: 'completed' },
      { status: 'completed' },
      { status: 'failed' },
    ]);

    await checkBatchCompletion('batch-1', 'user-1');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Graded 2 of 3 answers (1 failed)',
        data: expect.objectContaining({
          total: 3,
          completed: 2,
          failed: 1,
        }),
      }),
    );
  });

  it('does not create notification when jobs are still pending', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { status: 'completed' },
      { status: 'pending' },
      { status: 'processing' },
    ]);

    await checkBatchCompletion('batch-1', 'user-1');

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('handles empty batch (no jobs)', async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    await checkBatchCompletion('batch-1', 'user-1');

    // pending === 0, so notification is created
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Graded 0 of 0 answers',
      }),
    );
  });
});
