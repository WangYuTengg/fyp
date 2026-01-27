import { useState } from 'react';
import { 
  PlayIcon, 
  Cog6ToothIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { CostEstimateModal } from './components/CostEstimateModal';

export function AutoGradingDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);

  const handleTriggerAutoGrade = () => {
    // Show cost estimate modal first
    setShowCostModal(true);
  };

  const confirmAndRunGrading = () => {
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

      {/* Cost Estimate Modal */}
      <CostEstimateModal
        isOpen={showCostModal}
        onClose={() => setShowCostModal(false)}
        onConfirm={confirmAndRunGrading}
        assignmentId="placeholder" // TODO: Get from actual assignment selection
        questionTypes={['written', 'uml']}
      />
    </div>
  );
}
