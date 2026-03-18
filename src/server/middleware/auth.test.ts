import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// T3: Auth Middleware Unit Tests — getRoleFromEmail + authMiddleware
// Tests the full auth middleware including JWT verification, Supabase
// fallback, user lookup, deactivation check, and role-from-email logic.
// ---------------------------------------------------------------------------

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
    select: () => createChainProxy(),
    insert: () => createChainProxy(),
    update: () => createChainProxy(),
  },
}));

vi.mock('../../db/schema.js', () => ({
  users: { id: 'id', email: 'email', role: 'role', supabaseId: 'supabaseId', deactivatedAt: 'deactivatedAt', name: 'name' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => [a, b],
}));

// Mock jose (JWT verification)
const mockJwtVerify = vi.fn();
vi.mock('jose', () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
}));

// Mock Supabase
const mockGetUser = vi.fn();
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

import { authMiddleware } from '../middleware/auth.js';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Test app helper
// ---------------------------------------------------------------------------
function createTestApp() {
  const app = new Hono();

  app.use('*', authMiddleware as never);
  app.get('/test', (c) => {
    const user = c.get('user');
    return c.json({ user });
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
// T3: getRoleFromEmail — tested indirectly through Supabase auto-create path
// ---------------------------------------------------------------------------
describe('T3: getRoleFromEmail (via Supabase auto-create)', () => {
  it('assigns admin role for admin email (yrloke@ntu.edu.sg)', async () => {
    const app = createTestApp();

    // Custom JWT fails
    mockJwtVerify.mockRejectedValueOnce(new Error('invalid'));

    // Supabase returns new user
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'sup-1', email: 'yrloke@ntu.edu.sg', user_metadata: { name: 'Admin' } } },
      error: null,
    });

    // User lookup by supabaseId — not found
    queryResults.push([]);
    // Insert new user — returns created user
    queryResults.push([{ id: 'user-1', email: 'yrloke@ntu.edu.sg', role: 'admin', supabaseId: 'sup-1', deactivatedAt: null }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer supabase-token' },
    });

    const body = await res.json();
    expect(body.user.role).toBe('admin');
    expect(body.user.email).toBe('yrloke@ntu.edu.sg');
  });

  it('assigns staff role for staff email pattern (@staff.main.ntu.edu.sg)', async () => {
    const app = createTestApp();

    mockJwtVerify.mockRejectedValueOnce(new Error('invalid'));
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'sup-2', email: 'john@staff.main.ntu.edu.sg', user_metadata: { name: 'Staff' } } },
      error: null,
    });

    queryResults.push([]);
    queryResults.push([{ id: 'user-2', email: 'john@staff.main.ntu.edu.sg', role: 'staff', supabaseId: 'sup-2', deactivatedAt: null }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer supabase-token' },
    });

    const body = await res.json();
    expect(body.user.role).toBe('staff');
  });

  it('assigns student role for student email pattern (@e.ntu.edu.sg)', async () => {
    const app = createTestApp();

    mockJwtVerify.mockRejectedValueOnce(new Error('invalid'));
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'sup-3', email: 'student@e.ntu.edu.sg', user_metadata: {} } },
      error: null,
    });

    queryResults.push([]);
    queryResults.push([{ id: 'user-3', email: 'student@e.ntu.edu.sg', role: 'student', supabaseId: 'sup-3', deactivatedAt: null }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer supabase-token' },
    });

    const body = await res.json();
    expect(body.user.role).toBe('student');
  });

  it('defaults to student for unknown email domain', async () => {
    const app = createTestApp();

    mockJwtVerify.mockRejectedValueOnce(new Error('invalid'));
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'sup-4', email: 'someone@gmail.com', user_metadata: {} } },
      error: null,
    });

    queryResults.push([]);
    queryResults.push([{ id: 'user-4', email: 'someone@gmail.com', role: 'student', supabaseId: 'sup-4', deactivatedAt: null }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer supabase-token' },
    });

    const body = await res.json();
    expect(body.user.role).toBe('student');
  });
});

// ---------------------------------------------------------------------------
// T3: authMiddleware — JWT verification paths
// ---------------------------------------------------------------------------
describe('T3: authMiddleware — custom JWT path', () => {
  it('valid custom JWT → user set in context', async () => {
    const app = createTestApp();

    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', email: 'student@e.ntu.edu.sg', role: 'student' },
    });

    // DB lookup for user
    queryResults.push([{ id: 'user-1', email: 'student@e.ntu.edu.sg', role: 'student', supabaseId: 'sup-1', deactivatedAt: null }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-jwt' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).not.toBeNull();
    expect(body.user.id).toBe('user-1');
    expect(body.user.role).toBe('student');
  });

  it('expired custom JWT → falls back to Supabase', async () => {
    const app = createTestApp();

    // Custom JWT fails (expired)
    mockJwtVerify.mockRejectedValueOnce(new Error('jwt expired'));

    // Supabase succeeds
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'sup-1', email: 'student@e.ntu.edu.sg' } },
      error: null,
    });

    // DB lookup by supabaseId — found existing user
    queryResults.push([{ id: 'user-1', email: 'student@e.ntu.edu.sg', role: 'student', supabaseId: 'sup-1', deactivatedAt: null }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer expired-jwt' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).not.toBeNull();
    expect(body.user.id).toBe('user-1');
    expect(mockGetUser).toHaveBeenCalledWith('expired-jwt');
  });
});

describe('T3: authMiddleware — error paths', () => {
  it('no Authorization header → user set to null', async () => {
    const app = createTestApp();

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  it('malformed Bearer token (no "Bearer " prefix) → user set to null', async () => {
    const app = createTestApp();

    const res = await app.request('/test', {
      headers: { Authorization: 'InvalidTokenFormat' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  it('deactivated user → 401 with error message', async () => {
    const app = createTestApp();

    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', email: 'deactivated@e.ntu.edu.sg', role: 'student' },
    });

    // DB lookup returns deactivated user
    queryResults.push([{
      id: 'user-1',
      email: 'deactivated@e.ntu.edu.sg',
      role: 'student',
      supabaseId: 'sup-1',
      deactivatedAt: new Date(),
    }]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-jwt' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Account deactivated');
  });

  it('custom JWT with non-existent user → user set to null', async () => {
    const app = createTestApp();

    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'deleted-user', email: 'gone@e.ntu.edu.sg', role: 'student' },
    });

    // DB returns no user
    queryResults.push([]);

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-jwt' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  it('both JWT and Supabase fail → user set to null', async () => {
    const app = createTestApp();

    mockJwtVerify.mockRejectedValueOnce(new Error('invalid'));
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer bad-token' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });
});
