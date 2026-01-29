import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/Modal';
import { coursesApi } from '../../../lib/api';

type BulkEnrollModalProps = {
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
};

type BulkEnrollResult = {
  email: string;
  status: 'enrolled' | 'already_enrolled' | 'not_found' | 'invalid';
  enrollmentId?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(input: string) {
  const parts = input.split(/[\s,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const email of parts) {
    if (!seen.has(email)) {
      seen.add(email);
      unique.push(email);
    }
  }
  const invalid = unique.filter((email) => !emailRegex.test(email));
  const valid = unique.filter((email) => emailRegex.test(email));
  return { unique, valid, invalid };
}

export function BulkEnrollModal({ courseId, isOpen, onClose }: BulkEnrollModalProps) {
  const [emailsInput, setEmailsInput] = useState('');
  const [results, setResults] = useState<BulkEnrollResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { unique, valid, invalid } = useMemo(() => parseEmails(emailsInput), [emailsInput]);

  const bulkMutation = useMutation({
    mutationFn: (emails: string[]) =>
      coursesApi.bulkEnroll(courseId, { emails, role: 'student' }),
    onSuccess: (data) => {
      setResults(data.results as BulkEnrollResult[]);
      queryClient.invalidateQueries({ queryKey: ['course-enrollments', courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    },
  });

  const handleSubmit = () => {
    setError(null);
    setResults(null);

    if (valid.length === 0) {
      setError('Paste at least one valid email.');
      return;
    }

    bulkMutation.mutate(valid);
  };

  const handleClose = () => {
    setEmailsInput('');
    setResults(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Enroll Students" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Paste student emails</label>
          <textarea
            value={emailsInput}
            onChange={(e) => setEmailsInput(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
            placeholder="student1@school.edu, student2@school.edu"
          />
          <p className="text-xs text-gray-500 mt-1">Separate emails by comma, space, or newline.</p>
        </div>

        <div className="text-sm text-gray-600 flex flex-wrap gap-4">
          <span>Total: {unique.length}</span>
          <span className="text-green-600">Valid: {valid.length}</span>
          <span className={invalid.length > 0 ? 'text-red-600' : ''}>Invalid: {invalid.length}</span>
        </div>

        {invalid.length > 0 && (
          <div className="text-sm text-red-600">
            Invalid emails: {invalid.join(', ')}
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={bulkMutation.isPending}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkMutation.isPending ? 'Enrolling...' : 'Enroll'}
          </button>
        </div>

        {results && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Results</h3>
            <ul className="space-y-1 text-sm">
              {results.map((result) => (
                <li key={result.email} className="flex justify-between">
                  <span>{result.email}</span>
                  <span
                    className={
                      result.status === 'enrolled'
                        ? 'text-green-600'
                        : result.status === 'already_enrolled'
                          ? 'text-amber-600'
                          : result.status === 'not_found'
                            ? 'text-red-600'
                            : 'text-gray-600'
                    }
                  >
                    {result.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}