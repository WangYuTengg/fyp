import { createFileRoute } from '@tanstack/react-router';
import { StaffCourseDetail } from '../../../features/staff-course/StaffCourseDetail';

export const Route = createFileRoute('/staff/courses/$courseId')({
  component: StaffCourseRoute,
});

function StaffCourseRoute() {
  const { courseId } = Route.useParams();
  return <StaffCourseDetail courseId={courseId} />;
}
