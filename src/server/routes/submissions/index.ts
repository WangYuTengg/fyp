import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listByAssignmentRoute from './list-by-assignment.js';
import getSubmissionRoute from './get-submission.js';
import startSubmissionRoute from './start-submission.js';
import saveAnswerRoute from './save-answer.js';
import submitSubmissionRoute from './submit-submission.js';
import gradeSubmissionRoute from './grade-submission.js';
import resultsRoute from './results.js';
import focusEventRoute from './focus-event.js';

const submissions = new Hono<AuthContext>();

submissions.route('/', listByAssignmentRoute);
submissions.route('/', getSubmissionRoute);
submissions.route('/', startSubmissionRoute);
submissions.route('/', saveAnswerRoute);
submissions.route('/', submitSubmissionRoute);
submissions.route('/', gradeSubmissionRoute);
submissions.route('/', resultsRoute);
submissions.route('/', focusEventRoute);

export default submissions;
