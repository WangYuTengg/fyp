import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listQuestionsRoute from './list-questions.js';
import createQuestionRoute from './create-question.js';
import updateQuestionRoute from './update-question.js';
import deleteQuestionRoute from './delete-question.js';
import rubricsRoute from './rubrics.js';

const questions = new Hono<AuthContext>();

questions.route('/', listQuestionsRoute);
questions.route('/', createQuestionRoute);
questions.route('/', updateQuestionRoute);
questions.route('/', deleteQuestionRoute);
questions.route('/', rubricsRoute);

export default questions;
