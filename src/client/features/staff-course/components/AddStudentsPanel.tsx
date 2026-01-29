import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coursesApi, userApi } from '../../../lib/api';

type StudentRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type AddStudentsPanelProps = {
  courseId: string;
  enrolledUserIds: string[];
};

export function AddStudentsPanel({ courseId, enrolledUserIds }: AddStudentsPanelProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, StudentRow>>({});
  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', search],
    queryFn: () => userApi.listStudents(search),
  });

  const enrolledSet = useMemo(() => new Set(enrolledUserIds), [enrolledUserIds]);

  const enrollMutation = useMutation({
    mutationFn: (emails: string[]) => coursesApi.bulkEnroll(courseId, { emails, role: 'student' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-enrollments', courseId] });
      setSelected({});
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to enroll students: ' + message);
    },
  });

  const selectedList = Object.values(selected);

  const toggleSelection = (student: StudentRow) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[student.id]) {
        delete next[student.id];
      } else {
        next[student.id] = student;
      }
      return next;
    });
  };

  const removeSelected = (studentId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const handleEnroll = () => {
    if (selectedList.length === 0) return;
    const emails = selectedList.map((row) => row.email);
    enrollMutation.mutate(emails);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add students</h3>
            <span className="text-sm text-gray-500">Selected: {selectedList.length}</span>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white">
            {isLoading ? (
              <div className="p-3 text-sm text-gray-500">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No students found.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {students.map((student: StudentRow) => {
                  const isEnrolled = enrolledSet.has(student.id);
                  const isChecked = Boolean(selected[student.id]);
                  return (
                    <li key={student.id} className="flex items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isEnrolled}
                        onChange={() => toggleSelection(student)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {student.name || 'Unnamed student'}
                        </div>
                        <div className="text-xs text-gray-500">{student.email}</div>
                      </div>
                      {isEnrolled && (
                        <span className="text-xs text-green-600">Enrolled</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEnroll}
              disabled={selectedList.length === 0 || enrollMutation.isPending}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {enrollMutation.isPending ? 'Enrolling...' : 'Enroll selected'}
            </button>
            <button
              type="button"
              onClick={() => setSelected({})}
              disabled={selectedList.length === 0}
              className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="w-full lg:w-72 border border-gray-200 rounded-md bg-white p-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Selected students</h4>
          {selectedList.length === 0 ? (
            <p className="text-sm text-gray-500">No students selected.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {selectedList.map((student) => (
                <li key={student.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="truncate">
                    <div className="font-medium text-gray-800">{student.name || 'Unnamed'}</div>
                    <div className="text-xs text-gray-500 truncate">{student.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSelected(student.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}