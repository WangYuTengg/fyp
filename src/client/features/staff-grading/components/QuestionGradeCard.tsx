import { useState } from 'react';
import type { GradingAnswer, QuestionGrade } from '../types';
import { UMLViewer } from '../../../components/UMLViewer';

type QuestionGradeCardProps = {
  answer: GradingAnswer;
  questionNumber: number;
  grade: QuestionGrade | undefined;
  onGradeChange: (questionId: string, grade: QuestionGrade) => void;
  isReadOnly: boolean;
};

export function QuestionGradeCard({
  answer,
  questionNumber,
  grade,
  onGradeChange,
  isReadOnly,
}: QuestionGradeCardProps) {
  const [showReference, setShowReference] = useState(false);
  const question = answer.question;

  if (!question) {
    return null;
  }

  const maxPoints = question.points;
  const currentPoints = grade?.points || 0;
  const currentFeedback = grade?.feedback || '';

  const handlePointsChange = (value: string) => {
    const points = Math.max(0, Math.min(maxPoints, parseFloat(value) || 0));
    onGradeChange(answer.questionId, {
      questionId: answer.questionId,
      points,
      feedback: currentFeedback,
    });
  };

  const handleFeedbackChange = (value: string) => {
    onGradeChange(answer.questionId, {
      questionId: answer.questionId,
      points: currentPoints,
      feedback: value,
    });
  };

  // Extract content based on question type
  const renderAnswer = () => {
    if (question.type === 'written') {
      return (
        <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap">
          {(answer.content.text as string) || <em className="text-gray-400">No answer provided</em>}
        </div>
      );
    }

    if (question.type === 'mcq') {
      const selectedIds = (answer.content.selectedOptionIds as string[]) || [];
      const options = (question.content.options as Array<{ id: string; text: string }>) || [];

      return (
        <div className="space-y-2">
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            const isCorrect = (question.content.correctOptionIds as string[])?.includes(option.id);

            return (
              <div
                key={option.id}
                className={`p-3 rounded border-2 ${
                  isSelected && isCorrect
                    ? 'border-green-500 bg-green-50'
                    : isSelected && !isCorrect
                    ? 'border-red-500 bg-red-50'
                    : isCorrect
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    checked={isSelected}
                    disabled
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <span className={isSelected ? 'font-medium' : ''}>{option.text}</span>
                    {isCorrect && !isSelected && (
                      <span className="ml-2 text-xs text-green-600">(Correct answer)</span>
                    )}
                    {isSelected && !isCorrect && (
                      <span className="ml-2 text-xs text-red-600">(Incorrect)</span>
                    )}
                    {isSelected && isCorrect && (
                      <span className="ml-2 text-xs text-green-600">✓ Correct</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (question.type === 'uml') {
      const umlText = answer.content.umlText;
      const refDiagram = question.content.referenceDiagram;
      
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Student's Submission:</h4>
            {umlText && typeof umlText === 'string' ? (
              <UMLViewer umlText={umlText} title="Student's Diagram" />
            ) : answer.fileUrl ? (
              <div className="border rounded-lg overflow-hidden">
                <img src={answer.fileUrl} alt="UML Diagram" className="w-full h-auto" />
                <div className="p-2 bg-gray-50 text-xs text-gray-600">
                  <a href={answer.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    View full size →
                  </a>
                </div>
              </div>
            ) : (
              <em className="text-gray-400">No diagram submitted</em>
            )}
          </div>

          {refDiagram && typeof refDiagram === 'string' ? (
            <div>
              <button
                type="button"
                onClick={() => setShowReference(!showReference)}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                {showReference ? '▼ Hide' : '▶ Show'} Reference Diagram
              </button>
              {showReference ? (
                <div className="mt-2">
                  <UMLViewer umlText={refDiagram} title="Reference Diagram" />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    return <em className="text-gray-400">Unsupported question type</em>;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-4">
      {/* Question Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {questionNumber}. {question.title}
          </h3>
          {question.content.prompt && typeof question.content.prompt === 'string' ? (
            <p className="mt-1 text-sm text-gray-600">{question.content.prompt}</p>
          ) : null}
        </div>
        <div className="text-sm text-gray-500 whitespace-nowrap">
          {maxPoints} pts
        </div>
      </div>

      {/* Answer */}
      <div>{renderAnswer()}</div>

      {/* Grading */}
      <div className="border-t pt-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Points (max: {maxPoints})
            </label>
            <input
              type="number"
              value={currentPoints}
              onChange={(e) => handlePointsChange(e.target.value)}
              min={0}
              max={maxPoints}
              step={0.5}
              disabled={isReadOnly}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
            />
          </div>

          <div className="flex items-end">
            <div className="text-sm">
              <span className="text-gray-600">Score: </span>
              <span className="font-semibold text-lg">
                {currentPoints}/{maxPoints}
              </span>
              <span className="text-gray-600 ml-2">
                ({maxPoints > 0 ? ((currentPoints / maxPoints) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Feedback (optional)
          </label>
          <textarea
            value={currentFeedback}
            onChange={(e) => handleFeedbackChange(e.target.value)}
            rows={3}
            disabled={isReadOnly}
            placeholder="Provide feedback to the student..."
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
          />
        </div>
      </div>
    </div>
  );
}
