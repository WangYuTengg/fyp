import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import batchRoute from './batch.js';
import queueRoute from './queue.js';
import statsRoute from './stats.js';
import singleRoute from './single.js';
import acceptRoute from './accept.js';
import rejectRoute from './reject.js';
import assignmentsRoute from './assignments.js';
import batchAcceptRoute from './batch-accept.js';

const autoGrade = new Hono<AuthContext>();

autoGrade.route('/', batchRoute);
autoGrade.route('/', queueRoute);
autoGrade.route('/', statsRoute);
autoGrade.route('/', singleRoute);
autoGrade.route('/', acceptRoute);
autoGrade.route('/', rejectRoute);
autoGrade.route('/', assignmentsRoute);
autoGrade.route('/', batchAcceptRoute);

export default autoGrade;
