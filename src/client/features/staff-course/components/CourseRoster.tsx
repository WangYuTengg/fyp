import type { StaffEnrollmentRow } from '../types';

type CourseRosterProps = {
  enrollments: StaffEnrollmentRow[];
  onBulkEnroll: () => void;
  onRemove: (enrollmentId: string) => void;
  removingId?: string | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function CourseRoster({ enrollments, onBulkEnroll, onRemove, removingId }: CourseRosterProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Roster</h2>
        <button
          type="button"
          onClick={onBulkEnroll}
          className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
        >
          Bulk Enroll
        </button>
      </div>

      {enrollments.length === 0 ? (
        <p className="text-gray-500">No students enrolled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrolled</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enrollments.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.user.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.user.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{row.role.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      disabled={removingId === row.id}
                      className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                    >
                      {removingId === row.id ? 'Removing...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}