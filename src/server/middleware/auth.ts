import type { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import { supabase } from '../lib/supabase.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

// Extend Hono context to include user
export type AuthContext = {
  Variables: {
    user: {
      id: string;
      email: string;
      role: string;
      supabaseId: string;
    } | null;
  };
};

/**
 * Determine user role based on email pattern
 */
function getRoleFromEmail(email: string): 'admin' | 'staff' | 'student' {
  // Check for admin
  if (email === 'yrloke@ntu.edu.sg') {
    return 'admin';
  }

  // Check for staff
  if (email.endsWith('staff.main.ntu.edu.sg')) {
    return 'staff';
  }

  // Check for student
  if (email.endsWith('@e.ntu.edu.sg')) {
    return 'student';
  }

  // Default to student
  return 'student';
}

/**
 * Try to verify token as a custom JWT (password-based login)
 */
async function tryCustomJwt(token: string): Promise<{ id: string; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.sub && payload.email) {
      return {
        id: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Middleware to validate JWT (custom or Supabase) and attach current user to context
 */
export async function authMiddleware(c: Context<AuthContext>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.set('user', null);
    return next();
  }

  const token = authHeader.substring(7);

  try {
    // Try custom JWT first (fast, local verification)
    const customUser = await tryCustomJwt(token);
    if (customUser) {
      // Verify user still exists and fetch current role from DB
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, customUser.id))
        .limit(1);

      if (!dbUser) {
        c.set('user', null);
        return next();
      }

      if (dbUser.deactivatedAt) {
        c.set('user', null);
        return c.json({ error: 'Account deactivated' }, 401);
      }

      c.set('user', {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        supabaseId: dbUser.supabaseId ?? '',
      });

      return next();
    }

    // Fallback: Verify the JWT with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      c.set('user', null);
      return next();
    }

    // Find or create user in our database
    let [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseId, supabaseUser.id))
      .limit(1);

    // Auto-create user if they don't exist (first login)
    if (!dbUser) {
      const role = getRoleFromEmail(supabaseUser.email!);
      [dbUser] = await db
        .insert(users)
        .values({
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.name || null,
          supabaseId: supabaseUser.id,
          role, // Role determined by email
        })
        .returning();
    }

    // Check if user is deactivated
    if (dbUser.deactivatedAt) {
      c.set('user', null);
      return c.json({ error: 'Account deactivated' }, 401);
    }

    // Attach user to context
    c.set('user', {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      supabaseId: dbUser.supabaseId!,
    });

    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    c.set('user', null);
    return next();
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(c: Context<AuthContext>, next: Next) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: string[]) {
  return (c: Context<AuthContext>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Admins can access everything by default.
    if (user.role === 'admin') {
      return next();
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return next();
  };
}
