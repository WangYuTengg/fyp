import { Link } from '@tanstack/react-router';
import type { StaffCourse } from '../types';

type CourseGridProps = {
  courses: StaffCourse[];
};

export function CourseGrid({ courses }: CourseGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <Link
          key={course.id}
          to="/staff/courses/$courseId"
          params={{ courseId: course.id }}
          className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{course.code}</h3>
              {course.isActive ? (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                  Active
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-gray-600">{course.name}</p>
            <div className="text-sm text-gray-500">
              {course.academicYear} • {course.semester}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
