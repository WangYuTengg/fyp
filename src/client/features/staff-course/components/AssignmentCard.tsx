/** biome-ignore-all lint/a11y/noAutofocus: simplicity's sake */
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { StaffAssignment } from '../types';
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER, getQuestionTypeBadgeClasses } from '../../../lib/question-types';

type AssignmentCardProps = {
  assignment: StaffAssignment;
  onTogglePublish: (assignmentId: string, nextIsPublished: boolean) => void;
  onDelete?: (assignmentId: string) => void;
  onClone?: (assignmentId: string, options?: { newTitle?: string; newDueDate?: string | null }) => void;
  isCloning?: boolean;
};

export function AssignmentCard({ assignment, onTogglePublish, onDelete, onClone, isCloning }: AssignmentCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [nextPublishState, setNextPublishState] = useState<boolean | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [cloneTitle, setCloneTitle] = useState('');
  const [cloneDueDate, setCloneDueDate] = useState('');
  const hasAttempts = assignment.attemptCount > 0;
  const isUnpublishLocked = assignment.isPublished && hasAttempts;
  const visibleQuestionTypes = QUESTION_TYPE_ORDER.filter((type) => assignment.questionTypeCounts[type] > 0);

  const handlePublishClick = () => {
    if (isUnpublishLocked) return;
    setNextPublishState(!assignment.isPublished);
    setShowPublishConfirm(true);
  };

  const handleConfirmPublish = () => {
    if (nextPublishState === null) return;
    onTogglePublish(assignment.id, nextPublishState);
    setShowPublishConfirm(false);
    setNextPublishState(null);
  };

  const handleCancelPublish = () => {
    setShowPublishConfirm(false);
    setNextPublishState(null);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (confirmText.toLowerCase() === 'confirm') {
      onDelete?.(assignment.id);
      setShowDeleteConfirm(false);
      setConfirmText('');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setConfirmText('');
  };

  const handleCloneClick = () => {
    setCloneTitle(`${assignment.title} (Copy)`);
    setCloneDueDate('');
    setShowCloneModal(true);
  };

  const handleConfirmClone = () => {
    onClone?.(assignment.id, {
      newTitle: cloneTitle.trim() || undefined,
      newDueDate: cloneDueDate || null,
    });
    setShowCloneModal(false);
    setCloneTitle('');
    setCloneDueDate('');
  };

  const handleCancelClone = () => {
    setShowCloneModal(false);
    setCloneTitle('');
    setCloneDueDate('');
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
            {assignment.isPublished ? (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                Published
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                Draft
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">{assignment.description}</p>
          <div className="mt-2 flex gap-4 text-sm text-gray-500">
            {assignment.dueDate && (
              <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
            )}
            <span>Penalty: -{assignment.mcqPenaltyPerWrongSelection} per wrong multi-answer option</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {assignment.questionCount === 0
                ? 'No questions yet'
                : `${assignment.questionCount} question${assignment.questionCount === 1 ? '' : 's'}`}
            </span>
            {visibleQuestionTypes.map((type) => (
              <span key={type} className={getQuestionTypeBadgeClasses(type)}>
                {assignment.questionTypeCounts[type]} {QUESTION_TYPE_LABELS[type]}
              </span>
            ))}
          </div>
          {assignment.isPublished && (
            <p className="mt-2 text-sm text-gray-600">
              Once at least one student attempts this assignment, unpublishing is locked.
            </p>
          )}
          {isUnpublishLocked && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Students have already attempted this assignment ({assignment.attemptCount}). It can no longer be unpublished.
            </p>
          )}
        </div>
        <div className="ml-4 flex gap-2">
          {assignment.isPublished && (
            <Link
              to="/staff/grading"
              search={{ assignmentId: assignment.id, submissionId: undefined }}
              className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Grade
            </Link>
          )}
          {onClone && (
            <button
              type="button"
              onClick={handleCloneClick}
              disabled={isCloning}
              className="text-gray-600 hover:text-gray-800 font-medium py-2 px-4 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              {isCloning ? 'Cloning...' : 'Clone'}
            </button>
          )}
          <button
            type="button"
            onClick={handlePublishClick}
            disabled={isUnpublishLocked}
            className={`font-medium py-2 px-4 rounded ${
              assignment.isPublished
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400'
                : 'bg-green-500 hover:bg-green-700 text-white'
            }`}
          >
            {isUnpublishLocked ? 'Unpublish Locked' : assignment.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="text-red-600 hover:text-red-800 font-medium py-2 px-4 rounded hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Publish/Unpublish Confirmation Modal */}
      {showPublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {nextPublishState ? 'Publish Assignment' : 'Unpublish Assignment'}
            </h3>
            <p className="mb-4 text-gray-600">
              {nextPublishState
                ? `Are you sure you want to publish "${assignment.title}"? Students will be able to start attempting it.`
                : `Are you sure you want to unpublish "${assignment.title}"? Students will no longer be able to start new attempts.`}
            </p>
            {!nextPublishState && (
              <p className="mb-4 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                Existing attempts are preserved. Once students have attempted this assignment, unpublishing is no longer allowed.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelPublish}
                className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                className={`rounded px-4 py-2 text-white ${
                  nextPublishState ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-800'
                }`}
              >
                {nextPublishState ? 'Publish Assignment' : 'Unpublish Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Clone Assignment</h3>
            <p className="mb-4 text-sm text-gray-600">
              Create a copy of &ldquo;{assignment.title}&rdquo; with all its questions and settings. The clone starts unpublished.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="clone-title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  id="clone-title"
                  type="text"
                  value={cloneTitle}
                  onChange={(e) => setCloneTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="clone-due-date" className="block text-sm font-medium text-gray-700">
                  New due date (optional)
                </label>
                <input
                  id="clone-due-date"
                  type="datetime-local"
                  value={cloneDueDate}
                  onChange={(e) => setCloneDueDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank to clone without a due date.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelClone}
                className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClone}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Clone Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Assignment
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{assignment.title}"? This action cannot be undone.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Type <span className="font-semibold">confirm</span> to proceed:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type 'confirm' here"
              className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={confirmText.toLowerCase() !== 'confirm'}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
