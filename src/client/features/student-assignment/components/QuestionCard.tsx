import type { AnswerState, AssignmentQuestion } from '../types';
import { getPrompt, getMcqOptions } from '../utils/questionHelpers';
import { UMLEditor } from '../../../components/UMLEditor';
import { UMLViewer } from '../../../components/UMLViewer';

type QuestionCardProps = {
  assignmentQuestion: AssignmentQuestion;
  answer: AnswerState | undefined;
  onUpdateAnswer: (questionId: string, answer: AnswerState) => void;
  onSave: (questionId: string) => void;
  isSaving: boolean;
  isSubmitted: boolean;
  isPastDue: boolean;
};

function hasReferenceDiagram(content: unknown): content is { referenceDiagram: string } {
  return (
    typeof content === 'object' &&
    content !== null &&
    'referenceDiagram' in content &&
    typeof (content as { referenceDiagram: unknown }).referenceDiagram === 'string'
  );
}

export function QuestionCard({
  assignmentQuestion,
  answer,
  onUpdateAnswer,
  onSave,
  isSaving,
  isSubmitted,
  isPastDue,
}: QuestionCardProps) {
  const { question, order, points } = assignmentQuestion;

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
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Type your answer..."
          disabled={isSubmitted}
        />
      )}

      {question.type === 'mcq' && (
        <div className="space-y-2">
          {getMcqOptions(question.content).map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name={`mcq-${question.id}`}
                checked={answer?.type === 'mcq' && answer.selectedOptionIds.includes(option.id)}
                onChange={() => {
                  onUpdateAnswer(question.id, { type: 'mcq', selectedOptionIds: [option.id] });
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
          
          <UMLEditor
            initialValue={answer?.type === 'uml' ? answer.umlText : ''}
            onChange={(value) => {
              onUpdateAnswer(question.id, { type: 'uml', umlText: value });
            }}
            readOnly={isSubmitted}
            height="350px"
          />
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
