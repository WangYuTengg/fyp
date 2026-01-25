import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';

const auth = new Hono<AuthContext>();

// Get current user info (with DB role)
auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ user });
});

// Send magic link to email
auth.post('/send-magic-link', async (c) => {
  const { email } = await c.req.json();
  
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/`,
    },
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ message: 'Magic link sent to email', data });
});

// Sign up endpoint
auth.post('/signup', async (c) => {
  const { email, password } = await c.req.json();
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ user: data.user });
});

// Sign in endpoint
auth.post('/signin', async (c) => {
  const { email, password } = await c.req.json();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ user: data.user, session: data.session });
});

// Sign out endpoint
auth.post('/signout', async (c) => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ message: 'Signed out successfully' });
});

export default auth;
