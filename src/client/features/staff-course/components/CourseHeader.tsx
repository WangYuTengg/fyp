import { Link } from '@tanstack/react-router';
import { HomeIcon } from '@heroicons/react/24/outline';
import type { StaffCourse } from '../types';

type CourseHeaderProps = {
  course: StaffCourse;
};

export function CourseHeader({ course }: CourseHeaderProps) {
  return (
    <>
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link to="/staff" className="text-gray-400 hover:text-gray-500">
              <HomeIcon className="shrink-0 h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Dashboard</span>
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="ml-4 text-sm font-medium text-gray-500">Course Management</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900">{course.code}</h1>
        <p className="text-xl text-gray-600 mt-2">{course.name}</p>
        <p className="text-gray-500 mt-4">{course.description}</p>
        <div className="mt-4 text-sm text-gray-500">
          {course.academicYear} • {course.semester}
        </div>
      </div>
    </>
  );
}
