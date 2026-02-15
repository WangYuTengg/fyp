import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';
import type { AuthContext } from '../../middleware/auth.js';

const signOutRoute = new Hono<AuthContext>();

// Sign out endpoint
signOutRoute.post('/signout', async (c) => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ message: 'Signed out successfully' });
});

export default signOutRoute;
