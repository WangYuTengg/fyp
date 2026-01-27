import { useState } from 'react';

export function SettingsTab() {
  const [autoGradeOnSubmit, setAutoGradeOnSubmit] = useState(false);
  const [autoGradeMCQOnly, setAutoGradeMCQOnly] = useState(true);

  return (
    <div className="space-y-6">
      {/* Automatic Grading Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Automation Settings</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure automatic grading to run when submissions are received
        </p>

        <div className="space-y-4">
          {/* Auto-grade on submit toggle */}
          <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label htmlFor="auto-grade-submit" className="font-medium text-gray-900 block mb-1">
                Auto-grade on submission
              </label>
              <p className="text-sm text-gray-600">
                Automatically grade MCQ questions when a student submits their assignment
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
                checked={autoGradeMCQOnly}
                onChange={(e) => setAutoGradeMCQOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => {
              // TODO: Save settings to backend
              alert('Settings saved! (This is a placeholder - functionality to be implemented)');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
