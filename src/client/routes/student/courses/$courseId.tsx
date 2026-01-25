import { createFileRoute } from '@tanstack/react-router';
import { StudentCourseDetail } from '../../../features/student-course/StudentCourseDetail';

export const Route = createFileRoute('/student/courses/$courseId')({
  component: StudentCourseRoute,
});

function StudentCourseRoute() {
  const { courseId } = Route.useParams();
  return <StudentCourseDetail courseId={courseId} />;
}
