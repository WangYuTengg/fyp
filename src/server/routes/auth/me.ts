import { Hono } from 'hono';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';

const meRoute = new Hono<AuthContext>();

// Get current user info (with DB role)
meRoute.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ user });
});

export default meRoute;
