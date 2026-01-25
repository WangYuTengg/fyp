# Authentication with Supabase

## Supabase Setup

Two Supabase clients:
1. **Client-side** (`src/lib/supabase.ts`) - For browser authentication
2. **Server-side** (`src/server/lib/supabase.ts`) - For token validation

### Client-side Configuration

`src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Server-side Configuration

`src/server/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Authentication Flow

### 1. User Sign-In (Client)

```typescript
import { supabase } from '@/lib/supabase';

async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}
```

### 2. Magic Link (Email OTP)

```typescript
async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) throw error;
}
```

### 3. Session Management (Client)

```typescript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session?.user);
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  }
});
```

## Auth Context (React)

`src/client/contexts/AuthContext.tsx`:
```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  const signOut = async () => {
    await supabase.auth.signOut();
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

## Protected Routes (TanStack Router)

`src/client/lib/route-guards.ts`:
```typescript
import { redirect } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw redirect({ to: '/login' });
  }
  
  return session;
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireAuth();
  
  // Fetch user profile from your database
  const response = await fetch('/api/users/me', {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });
  
  const { data: user } = await response.json();
  
  if (!allowedRoles.includes(user.role)) {
    throw redirect({ to: '/' });
  }
  
  return { session, user };
}
```

Usage in route:
```typescript
// src/client/routes/student.tsx
import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '@/lib/route-guards';

export const Route = createFileRoute('/student')({
  beforeLoad: async () => {
    await requireRole(['student']);
  },
  component: StudentDashboard,
});
```

## Server Middleware

`src/server/middleware/auth.ts`:
```typescript
import { Context, Next } from 'hono';
import { supabase } from '../lib/supabase';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing authorization token' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return c.json({ success: false, error: 'Invalid token' }, 401);
    }
    
    // Fetch user profile from database
    const [profile] = await db.select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    
    if (!profile) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    // Attach user to context
    c.set('user', profile);
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ success: false, error: 'Authentication failed' }, 401);
  }
}
```

## Making Authenticated API Requests

Client-side utility (`src/client/lib/api.ts`):
```typescript
import { supabase } from '@/lib/supabase';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Request failed: ${response.statusText}`);
  }
  
  return response.json();
}

// Usage
const courses = await fetchWithAuth('/api/courses');
```

## User Profile Sync

Keep Supabase auth users in sync with your `users` table:

```typescript
// Listen for new sign-ups (use Supabase webhook or trigger)
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    // Check if user exists in database
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    
    if (!existingUser) {
      // Create user profile
      await db.insert(users).values({
        id: session.user.id,
        email: session.user.email!,
        role: 'student', // Default role
      });
    }
  }
});
```

## Password Reset

```typescript
// Request password reset
async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) throw error;
}

// Update password (after clicking reset link)
async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) throw error;
}
```

## Email Configuration

Ensure Supabase site URL and redirect URLs are configured:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set **Site URL**: `http://localhost:5173` (dev) or your production URL
3. Add **Redirect URLs**: `http://localhost:5173/auth/callback`, etc.

See project's `SUPABASE_EMAIL_CONFIG.md` for detailed email OTP setup.
