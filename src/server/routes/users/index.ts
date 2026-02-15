import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listStudentsRoute from './list-students.js';

const users = new Hono<AuthContext>();

users.route('/', listStudentsRoute);

export default users;
