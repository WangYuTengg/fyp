import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { StaffAssignment } from '../types';

type AssignmentCardProps = {
  assignment: StaffAssignment;
  onTogglePublish: (assignmentId: string, isPublished: boolean) => void;
  onDelete?: (assignmentId: string) => void;
};

export function AssignmentCard({ assignment, onTogglePublish, onDelete }: AssignmentCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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
            <span>Type: {assignment.type.toUpperCase()}</span>
            {assignment.dueDate && (
              <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
            )}
          </div>
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
          <button
            onClick={() => onTogglePublish(assignment.id, assignment.isPublished)}
            className={`font-medium py-2 px-4 rounded ${
              assignment.isPublished
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                : 'bg-green-500 hover:bg-green-700 text-white'
            }`}
          >
            {assignment.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="text-red-600 hover:text-red-800 font-medium py-2 px-4 rounded hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

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
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
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
