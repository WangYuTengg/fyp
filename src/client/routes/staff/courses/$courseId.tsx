import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { coursesApi, assignmentsApi, questionsApi, type Question } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { HomeIcon } from '@heroicons/react/24/outline';

export const Route = createFileRoute('/staff/courses/$courseId')({
  component: StaffCourseDetail,
});

function StaffCourseDetail() {
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

  type EnrollmentRow = {
    id: string;
    role: string;
    createdAt: string;
    user: { email: string; name: string | null };
  };

  type Assignment = {
    id: string;
    title: string;
    description: string | null;
    type: string;
    dueDate: string | null;
    maxAttempts: number | null;
    isPublished: boolean;
  };

  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const getPrompt = (content: unknown): string => {
    if (typeof content !== 'object' || content === null) return '';
    const record = content as Record<string, unknown>;
    return typeof record.prompt === 'string' ? record.prompt : '';
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: '/login' });
      } else if (dbUser && dbUser.role !== 'admin' && dbUser.role !== 'staff') {
        navigate({ to: '/student' });
      } else if (dbUser?.role === 'admin') {
        setAdminViewAs('staff');
      }
    }
  }, [authLoading, user, dbUser, navigate, setAdminViewAs]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [courseData, assignmentsData, enrollmentsData, questionsData] = await Promise.all([
        coursesApi.getById(courseId),
        assignmentsApi.getByCourse(courseId),
        coursesApi.getEnrollments(courseId),
        questionsApi.listByCourse(courseId),
      ]);
      setCourse(courseData as Course);
      setAssignments(assignmentsData as Assignment[]);
      setEnrollments(enrollmentsData as EnrollmentRow[]);
      setQuestions(questionsData);
    } catch (err) {
      console.error('Failed to load course:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (user && dbUser && (dbUser.role === 'admin' || dbUser.role === 'staff')) {
      loadData();
    }
  }, [user, dbUser, loadData]);

  const createAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await assignmentsApi.create({
        courseId,
        title: formData.get('title'),
        description: formData.get('description'),
        type: formData.get('type'),
        dueDate: formData.get('dueDate') || null,
        maxAttempts: Number(formData.get('maxAttempts')) || 1,
        questionIds: selectedQuestionIds,
      });
      
      setShowCreateAssignment(false);
      setSelectedQuestionIds([]);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to create assignment: ' + message);
    }
  };

  const createQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const title = String(formData.get('qTitle') || '').trim();
    const prompt = String(formData.get('qPrompt') || '').trim();
    const points = Number(formData.get('qPoints') || 10);

    try {
      await questionsApi.create({ courseId, title, prompt, points });
      setShowCreateQuestion(false);
      (e.currentTarget as HTMLFormElement).reset();
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to create question: ' + message);
    }
  };

  const togglePublish = async (assignmentId: string, isPublished: boolean) => {
    try {
      await assignmentsApi.publish(assignmentId, !isPublished);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to update assignment: ' + message);
    }
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

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Assignments</h2>
          <button
            onClick={() => setShowCreateAssignment(!showCreateAssignment)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            {showCreateAssignment ? 'Cancel' : 'Create Assignment'}
          </button>
        </div>

        {showCreateAssignment && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <form onSubmit={createAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    name="type"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="mcq">MCQ</option>
                    <option value="written">Written</option>
                    <option value="coding">Coding</option>
                    <option value="uml">UML</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Due Date</label>
                  <input
                    type="datetime-local"
                    name="dueDate"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Attempts</label>
                  <input
                    type="number"
                    name="maxAttempts"
                    defaultValue={1}
                    min={1}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900">Questions (optional)</h3>
                {questions.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No questions in this course yet. Create some below.</p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-48 overflow-auto border border-gray-200 rounded p-3">
                    {questions.map((q) => (
                      <label key={q.id} className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.includes(q.id)}
                          onChange={(evt) => {
                            setSelectedQuestionIds((prev) => {
                              if (evt.target.checked) return [...prev, q.id];
                              return prev.filter((id) => id !== q.id);
                            });
                          }}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium text-gray-900">{q.title}</span>
                          <span className="block text-xs text-gray-500">{q.points} pts</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
              >
                Create Assignment
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
                    {assignment.isPublished ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        Published
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-1">{assignment.description}</p>
                  <div className="mt-2 flex gap-4 text-sm text-gray-500">
                    <span>Type: {assignment.type.toUpperCase()}</span>
                    {assignment.dueDate && (
                      <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => togglePublish(assignment.id, assignment.isPublished)}
                  className={`ml-4 font-medium py-2 px-4 rounded ${
                    assignment.isPublished
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      : 'bg-green-500 hover:bg-green-700 text-white'
                  }`}
                >
                  {assignment.isPublished ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Question Pool</h2>
          <button
            onClick={() => setShowCreateQuestion(!showCreateQuestion)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            {showCreateQuestion ? 'Cancel' : 'Create Question'}
          </button>
        </div>

        {showCreateQuestion && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <form onSubmit={createQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  name="qTitle"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prompt</label>
                <textarea
                  name="qPrompt"
                  rows={4}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Write the question prompt students will see..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Points</label>
                  <input
                    type="number"
                    name="qPoints"
                    defaultValue={10}
                    min={1}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
              >
                Create Question
              </button>
            </form>
          </div>
        )}

        {questions.length === 0 ? (
          <p className="text-gray-500">No questions yet.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{q.title}</p>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {getPrompt(q.content)}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">{q.points} pts</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Enrollments ({enrollments.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {enrollment.user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {enrollment.user.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {enrollment.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(enrollment.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
