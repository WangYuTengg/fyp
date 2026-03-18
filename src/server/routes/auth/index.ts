import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import meRoute from './me.js';
import sendMagicLinkRoute from './send-magic-link.js';
import signInRoute from './signin.js';
import signOutRoute from './signout.js';
import signUpRoute from './signup.js';
import passwordLoginRoute from './password-login.js';
import forgotPasswordRoute from './forgot-password.js';
import resetPasswordRoute from './reset-password.js';
import refreshRoute from './refresh.js';

const auth = new Hono<AuthContext>();

auth.route('/', meRoute);
auth.route('/', sendMagicLinkRoute);
auth.route('/', signUpRoute);
auth.route('/', signInRoute);
auth.route('/', signOutRoute);
auth.route('/', passwordLoginRoute);
auth.route('/', forgotPasswordRoute);
auth.route('/', resetPasswordRoute);
auth.route('/', refreshRoute);

export default auth;
