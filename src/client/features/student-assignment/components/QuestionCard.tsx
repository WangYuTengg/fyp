import { useState } from 'react';
import type { AnswerState, AssignmentQuestion } from '../types';
import { getPrompt, getMcqAllowMultiple, getMcqOptions } from '../utils/questionHelpers';
import { UMLEditor } from '../../../components/UMLEditor';
import { UMLViewer } from '../../../components/UMLViewer';
import { FileUpload } from '../../../components/FileUpload';

type QuestionCardProps = {
  assignmentQuestion: AssignmentQuestion;
  answer: AnswerState | undefined;
  onUpdateAnswer: (questionId: string, answer: AnswerState) => void;
  onSave: (questionId: string) => void;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
  isSaving: boolean;
  isSubmitted: boolean;
  isPastDue: boolean;
  currentFileUrl?: string | null;
};

function hasReferenceDiagram(content: unknown): content is { referenceDiagram: string } {
  return (
    typeof content === 'object' &&
    content !== null &&
    'referenceDiagram' in content &&
    typeof (content as { referenceDiagram: unknown }).referenceDiagram === 'string' &&
    (content as { referenceDiagram: string }).referenceDiagram.trim().length > 0
  );
}

export function QuestionCard({
  assignmentQuestion,
  answer,
  onUpdateAnswer,
  onSave,
  onFileUpload,
  isSaving,
  isSubmitted,
  isPastDue,
  currentFileUrl,
}: QuestionCardProps) {
  const { question, order, points } = assignmentQuestion;
  const [uploadMode, setUploadMode] = useState<'editor' | 'file'>('editor');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const allowMultiple = getMcqAllowMultiple(question.content);

  const handleFileSelect = async (file: File) => {
    if (!onFileUpload) return;

    setUploading(true);
    setUploadError(null);

    try {
      await onFileUpload(question.id, file);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {order}. {question.title}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{getPrompt(question.content)}</p>
        </div>
        <div className="text-sm text-gray-500 whitespace-nowrap">
          {points ?? question.points ?? 0} pts
        </div>
      </div>

      {question.type === 'written' && (
        <textarea
          rows={5}
          value={answer?.type === 'written' ? answer.text : ''}
          onChange={(e) => {
            const value = e.target.value;
            onUpdateAnswer(question.id, { type: 'written', text: value });
          }}
          className="form-textarea-block min-h-40"
          placeholder="Type your answer..."
          disabled={isSubmitted}
        />
      )}

      {question.type === 'mcq' && (
        <div className="space-y-2">
          {getMcqOptions(question.content).map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type={allowMultiple ? 'checkbox' : 'radio'}
                name={`mcq-${question.id}`}
                checked={answer?.type === 'mcq' && answer.selectedOptionIds.includes(option.id)}
                onChange={(event) => {
                  if (!allowMultiple) {
                    onUpdateAnswer(question.id, { type: 'mcq', selectedOptionIds: [option.id] });
                    return;
                  }

                  const currentSelections =
                    answer?.type === 'mcq' ? answer.selectedOptionIds : [];

                  const selectedOptionIds = event.target.checked
                    ? [...currentSelections, option.id]
                    : currentSelections.filter((id) => id !== option.id);

                  onUpdateAnswer(question.id, {
                    type: 'mcq',
                    selectedOptionIds: [...new Set(selectedOptionIds)].sort(),
                  });
                }}
                disabled={isSubmitted}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>{option.text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'uml' && (
        <div className="space-y-4">
          {hasReferenceDiagram(question.content) && (
            <UMLViewer 
              umlText={question.content.referenceDiagram}
              title="Reference Diagram"
            />
          )}

          {/* Toggle between editor and file upload */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setUploadMode('editor')}
              disabled={isSubmitted}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                uploadMode === 'editor'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              PlantUML Editor
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('file')}
              disabled={isSubmitted}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                uploadMode === 'file'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Upload Diagram
            </button>
          </div>

          {uploadMode === 'editor' ? (
            <UMLEditor
              key={question.id}
              initialValue={answer?.type === 'uml' ? answer.umlText : ''}
              initialDiagramState={answer?.type === 'uml' ? answer.editorState : undefined}
              onChange={(value, editorState) => {
                onUpdateAnswer(question.id, { type: 'uml', umlText: value, editorState });
              }}
              readOnly={isSubmitted}
              height="350px"
            />
          ) : (
            <div>
              <FileUpload
                onFileSelect={handleFileSelect}
                currentFileUrl={currentFileUrl}
                disabled={isSubmitted || isPastDue || uploading}
                accept=".png,.jpg,.jpeg,.svg,.puml"
                maxSizeMB={5}
              />
              {uploading && (
                <div className="mt-2 text-sm text-blue-600">Uploading...</div>
              )}
              {uploadError && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  Upload failed: {uploadError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {question.type !== 'written' && question.type !== 'mcq' && question.type !== 'uml' && (
        <p className="text-sm text-gray-500">This question type is not supported yet.</p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => onSave(question.id)}
          disabled={isSubmitted || isSaving || isPastDue}
          className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
