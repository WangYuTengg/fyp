import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB — chainable proxy (same pattern as auto-submit-expired.test.ts)
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
    delete: () => createChainProxy(),
  },
}));

vi.mock('../../db/schema.js', () => ({
  users: { id: 'id', email: 'email', passwordHash: 'passwordHash', role: 'role', deactivatedAt: 'deactivatedAt', supabaseId: 'supabaseId', name: 'name' },
  passwordResetTokens: { id: 'id', userId: 'userId', token: 'token', expiresAt: 'expiresAt', usedAt: 'usedAt', createdAt: 'createdAt' },
  refreshTokens: { id: 'id', userId: 'userId', token: 'token', expiresAt: 'expiresAt', usedAt: 'usedAt', createdAt: 'createdAt' },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  sql: (strings: TemplateStringsArray) => strings.join(''),
  gte: (a: unknown, b: unknown) => [a, b],
  isNull: (a: unknown) => a,
  relations: () => ({}),
  pgTable: () => ({}),
  pgEnum: () => ({}),
}));

// Mock bcryptjs
const mockCompare = vi.fn();
const mockHash = vi.fn();
vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
    hash: (...args: unknown[]) => mockHash(...args),
  },
}));

// Mock jose (JWT)
vi.mock('jose', () => {
  class MockSignJWT {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return 'mock-jwt-token'; }
  }
  return {
    SignJWT: MockSignJWT,
    jwtVerify: vi.fn(),
  };
});

// Mock Supabase
vi.mock('../../server/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }),
      signInWithPassword: vi.fn(),
      signInWithOtp: vi.fn(),
    },
  },
}));

// Mock email
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../server/lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  buildPasswordResetEmail: vi.fn(() => '<html>Reset</html>'),
}));

// Mock validation schemas — pass-through for any non-empty body
vi.mock('../../server/lib/validation-schemas.js', () => ({
  safeValidateBody: vi.fn((_schema: unknown, body: unknown) => {
    const b = body as Record<string, unknown>;
    if (b && Object.keys(b).length > 0) {
      return { success: true, data: b };
    }
    return { success: false, error: 'Validation failed' };
  }),
  loginSchema: {},
  forgotPasswordSchema: {},
  resetPasswordSchema: {},
}));

// Mock auth middleware to pass through (we test routes directly)
vi.mock('../../server/middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c: unknown, next: () => Promise<void>) => {
    const ctx = c as { set: (k: string, v: unknown) => void; req: { header: (h: string) => string | undefined } };
    // By default, set user to null (unauthenticated)
    ctx.set('user', null);
    return next();
  }),
  requireAuth: vi.fn((c: unknown, next: () => Promise<void>) => {
    const ctx = c as { get: (k: string) => unknown; json: (body: unknown, status?: number) => unknown };
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    return next();
  }),
  requireRole: vi.fn(() => {
    return (_c: unknown, next: () => Promise<void>) => next();
  }),
}));

// Import routes after mocks
import passwordLoginRoute from '../../server/routes/auth/password-login.js';
import forgotPasswordRoute from '../../server/routes/auth/forgot-password.js';
import resetPasswordRoute from '../../server/routes/auth/reset-password.js';
import meRoute from '../../server/routes/auth/me.js';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------
function createTestApp() {
  const app = new Hono();

  // Inject mock auth middleware for /me tests
  app.use('/me', async (c, next) => {
    // Check for test user header
    const authHeader = c.req.header('X-Test-User');
    if (authHeader) {
      const user = JSON.parse(authHeader);
      c.set('user', user);
    } else {
      c.set('user', null);
    }
    return next();
  });

  app.route('/', passwordLoginRoute);
  app.route('/', forgotPasswordRoute);
  app.route('/', resetPasswordRoute);
  app.route('/', meRoute);
  return app;
}

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  queryResults.length = 0;
  queryIndex = 0;
});

