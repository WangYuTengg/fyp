import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listTagsRoute from './list-tags.js';

const tags = new Hono<AuthContext>();

tags.route('/', listTagsRoute);

export default tags;
