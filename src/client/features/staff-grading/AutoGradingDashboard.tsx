import { useState } from 'react';
import { 
  PlayIcon, 
  Cog6ToothIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

export function AutoGradingDashboard() {
  const [autoGradeOnSubmit, setAutoGradeOnSubmit] = useState(false);
  const [autoGradeMCQOnly, setAutoGradeMCQOnly] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const handleTriggerAutoGrade = () => {
    setIsRunning(true);
    // TODO: Call auto-grading API
    setTimeout(() => {
      setIsRunning(false);
      alert('Auto-grading completed! (This is a placeholder - functionality to be implemented)');
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Cog6ToothIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Auto-Grading Dashboard</h1>
        </div>
        <p className="text-sm text-gray-600">
          Automatically grade submissions with correct answers defined
        </p>
      </div>

      {/* Manual Trigger Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Grading</h2>
        <p className="text-sm text-gray-600 mb-4">
          Trigger auto-grading for all pending submissions across all courses. Only questions with defined correct answers will be graded.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-blue-900 mb-1">What will be graded:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>MCQ questions with correct answers marked</li>
                <li>Partial credit based on points assigned to each option</li>
                <li>Submissions in "submitted" or "grading" status</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <XCircleIcon className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-yellow-900 mb-1">What will NOT be graded:</p>
              <ul className="list-disc list-inside space-y-1 text-yellow-800">
                <li>Written questions (require manual grading)</li>
                <li>UML diagram questions (require manual grading)</li>
                <li>Questions without correct answers defined</li>
                <li>Already graded submissions</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTriggerAutoGrade}
          disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? (
            <>
              <ClockIcon className="h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <PlayIcon className="h-5 w-5" />
              Run Auto-Grading Now
            </>
          )}
        </button>
      </div>

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

      {/* Statistics Placeholder */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Grading Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium mb-1">Auto-graded</p>
            <p className="text-3xl font-bold text-green-900">0</p>
            <p className="text-xs text-green-700 mt-1">submissions this week</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-600 font-medium mb-1">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-900">0</p>
            <p className="text-xs text-yellow-700 mt-1">submissions waiting</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium mb-1">Total Graded</p>
            <p className="text-3xl font-bold text-blue-900">0</p>
            <p className="text-xs text-blue-700 mt-1">all time</p>
          </div>
        </div>
      </div>
    </div>
  );
}