// ---------------------------------------------------------------------------
// T9: Integration Tests — Auth Flow
// ---------------------------------------------------------------------------
describe('T9: Auth Flow — POST /password-login', () => {
  it('returns JWT token for valid credentials', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'user-1', email: 'student@e.ntu.edu.sg', passwordHash: '$2a$10$hashed', role: 'student', name: 'Test Student', deactivatedAt: null }],
    );
    mockCompare.mockResolvedValueOnce(true);

    const res = await app.request('/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@e.ntu.edu.sg', password: 'password123' }),
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.token).toBe('mock-jwt-token');
    expect(body.user.email).toBe('student@e.ntu.edu.sg');
    expect(body.user.role).toBe('student');
  });

  it('returns 401 for invalid credentials', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'user-1', email: 'student@e.ntu.edu.sg', passwordHash: '$2a$10$hashed', role: 'student', name: 'Test', deactivatedAt: null }],
    );
    mockCompare.mockResolvedValueOnce(false);

    const res = await app.request('/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@e.ntu.edu.sg', password: 'wrong' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid email or password');
  });

  it('returns 401 for non-existent user', async () => {
    const app = createTestApp();

    queryResults.push([]); // no user found

    const res = await app.request('/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@e.ntu.edu.sg', password: 'pass' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid email or password');
  });

  it('returns 401 for deactivated user', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'user-1', email: 'deactivated@e.ntu.edu.sg', passwordHash: '$2a$10$hash', role: 'student', name: 'Deactivated', deactivatedAt: new Date() }],
    );

    const res = await app.request('/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deactivated@e.ntu.edu.sg', password: 'pass' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Account deactivated');
  });

  it('returns 400 for invalid request body', async () => {
    const app = createTestApp();
    const { safeValidateBody } = await import('../../server/lib/validation-schemas.js');
    vi.mocked(safeValidateBody).mockReturnValueOnce({ success: false, error: 'Validation failed' } as never);

    const res = await app.request('/password-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe('T9: Auth Flow — POST /forgot-password', () => {
  it('sends reset email for existing user', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'user-1', email: 'test@e.ntu.edu.sg', deactivatedAt: null }], // user lookup
      [{ count: 0 }],    // rate limit check
      [],                  // insert token
    );

    const res = await app.request('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@e.ntu.edu.sg' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('reset link has been sent');
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('returns success even for non-existent user (prevents enumeration)', async () => {
    const app = createTestApp();

    queryResults.push([]); // no user found

    const res = await app.request('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@e.ntu.edu.sg' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('reset link has been sent');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('silently rate limits when too many requests', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'user-1', email: 'test@e.ntu.edu.sg', deactivatedAt: null }],
      [{ count: 3 }], // already at limit
    );

    const res = await app.request('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@e.ntu.edu.sg' }),
    });

    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('T9: Auth Flow — POST /reset-password', () => {
  it('resets password with valid token', async () => {
    const app = createTestApp();

    queryResults.push(
      [{ id: 'token-1', userId: 'user-1', token: 'valid-uuid', expiresAt: new Date(Date.now() + 3600000), usedAt: null }],
      [], // update user password
      [], // mark token used
    );
    mockHash.mockResolvedValueOnce('$2a$10$newhash');

    const res = await app.request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'valid-uuid', password: 'newPassword123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Password reset successfully');
    expect(mockHash).toHaveBeenCalledWith('newPassword123', 10);
  });

  it('returns 400 for expired token', async () => {
    const app = createTestApp();

    queryResults.push([]); // no valid token found

    const res = await app.request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'expired-uuid', password: 'newPassword123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired reset token');
  });
});

describe('T9: Auth Flow — GET /me', () => {
  it('returns current user with roles', async () => {
    const app = createTestApp();
    const testUser = { id: 'user-1', email: 'admin@ntu.edu.sg', role: 'admin', supabaseId: 'sup-1' };

    const res = await app.request('/me', {
      method: 'GET',
      headers: { 'X-Test-User': JSON.stringify(testUser) },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('user-1');
    expect(body.user.role).toBe('admin');
  });

  it('returns 401 when not authenticated', async () => {
    const app = createTestApp();

    const res = await app.request('/me', { method: 'GET' });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});
