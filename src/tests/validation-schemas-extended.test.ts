import { describe, it, expect } from 'vitest';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  createQuestionSchema,
  startSubmissionSchema,
  saveAnswerSchema,
  gradeSchema,
  bulkGradeSchema,
  enrollmentSchema,
  mcqOptionSchema,
  batchAutoGradeSchema,
  createCourseSchema,
  updateCourseSchema,
  addQuestionToAssignmentSchema,
  createTagSchema,
  markNotificationReadSchema,
  validateBody,
  safeValidateBody,
} from '../server/lib/validation-schemas.js';

// ---------------------------------------------------------------------------
// createCourseSchema
// ---------------------------------------------------------------------------
describe('createCourseSchema', () => {
  it('accepts valid course data', () => {
    const result = createCourseSchema.safeParse({
      code: 'SC4001',
      name: 'Software Engineering',
      academicYear: '2025/2026',
      semester: '1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid academic year format', () => {
    const result = createCourseSchema.safeParse({
      code: 'SC4001',
      name: 'SE',
      academicYear: '2025-2026',
      semester: '1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty code', () => {
    const result = createCourseSchema.safeParse({
      code: '',
      name: 'SE',
      academicYear: '2025/2026',
      semester: '1',
    });
    expect(result.success).toBe(false);
  });

  it('defaults isActive to true', () => {
    const result = createCourseSchema.safeParse({
      code: 'SC4001',
      name: 'SE',
      academicYear: '2025/2026',
      semester: '1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updateCourseSchema
// ---------------------------------------------------------------------------
describe('updateCourseSchema', () => {
  it('accepts partial updates', () => {
    expect(updateCourseSchema.safeParse({ name: 'New Name' }).success).toBe(true);
    expect(updateCourseSchema.safeParse({}).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createAssignmentSchema
// ---------------------------------------------------------------------------
describe('createAssignmentSchema', () => {
  const validAssignment = {
    courseId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Midterm Exam',
  };

  it('accepts valid assignment with required fields only', () => {
    const result = createAssignmentSchema.safeParse(validAssignment);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = createAssignmentSchema.safeParse(validAssignment);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxAttempts).toBe(1);
      expect(result.data.latePenaltyType).toBe('none');
      expect(result.data.attemptScoringMethod).toBe('latest');
      expect(result.data.isPublished).toBe(false);
      expect(result.data.mcqPenaltyPerWrongSelection).toBe(1);
    }
  });

  it('accepts all late penalty types', () => {
    for (const type of ['none', 'fixed', 'per_day', 'per_hour']) {
      const result = createAssignmentSchema.safeParse({
        ...validAssignment,
        latePenaltyType: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid late penalty type', () => {
    const result = createAssignmentSchema.safeParse({
      ...validAssignment,
      latePenaltyType: 'per_minute',
    });
    expect(result.success).toBe(false);
  });

  it('rejects latePenaltyValue over 100', () => {
    const result = createAssignmentSchema.safeParse({
      ...validAssignment,
      latePenaltyValue: 150,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative latePenaltyValue', () => {
    const result = createAssignmentSchema.safeParse({
      ...validAssignment,
      latePenaltyValue: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects maxAttempts less than 1', () => {
    const result = createAssignmentSchema.safeParse({
      ...validAssignment,
      maxAttempts: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer timeLimit', () => {
    const result = createAssignmentSchema.safeParse({
      ...validAssignment,
      timeLimit: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = createAssignmentSchema.safeParse({
      courseId: '550e8400-e29b-41d4-a716-446655440000',
      title: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid courseId', () => {
    const result = createAssignmentSchema.safeParse({
      courseId: 'not-a-uuid',
      title: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('accepts both scoring methods', () => {
    for (const method of ['latest', 'highest']) {
      const result = createAssignmentSchema.safeParse({
        ...validAssignment,
        attemptScoringMethod: method,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updateAssignmentSchema
// ---------------------------------------------------------------------------
describe('updateAssignmentSchema', () => {
  it('accepts partial assignment updates', () => {
    expect(updateAssignmentSchema.safeParse({ title: 'New Title' }).success).toBe(true);
    expect(updateAssignmentSchema.safeParse({ latePenaltyType: 'fixed' }).success).toBe(true);
    expect(updateAssignmentSchema.safeParse({}).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createQuestionSchema
// ---------------------------------------------------------------------------
describe('createQuestionSchema', () => {
  it('accepts valid question', () => {
    const result = createQuestionSchema.safeParse({
      type: 'mcq',
      title: 'What is OOP?',
      content: { prompt: 'Explain OOP', options: [] },
    });
    expect(result.success).toBe(true);
  });

  it('accepts all question types', () => {
    for (const type of ['mcq', 'written', 'uml']) {
      const result = createQuestionSchema.safeParse({
        type,
        title: 'Question',
        content: {},
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid question type', () => {
    const result = createQuestionSchema.safeParse({
      type: 'essay',
      title: 'Question',
      content: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = createQuestionSchema.safeParse({
      type: 'mcq',
      title: '',
      content: {},
    });
    expect(result.success).toBe(false);
  });

  it('defaults points to 10', () => {
    const result = createQuestionSchema.safeParse({
      type: 'mcq',
      title: 'Q',
      content: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.points).toBe(10);
    }
  });

  it('rejects negative points', () => {
    const result = createQuestionSchema.safeParse({
      type: 'mcq',
      title: 'Q',
      content: {},
      points: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enrollmentSchema
// ---------------------------------------------------------------------------
describe('enrollmentSchema', () => {
  const valid = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    courseId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'student' as const,
  };

  it('accepts valid enrollment', () => {
    expect(enrollmentSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts all enrollment roles', () => {
    for (const role of ['lecturer', 'ta', 'lab_exec', 'student']) {
      expect(enrollmentSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });

  it('rejects non-uuid userId', () => {
    expect(enrollmentSchema.safeParse({ ...valid, userId: 'bad' }).success).toBe(false);
  });

  it('rejects invalid role', () => {
    expect(enrollmentSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Submission schemas
// ---------------------------------------------------------------------------
describe('startSubmissionSchema', () => {
  it('accepts valid assignmentId', () => {
    const result = startSubmissionSchema.safeParse({
      assignmentId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid', () => {
    expect(startSubmissionSchema.safeParse({ assignmentId: 'bad' }).success).toBe(false);
  });
});

describe('saveAnswerSchema', () => {
  it('accepts valid answer', () => {
    const result = saveAnswerSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      content: { selectedOptionIds: ['a'] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid questionId', () => {
    expect(
      saveAnswerSchema.safeParse({ questionId: 'bad', content: {} }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// gradeSchema / bulkGradeSchema
// ---------------------------------------------------------------------------
describe('gradeSchema', () => {
  it('accepts valid grade', () => {
    const result = gradeSchema.safeParse({
      answerId: '550e8400-e29b-41d4-a716-446655440000',
      points: 8,
      maxPoints: 10,
    });
    expect(result.success).toBe(true);
  });

  it('allows negative points (penalty)', () => {
    const result = gradeSchema.safeParse({
      answerId: '550e8400-e29b-41d4-a716-446655440000',
      points: -2,
      maxPoints: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative maxPoints', () => {
    const result = gradeSchema.safeParse({
      answerId: '550e8400-e29b-41d4-a716-446655440000',
      points: 5,
      maxPoints: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('bulkGradeSchema', () => {
  it('accepts array of grades', () => {
    const result = bulkGradeSchema.safeParse({
      grades: [
        { answerId: '550e8400-e29b-41d4-a716-446655440000', points: 5, maxPoints: 10 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty grades array', () => {
    expect(bulkGradeSchema.safeParse({ grades: [] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mcqOptionSchema
// ---------------------------------------------------------------------------
describe('mcqOptionSchema', () => {
  it('accepts valid option', () => {
    expect(mcqOptionSchema.safeParse({ id: 'a', text: 'Option A' }).success).toBe(true);
  });

  it('accepts option with isCorrect', () => {
    expect(mcqOptionSchema.safeParse({ id: 'a', text: 'A', isCorrect: true }).success).toBe(true);
  });

  it('rejects empty text', () => {
    expect(mcqOptionSchema.safeParse({ id: 'a', text: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// batchAutoGradeSchema
// ---------------------------------------------------------------------------
describe('batchAutoGradeSchema', () => {
  it('accepts valid batch auto-grade request', () => {
    const result = batchAutoGradeSchema.safeParse({
      assignmentId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts questionTypes filter', () => {
    const result = batchAutoGradeSchema.safeParse({
      assignmentId: '550e8400-e29b-41d4-a716-446655440000',
      questionTypes: ['written', 'uml'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid question type in filter', () => {
    const result = batchAutoGradeSchema.safeParse({
      assignmentId: '550e8400-e29b-41d4-a716-446655440000',
      questionTypes: ['mcq'],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addQuestionToAssignmentSchema
// ---------------------------------------------------------------------------
describe('addQuestionToAssignmentSchema', () => {
  it('accepts valid data', () => {
    const result = addQuestionToAssignmentSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      order: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative order', () => {
    const result = addQuestionToAssignmentSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      order: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tag & Notification schemas
// ---------------------------------------------------------------------------
describe('createTagSchema', () => {
  it('accepts valid tag', () => {
    const result = createTagSchema.safeParse({
      courseId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'UML',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createTagSchema.safeParse({
      courseId: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('markNotificationReadSchema', () => {
  it('accepts valid notification ID', () => {
    const result = markNotificationReadSchema.safeParse({
      notificationId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid', () => {
    expect(markNotificationReadSchema.safeParse({ notificationId: 'bad' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateBody / safeValidateBody helpers
// ---------------------------------------------------------------------------
describe('validateBody', () => {
  it('returns parsed data for valid input', () => {
    const result = validateBody(enrollmentSchema, {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      courseId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'student',
    });
    expect(result.role).toBe('student');
  });

  it('throws for invalid input', () => {
    expect(() => validateBody(enrollmentSchema, { userId: 'bad' })).toThrow();
  });
});

describe('safeValidateBody', () => {
  it('returns success with data for valid input', () => {
    const result = safeValidateBody(enrollmentSchema, {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      courseId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'student',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('student');
    }
  });

  it('returns error message for invalid input', () => {
    const result = safeValidateBody(enrollmentSchema, { userId: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    }
  });
});
