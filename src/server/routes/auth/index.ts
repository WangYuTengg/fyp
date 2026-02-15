import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import meRoute from './me.js';
import sendMagicLinkRoute from './send-magic-link.js';
import signInRoute from './signin.js';
import signOutRoute from './signout.js';
import signUpRoute from './signup.js';

const auth = new Hono<AuthContext>();

auth.route('/', meRoute);
auth.route('/', sendMagicLinkRoute);
auth.route('/', signUpRoute);
auth.route('/', signInRoute);
auth.route('/', signOutRoute);

export default auth;
