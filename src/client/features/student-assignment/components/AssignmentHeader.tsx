import { useEffect, useRef, useState } from 'react';
import type { AssignmentDetails } from '../types';
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER, getQuestionTypeBadgeClasses } from '../../../lib/question-types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type AssignmentHeaderProps = {
  assignment: AssignmentDetails;
  dueDate: Date | null;
  isPastDue: boolean;
  submitted: boolean;
  toast: string | null;
  lastSaved?: Date | null;
  isSaving?: boolean;
  saveError?: boolean;
  onRetrySave?: () => void;
};

function SaveIndicator({
  status,
  lastSaved,
  onRetry,
}: {
  status: SaveStatus;
  lastSaved: Date | null;
  onRetry?: () => void;
}) {
  const [badgePhase, setBadgePhase] = useState<'flash' | 'badge' | 'none'>('none');
  const prevLastSavedRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'saved' || !lastSaved) return;

    const ts = lastSaved.getTime();
    if (ts === prevLastSavedRef.current) return;
    prevLastSavedRef.current = ts;

    const startTimer = setTimeout(() => setBadgePhase('flash'), 0);
    const flashTimer = setTimeout(() => setBadgePhase('badge'), 600);
    const badgeTimer = setTimeout(() => setBadgePhase('none'), 3000);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(flashTimer);
      clearTimeout(badgeTimer);
    };
  }, [status, lastSaved]);

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 animate-pulse">
        <svg className="animate-spin h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm font-medium text-amber-700">Saving...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1.5">
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span className="text-sm font-medium text-red-700">Save failed</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-red-700 underline hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (status === 'saved' && badgePhase !== 'none') {
    return (
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors duration-500 ${
          badgePhase === 'flash'
            ? 'bg-green-100 border-green-300'
            : 'bg-green-50 border-green-200'
        }`}
      >
        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium text-green-700">Saved</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5">
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-gray-600">Saved at {lastSaved.toLocaleTimeString()}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-yellow-50 border border-yellow-200 px-3 py-1.5">
      <svg className="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
      <span className="text-sm font-medium text-yellow-700">Not saved yet</span>
    </div>
  );
}

export function AssignmentHeader({
  assignment,
  dueDate,
  isPastDue,
  submitted,
  toast,
  lastSaved,
  isSaving,
  saveError,
  onRetrySave,
}: AssignmentHeaderProps) {
  const visibleQuestionTypes = QUESTION_TYPE_ORDER.filter((type) => assignment.questionTypeCounts[type] > 0);

  const saveStatus: SaveStatus = isSaving
    ? 'saving'
    : saveError
      ? 'error'
      : lastSaved
        ? 'saved'
        : 'idle';

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-red-600 text-white px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
          {assignment.description && <p className="mt-2 text-gray-600">{assignment.description}</p>}
          {dueDate && <p className="mt-2 text-sm text-gray-500">Due: {dueDate.toLocaleString()}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {assignment.questionCount} question{assignment.questionCount === 1 ? '' : 's'}
            </span>
            {visibleQuestionTypes.map((type) => (
              <span key={type} className={getQuestionTypeBadgeClasses(type)}>
                {assignment.questionTypeCounts[type]} {QUESTION_TYPE_LABELS[type]}
              </span>
            ))}
          </div>
        </div>
        {isPastDue && (
          <div className="mt-4 rounded-md bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              Past due. Saving is disabled, but you can still submit your last saved answers.
            </p>
          </div>
        )}
        {submitted && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">Submitted successfully.</p>
          </div>
        )}
      </div>

      {/* Sticky save indicator for long assignments */}
      {!submitted && (
        <div className="sticky top-2 z-40 flex justify-end pointer-events-none">
          <div className="pointer-events-auto -mt-4 mr-2">
            <SaveIndicator
              status={saveStatus}
              lastSaved={lastSaved ?? null}
              onRetry={onRetrySave}
            />
          </div>
        </div>
      )}
    </>
  );
}
