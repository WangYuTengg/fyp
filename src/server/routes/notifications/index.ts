import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listNotificationsRoute from './list-notifications.js';
import unreadCountRoute from './unread-count.js';
import markReadRoute from './mark-read.js';
import markAllReadRoute from './mark-all-read.js';

const notifications = new Hono<AuthContext>();

notifications.route('/', listNotificationsRoute);
notifications.route('/', unreadCountRoute);
notifications.route('/', markReadRoute);
notifications.route('/', markAllReadRoute);

export default notifications;
