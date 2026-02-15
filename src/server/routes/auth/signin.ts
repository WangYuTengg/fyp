import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';
import type { AuthContext } from '../../middleware/auth.js';

const signInRoute = new Hono<AuthContext>();

// Sign in endpoint
signInRoute.post('/signin', async (c) => {
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

export default signInRoute;
