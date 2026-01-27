import { useState, useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../../../lib/api';

type CostEstimateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  assignmentId: string;
  ungradedAnswers: number;
  questionTypes: ('written' | 'uml')[];
};

type CostEstimate = {
  totalAnswers: number;
  estimatedCost: number;
  avgCostPerAnswer: number;
  breakdown: {
    type: 'written' | 'uml';
    count: number;
    estimatedCost: number;
  }[];
};

type StatsResponse = {
  avgCostPerRequest: number;
};

export function CostEstimateModal({
  isOpen,
  onClose,
  onConfirm,
  assignmentId,
  ungradedAnswers,
  questionTypes,
}: CostEstimateModalProps) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && assignmentId) {
      fetchCostEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, assignmentId, questionTypes, ungradedAnswers]);

  const fetchCostEstimate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get average cost per answer from recent stats
      const stats = await apiClient<StatsResponse>('/api/auto-grade/stats?period=week');
      const avgCost = stats.avgCostPerRequest || 0.01; // Default to 1 cent if no data

      // Use actual ungraded answer count
      const totalAnswers = ungradedAnswers;
      
      // Rough estimate of written vs UML split (60/40)
      // In production, could fetch actual breakdown from backend
      const estimatedWritten = Math.round(totalAnswers * 0.6);
      const estimatedUML = Math.round(totalAnswers * 0.4);

      const writtenCost = questionTypes.includes('written') ? estimatedWritten * avgCost : 0;
      const umlCost = questionTypes.includes('uml') ? estimatedUML * (avgCost * 1.5) : 0; // UML slightly more expensive
      const totalCost = writtenCost + umlCost;

      setEstimate({
        totalAnswers,
        estimatedCost: totalCost,
        avgCostPerAnswer: avgCost,
        breakdown: ([
          {
            type: 'written' as const,
            count: estimatedWritten,
            estimatedCost: writtenCost,
          },
          {
            type: 'uml' as const,
            count: estimatedUML,
            estimatedCost: umlCost,
          },
        ] as const).filter((b) => questionTypes.includes(b.type)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate cost');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Cost Estimate</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-600">Calculating cost estimate...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {!loading && !error && estimate && (
              <>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-800">
                        This operation will consume LLM API credits
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Please review the cost estimate before proceeding.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cost Summary */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Answers to Grade</span>
                    <span className="font-semibold text-gray-900">{estimate.totalAnswers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Cost per Answer</span>
                    <span className="font-semibold text-gray-900">
                      ${estimate.avgCostPerAnswer.toFixed(4)}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-gray-900">Estimated Total Cost</span>
                      <span className="text-2xl font-bold text-blue-600">
                        ${estimate.estimatedCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                {estimate.breakdown.length > 1 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Cost Breakdown</h4>
                    {estimate.breakdown.map((item) => (
                      <div key={item.type} className="flex justify-between items-center bg-gray-50 rounded p-3">
                        <div>
                          <span className="text-sm font-medium text-gray-900 capitalize">{item.type}</span>
                          <span className="text-xs text-gray-500 ml-2">({item.count} answers)</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          ${item.estimatedCost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Disclaimer */}
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                  <p>
                    * This is an estimate based on recent average costs. Actual cost may vary depending on:
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Answer complexity and length</li>
                    <li>LLM provider and model selection</li>
                    <li>Current API pricing (subject to change)</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              disabled={loading || !!error}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Proceed with Auto-Grading
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
