import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';
import type { AuthContext } from '../../middleware/auth.js';

const sendMagicLinkRoute = new Hono<AuthContext>();

// Send magic link to email
sendMagicLinkRoute.post('/send-magic-link', async (c) => {
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

export default sendMagicLinkRoute;
