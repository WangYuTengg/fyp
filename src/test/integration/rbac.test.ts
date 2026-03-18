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
    delete: (..._args: unknown[]) => createChainProxy(),
  },
}));

vi.mock('../../db/schema.js', () => ({
  users: { id: 'id', email: 'email', role: 'role', deactivatedAt: 'deactivatedAt', supabaseId: 'supabaseId', name: 'name' },
  submissions: { id: 'id', assignmentId: 'assignmentId', userId: 'userId', status: 'status' },
  assignments: { id: 'id', courseId: 'courseId' },
  answers: { id: 'id', submissionId: 'submissionId', questionId: 'questionId', aiGradingSuggestion: 'aiGradingSuggestion' },
  questions: { id: 'id', type: 'type', content: 'content', points: 'points' },
  marks: { id: 'id', submissionId: 'submissionId', answerId: 'answerId' },
  enrollments: { userId: 'userId', courseId: 'courseId', role: 'role' },
  courses: { id: 'id', name: 'name' },
  assignmentQuestions: { assignmentId: 'assignmentId', questionId: 'questionId' },
  aiGradingJobs: { id: 'id', status: 'status' },
  staffNotifications: {},
  systemSettings: { key: 'key', value: 'value' },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => strings.join(''),
  desc: (a: unknown) => a,
  asc: (a: unknown) => a,
  count: () => 'count',
  inArray: (col: unknown, vals: unknown[]) => [col, vals],
  gte: (a: unknown, b: unknown) => [a, b],
  isNull: (a: unknown) => a,
  relations: () => ({}),
  pgTable: () => ({}),
  pgEnum: () => ({}),
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn().mockRejectedValue(new Error('invalid token')),
  SignJWT: vi.fn(),
}));

vi.mock('../../server/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }),
    },
  },
}));

vi.mock('../../server/lib/content-utils.js', () => ({
  getAiGradingSuggestion: vi.fn(() => ({ points: 8, reasoning: 'Good answer' })),
  getQuestionContent: vi.fn(() => ({})),
  getAnswerContent: vi.fn(() => ({})),
}));

vi.mock('../../server/lib/error-utils.js', () => ({
  getErrorMessage: vi.fn((e: unknown) => String(e)),
}));

import { Hono } from 'hono';
import { requireAuth, requireRole, type AuthContext } from '../../server/middleware/auth.js';

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------
const adminUser = { id: 'admin-1', email: 'yrloke@ntu.edu.sg', role: 'admin', supabaseId: 'sup-admin' };
const staffUser = { id: 'staff-1', email: 'prof@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-staff' };
const studentUser = { id: 'student-1', email: 'student@e.ntu.edu.sg', role: 'student', supabaseId: 'sup-student' };

// ---------------------------------------------------------------------------
// App factories
// ---------------------------------------------------------------------------
function createAppWithUser(user: Record<string, string> | null) {
  const app = new Hono<AuthContext>();
  // Inject user into context
  app.use('*', async (c, next) => {
    c.set('user', user as AuthContext['Variables']['user']);
    return next();
  });
  return app;
}

function createProtectedApp(user: Record<string, string> | null) {
  const app = createAppWithUser(user);

  // Test routes that use requireAuth
  app.get('/api/auth/me', requireAuth, async (c) => {
    const u = c.get('user');
    return c.json({ user: u });
  });

  // Test routes with requireRole
  app.get('/api/admin/users', requireRole('admin'), async (c) => {
    return c.json({ success: true, data: [] });
  });

  app.get('/api/staff/grading', requireRole('staff', 'admin'), async (c) => {
    return c.json({ success: true, data: [] });
  });

  app.get('/api/courses', requireAuth, async (c) => {
    return c.json({ success: true, data: [] });
  });

  return app;
}

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  queryResults.length = 0;
  queryIndex = 0;
});

