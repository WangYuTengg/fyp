import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { coursesApi, assignmentsApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { HomeIcon } from '@heroicons/react/24/outline';

export const Route = createFileRoute('/student/courses/$courseId')({
  component: StudentCourseDetail,
});

function StudentCourseDetail() {
  const { courseId } = Route.useParams();
  const { user, dbUser, loading: authLoading, setAdminViewAs } = useAuth();
  const navigate = useNavigate();

  type Course = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    academicYear: string;
    semester: string;
  };

  type Assignment = {
    id: string;
    title: string;
    description: string | null;
    type: string;
    dueDate: string | null;
    maxAttempts: number | null;
  };

  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
    if (!authLoading && dbUser?.role === 'admin') {
      setAdminViewAs('student');
    }
  }, [authLoading, user, navigate, dbUser, setAdminViewAs]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [courseData, assignmentsData] = await Promise.all([
        coursesApi.getById(courseId),
        assignmentsApi.getByCourse(courseId),
      ]);
      setCourse(courseData as Course);
      setAssignments(assignmentsData as Assignment[]);
    } catch (err) {
      console.error('Failed to load course:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const startAssignment = (assignmentId: string) => {
    navigate({
      to: '/student/assignments/$assignmentId',
      params: { assignmentId },
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!course) {
    return <div className="text-center py-8">Course not found</div>;
  }

  return (
    <div className="space-y-6">
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <Link to="/student" className="text-gray-400 hover:text-gray-500">
              <HomeIcon className="shrink-0 h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Dashboard</span>
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="ml-4 text-sm font-medium text-gray-500">Course Details</span>
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

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Assignments</h2>
        
        {assignments.length === 0 ? (
          <p className="text-gray-500">No assignments available yet.</p>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
                    <p className="text-gray-600 mt-1">{assignment.description}</p>
                    <div className="mt-2 flex gap-4 text-sm text-gray-500">
                      <span>Type: {assignment.type.toUpperCase()}</span>
                      {assignment.dueDate && (
                        <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                      )}
                      {assignment.maxAttempts && (
                        <span>Max Attempts: {assignment.maxAttempts}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => startAssignment(assignment.id)}
                    className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
