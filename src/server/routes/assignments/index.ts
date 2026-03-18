import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listAssignmentsRoute from './list-assignments.js';
import getAssignmentRoute from './get-assignment.js';
import createAssignmentRoute from './create-assignment.js';
import publishAssignmentRoute from './publish-assignment.js';
import deleteAssignmentRoute from './delete-assignment.js';
import addQuestionsRoute from './add-questions.js';
import removeQuestionRoute from './remove-question.js';
import reorderQuestionsRoute from './reorder-questions.js';
import publishResultsRoute from './publish-results.js';
import analyticsRoute from './analytics.js';
import exportGradesRoute from './export-grades.js';
import cloneAssignmentRoute from './clone-assignment.js';

const assignments = new Hono<AuthContext>();

assignments.route('/', listAssignmentsRoute);
assignments.route('/', getAssignmentRoute);
assignments.route('/', createAssignmentRoute);
assignments.route('/', publishAssignmentRoute);
assignments.route('/', deleteAssignmentRoute);
assignments.route('/', addQuestionsRoute);
assignments.route('/', removeQuestionRoute);
assignments.route('/', reorderQuestionsRoute);
assignments.route('/', publishResultsRoute);
assignments.route('/', analyticsRoute);
assignments.route('/', exportGradesRoute);
assignments.route('/', cloneAssignmentRoute);

export default assignments;
