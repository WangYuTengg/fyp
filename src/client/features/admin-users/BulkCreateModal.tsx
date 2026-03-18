import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type BulkCreateUserInput, type BulkCreateResult } from '../../lib/api';
import { Modal } from '../../components/Modal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type ParsedRow = BulkCreateUserInput & { lineNumber: number };
type ParseError = { lineNumber: number; message: string };

function parseCsv(text: string): { rows: ParsedRow[]; errors: ParseError[] } {
  const lines = text.trim().split('\n');
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  // Detect and skip header
  const firstLine = lines[0]?.toLowerCase().trim() ?? '';
  const startIndex = firstLine.includes('email') && firstLine.includes('name') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map((s) => s.trim());
    const lineNumber = i + 1;

    if (parts.length < 4) {
      errors.push({ lineNumber, message: `Expected 4 columns (email,name,role,password), got ${parts.length}` });
      continue;
    }

    const [email, name, role, password] = parts;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ lineNumber, message: `Invalid email: "${email}"` });
      continue;
    }

    if (!name) {
      errors.push({ lineNumber, message: 'Name is required' });
      continue;
    }

    if (!['admin', 'staff', 'student'].includes(role)) {
      errors.push({ lineNumber, message: `Invalid role: "${role}". Must be admin, staff, or student` });
      continue;
    }

    if (!password || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      errors.push({ lineNumber, message: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
      continue;
    }

    rows.push({ email, name, role: role as 'admin' | 'staff' | 'student', password, lineNumber });
  }

  return { rows, errors };
}

export function BulkCreateModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; errors: ParseError[] } | null>(null);
  const [results, setResults] = useState<BulkCreateResult[] | null>(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (users: BulkCreateUserInput[]) => adminApi.bulkCreateUsers(users),
    onSuccess: (data) => {
      setResults(data.results);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resetForm = () => {
    setCsvText('');
    setParsed(null);
    setResults(null);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleParse = () => {
    setError('');
    setResults(null);
    const result = parseCsv(csvText);
    setParsed(result);
  };

  const handleImport = () => {
    if (!parsed?.rows.length) return;
    setError('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutation.mutate(parsed.rows.map(({ lineNumber, ...rest }) => rest));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setParsed(null);
      setResults(null);
    };
    reader.readAsText(file);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Users" size="lg">
      <div className="space-y-4">
        {!results ? (
          <>
            <p className="text-sm text-gray-600">
              Upload a CSV file or paste CSV text with columns: <code className="bg-gray-100 px-1 rounded">email,name,role,password</code>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV File</label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Or Paste CSV</label>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setParsed(null);
                }}
                className="form-input-block font-mono text-sm"
                placeholder="email,name,role,password&#10;student1@example.com,John Doe,student,password123&#10;staff1@example.com,Jane Smith,staff,password456"
              />
            </div>

            {parsed && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium text-green-700">{parsed.rows.length} valid</span>
                  {parsed.errors.length > 0 && (
                    <span className="ml-3 font-medium text-red-700">{parsed.errors.length} errors</span>
                  )}
                </div>
                {parsed.errors.length > 0 && (
                  <div className="bg-red-50 rounded-md p-3 max-h-40 overflow-y-auto">
                    {parsed.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-700">
                        Line {err.lineNumber}: {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              {!parsed ? (
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={!csvText.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Preview
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={mutation.isPending || parsed.rows.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {mutation.isPending ? 'Importing...' : `Import ${parsed.rows.length} Users`}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm space-y-1">
              <p className="text-green-700 font-medium">
                {results.filter((r) => r.status === 'created').length} created
              </p>
              {results.filter((r) => r.status === 'already_exists').length > 0 && (
                <p className="text-yellow-700 font-medium">
                  {results.filter((r) => r.status === 'already_exists').length} already existed
                </p>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-md">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            r.status === 'created'
                              ? 'bg-green-100 text-green-800'
                              : r.status === 'already_exists'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {r.status === 'already_exists' ? 'exists' : r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
