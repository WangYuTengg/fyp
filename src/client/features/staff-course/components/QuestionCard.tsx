import type { Question } from '../../../lib/api';

type QuestionCardProps = {
  question: Question;
  onDelete?: (questionId: string) => void;
};

function getPrompt(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const record = content as Record<string, unknown>;
  return typeof record.prompt === 'string' ? record.prompt : '';
}

export function QuestionCard({ question, onDelete }: QuestionCardProps) {
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${question.title}"?`)) {
      onDelete?.(question.id);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{question.title}</h3>
          <p className="text-gray-600 mt-1">{getPrompt(question.content)}</p>
          <div className="mt-2 flex gap-4 text-sm text-gray-500">
            <span>Type: {question.type.toUpperCase()}</span>
            <span>Points: {question.points}</span>
          </div>
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="ml-4 text-red-600 hover:text-red-800 font-medium py-2 px-4 rounded hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
