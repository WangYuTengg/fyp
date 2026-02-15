import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';
import type { AuthContext } from '../../middleware/auth.js';

const signUpRoute = new Hono<AuthContext>();

// Sign up endpoint
signUpRoute.post('/signup', async (c) => {
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

export default signUpRoute;
