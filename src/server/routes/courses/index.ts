import { Hono } from 'hono';
import type { AuthContext } from '../../middleware/auth.js';
import listCoursesRoute from './list-courses.js';
import getCourseRoute from './get-course.js';
import createCourseRoute from './create-course.js';
import enrollRoute from './enroll.js';
import listEnrollmentsRoute from './list-enrollments.js';
import bulkEnrollRoute from './bulk-enroll.js';
import removeEnrollmentRoute from './remove-enrollment.js';
import exportGradesRoute from './export-grades.js';

const courses = new Hono<AuthContext>();

courses.route('/', listCoursesRoute);
courses.route('/', getCourseRoute);
courses.route('/', createCourseRoute);
courses.route('/', enrollRoute);
courses.route('/', listEnrollmentsRoute);
courses.route('/', bulkEnrollRoute);
courses.route('/', removeEnrollmentRoute);
courses.route('/', exportGradesRoute);

export default courses;
