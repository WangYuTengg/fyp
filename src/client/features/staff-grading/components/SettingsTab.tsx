import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

type AutomationSettings = {
  autoGradeOnSubmit: boolean;
  autoGradeMcqOnly: boolean;
};

type SettingsTabProps = {
  courseId: string;
};

export function SettingsTab({ courseId }: SettingsTabProps) {
  const [autoGradeOnSubmit, setAutoGradeOnSubmit] = useState(false);
  const [autoGradeMcqOnly, setAutoGradeMcqOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient<AutomationSettings>(`/api/courses/${courseId}/automation-settings`)
      .then((data) => {
        if (cancelled) return;
        setAutoGradeOnSubmit(data.autoGradeOnSubmit);
        setAutoGradeMcqOnly(data.autoGradeMcqOnly);
      })
      .catch((err) => {
        if (cancelled) return;
        setFeedback({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to load settings' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await apiClient<AutomationSettings>(`/api/courses/${courseId}/automation-settings`, {
        method: 'PUT',
        body: JSON.stringify({ autoGradeOnSubmit, autoGradeMcqOnly }),
      });
      setFeedback({ kind: 'success', message: 'Settings saved.' });
    } catch (err) {
      setFeedback({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Automatic Grading Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Automation Settings</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure automatic grading to run when submissions are received
        </p>

        <fieldset disabled={loading || saving} className="space-y-4">
          {/* Auto-grade on submit toggle */}
          <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label htmlFor="auto-grade-submit" className="font-medium text-gray-900 block mb-1">
                Auto-grade on submission
              </label>
              <p className="text-sm text-gray-600">
                Automatically grade questions when a student submits their assignment
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                id="auto-grade-submit"
                type="checkbox"
                checked={autoGradeOnSubmit}
                onChange={(e) => setAutoGradeOnSubmit(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* MCQ only filter */}
          <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label htmlFor="mcq-only" className="font-medium text-gray-900 block mb-1">
                Grade MCQ questions only
              </label>
              <p className="text-sm text-gray-600">
                Only auto-grade multiple choice questions, skip written and UML questions
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                id="mcq-only"
                type="checkbox"
                checked={autoGradeMcqOnly}
                onChange={(e) => setAutoGradeMcqOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </fieldset>

        {feedback && (
          <div
            role="status"
            className={`mt-4 px-4 py-2 rounded-md text-sm ${
              feedback.kind === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
