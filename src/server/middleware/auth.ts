import type { Context, Next } from 'hono';
import { supabase } from '../lib/supabase.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

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
 * Middleware to validate Supabase JWT and attach current user to context
 */
export async function authMiddleware(c: Context<AuthContext>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.set('user', null);
    return next();
  }

  const token = authHeader.substring(7);

  try {
    // Verify the JWT with Supabase
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
