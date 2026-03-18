import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listUsersRoute from './list-users.js';
import createUserRoute from './create-user.js';
import updateUserRoute from './update-user.js';
import deleteUserRoute from './delete-user.js';
import bulkCreateUsersRoute from './bulk-create-users.js';
import resetUserPasswordRoute from './reset-user-password.js';

const admin = new Hono<AuthContext>();

admin.route('/users', listUsersRoute);
admin.route('/users', createUserRoute);
admin.route('/users', updateUserRoute);
admin.route('/users', deleteUserRoute);
admin.route('/users', bulkCreateUsersRoute);
admin.route('/users', resetUserPasswordRoute);

export default admin;
