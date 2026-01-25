import { Link } from '@tanstack/react-router';
import type { StudentCourse } from '../types';

type CourseGridProps = {
  courses: StudentCourse[];
};

export function CourseGrid({ courses }: CourseGridProps) {
  if (courses.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <p className="text-gray-500">You are not enrolled in any courses yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <Link
          key={course.id}
          to="/student/courses/$courseId"
          params={{ courseId: course.id }}
          className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">{course.code}</h3>
            <p className="text-gray-600">{course.name}</p>
            <div className="text-sm text-gray-500">
              {course.academicYear} • {course.semester}
            </div>
            {course.enrollmentRole && (
              <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {course.enrollmentRole}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