// ---------------------------------------------------------------------------
// T11: Integration Tests — RBAC & Authorization
// ---------------------------------------------------------------------------
describe('T11: RBAC — requireAuth middleware', () => {
  it('allows authenticated users through', async () => {
    const app = createProtectedApp(studentUser);

    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('student-1');
  });

  it('blocks unauthenticated requests with 401', async () => {
    const app = createProtectedApp(null);

    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});

describe('T11: RBAC — requireRole middleware', () => {
  it('admin can access admin-only routes', async () => {
    const app = createProtectedApp(adminUser);

    const res = await app.request('/api/admin/users');
    expect(res.status).toBe(200);
  });

  it('staff cannot access admin-only routes', async () => {
    const app = createProtectedApp(staffUser);

    const res = await app.request('/api/admin/users');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('student cannot access admin routes', async () => {
    const app = createProtectedApp(studentUser);

    const res = await app.request('/api/admin/users');
    expect(res.status).toBe(403);
  });

  it('staff can access staff routes', async () => {
    const app = createProtectedApp(staffUser);

    const res = await app.request('/api/staff/grading');
    expect(res.status).toBe(200);
  });

  it('admin can access staff routes (admin bypass)', async () => {
    const app = createProtectedApp(adminUser);

    const res = await app.request('/api/staff/grading');
    expect(res.status).toBe(200);
  });

  it('student cannot access staff routes', async () => {
    const app = createProtectedApp(studentUser);

    const res = await app.request('/api/staff/grading');
    expect(res.status).toBe(403);
  });

  it('unauthenticated user gets 401 on role-protected routes', async () => {
    const app = createProtectedApp(null);

    const res = await app.request('/api/admin/users');
    expect(res.status).toBe(401);
  });
});

describe('T11: RBAC — Auto-grade role checks (staff-only)', () => {
  // Accept/reject routes enforce `user.role !== 'staff' && user.role !== 'admin'`.
  // We test this pattern directly with inline handlers that mirror the route logic,
  // since the actual routes bind authMiddleware internally.

  function createStaffOnlyApp(user: Record<string, string> | null) {
    const app = new Hono<AuthContext>();
    app.use('*', async (c, next) => {
      c.set('user', user as AuthContext['Variables']['user']);
      return next();
    });

    // Mirror the accept/reject role check pattern
    app.post('/api/auto-grade/:answerId/accept', async (c) => {
      const u = c.get('user');
      if (!u || (u.role !== 'staff' && u.role !== 'admin')) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      return c.json({ success: true, action: 'accepted' });
    });

    app.post('/api/auto-grade/:answerId/reject', async (c) => {
      const u = c.get('user');
      if (!u || (u.role !== 'staff' && u.role !== 'admin')) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      const body = await c.req.json();
      if (typeof body.points !== 'number' || body.points < 0 || body.points > 10) {
        return c.json({ error: `Points must be between 0 and 10` }, 400);
      }
      return c.json({ success: true, action: 'rejected', points: body.points });
    });

    return app;
  }

  it('staff can accept AI grading suggestion', async () => {
    const app = createStaffOnlyApp(staffUser);
    const res = await app.request('/api/auto-grade/ans-1/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('admin can accept AI grading suggestion', async () => {
    const app = createStaffOnlyApp(adminUser);
    const res = await app.request('/api/auto-grade/ans-1/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(200);
  });

  it('student cannot accept AI grading suggestion', async () => {
    const app = createStaffOnlyApp(studentUser);
    const res = await app.request('/api/auto-grade/ans-1/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('staff can reject AI suggestion with manual grade', async () => {
    const app = createStaffOnlyApp(staffUser);
    const res = await app.request('/api/auto-grade/ans-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: 5, feedback: 'Missing key concepts' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.points).toBe(5);
  });

  it('student cannot reject AI suggestion', async () => {
    const app = createStaffOnlyApp(studentUser);
    const res = await app.request('/api/auto-grade/ans-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: 10, feedback: 'I deserve full marks' }),
    });
    expect(res.status).toBe(403);
  });

  it('reject validates points range', async () => {
    const app = createStaffOnlyApp(staffUser);
    const res = await app.request('/api/auto-grade/ans-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: 15, feedback: 'bonus' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Points must be between');
  });

  it('unauthenticated user cannot access auto-grade endpoints', async () => {
    const app = createStaffOnlyApp(null);
    const res = await app.request('/api/auto-grade/ans-1/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(403);
  });
});

describe('T11: RBAC — Cross-role isolation', () => {
  it('all authenticated roles can access common routes', async () => {
    for (const user of [adminUser, staffUser, studentUser]) {
      const app = createProtectedApp(user);
      const res = await app.request('/api/courses');
      expect(res.status).toBe(200);
    }
  });

  it('role hierarchy: admin > staff > student', async () => {
    // Admin accesses everything
    const adminApp = createProtectedApp(adminUser);
    expect((await adminApp.request('/api/admin/users')).status).toBe(200);
    expect((await adminApp.request('/api/staff/grading')).status).toBe(200);
    expect((await adminApp.request('/api/courses')).status).toBe(200);

    // Staff accesses staff + common, not admin
    const staffApp = createProtectedApp(staffUser);
    expect((await staffApp.request('/api/admin/users')).status).toBe(403);
    expect((await staffApp.request('/api/staff/grading')).status).toBe(200);
    expect((await staffApp.request('/api/courses')).status).toBe(200);

    // Student accesses common only
    const studentApp = createProtectedApp(studentUser);
    expect((await studentApp.request('/api/admin/users')).status).toBe(403);
    expect((await studentApp.request('/api/staff/grading')).status).toBe(403);
    expect((await studentApp.request('/api/courses')).status).toBe(200);
  });
});
