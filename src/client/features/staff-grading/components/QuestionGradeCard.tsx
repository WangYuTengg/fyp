import { useState } from 'react';
import type { GradingAnswer, QuestionGrade } from '../types';
import { UMLViewer } from '../../../components/UMLViewer';
import { CheckCircleIcon, XCircleIcon, ChevronDownIcon, ChevronRightIcon, SparklesIcon } from '@heroicons/react/24/outline';

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
  const [showAISuggestion, setShowAISuggestion] = useState(true);
  const [aiSuggestionDismissed, setAISuggestionDismissed] = useState(false);
  const question = answer.question;

  // Parse AI grading suggestion if available
  const aiSuggestion = answer.aiGradingSuggestion ? 
    (typeof answer.aiGradingSuggestion === 'string' ? 
      JSON.parse(answer.aiGradingSuggestion) : 
      answer.aiGradingSuggestion) : 
    null;

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

  const handleAcceptAISuggestion = () => {
    if (!aiSuggestion) return;
    
    onGradeChange(answer.questionId, {
      questionId: answer.questionId,
      points: aiSuggestion.points || 0,
      feedback: aiSuggestion.reasoning || '',
    });
    setAISuggestionDismissed(true);
  };

  const handleRejectAISuggestion = () => {
    setAISuggestionDismissed(true);
  };

  const getConfidenceBadge = (confidence: number | null | undefined) => {
    if (!confidence) return null;
    
    const percentage = Math.round(confidence * 100);
    let colorClass = 'bg-gray-100 text-gray-700';
    
    if (percentage >= 80) {
      colorClass = 'bg-green-100 text-green-700';
    } else if (percentage >= 60) {
      colorClass = 'bg-yellow-100 text-yellow-700';
    } else {
      colorClass = 'bg-red-100 text-red-700';
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
        {percentage}% confidence
      </span>
    );
  };

  // Extract content based on question type
  const renderAnswer = () => {
    if (question.type === 'written') {
      const modelAnswer = typeof question.content.modelAnswer === 'string' ? question.content.modelAnswer : null;
      
      return (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Student's Answer:</h4>
            <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap">
              {(answer.content.text as string) || <em className="text-gray-400">No answer provided</em>}
            </div>
          </div>
          
          {modelAnswer && (
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2">Model Answer (Reference):</h4>
              <div className="bg-green-50 rounded p-4 whitespace-pre-wrap border border-green-200">
                {modelAnswer}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (question.type === 'mcq') {
      const selectedIds = (answer.content.selectedOptionIds as string[]) || [];
      const options = (question.content.options as Array<{ id: string; text: string; points?: number; isCorrect?: boolean }>) || [];

      return (
        <div className="space-y-2">
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            const isCorrect = option.isCorrect || false;
            const optionPoints = option.points ?? 0;

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
                    {optionPoints > 0 && (
                      <span className="ml-2 text-xs font-semibold text-blue-600">
                        ({optionPoints} {optionPoints === 1 ? 'pt' : 'pts'})
                      </span>
                    )}
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
      const answerDiagram = (typeof question.content.modelAnswer === 'string' && question.content.modelAnswer.trim().length > 0)
        ? question.content.modelAnswer
        : question.content.referenceDiagram;
      const templateDiagram = question.content.referenceDiagram;
      
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

          {answerDiagram && typeof answerDiagram === 'string' ? (
            <div>
              <button
                type="button"
                onClick={() => setShowReference(!showReference)}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                {showReference ? '▼ Hide' : '▶ Show'} Answer Diagram
              </button>
              {showReference ? (
                <div className="mt-2">
                  <UMLViewer umlText={answerDiagram} title="Answer Diagram" />
                </div>
              ) : null}
            </div>
          ) : null}

          {templateDiagram && typeof templateDiagram === 'string' && templateDiagram.trim().length > 0 ? (
            <div className="text-xs text-gray-500">
              Template diagram is available in the question (shown to students).
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

      {/* AI Grading Suggestion */}
      {aiSuggestion && !aiSuggestionDismissed && !isReadOnly && (
        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">AI Grading Suggestion</h4>
              {getConfidenceBadge(aiSuggestion.confidence)}
            </div>
            <button
              onClick={() => setShowAISuggestion(!showAISuggestion)}
              className="text-blue-600 hover:text-blue-800"
            >
              {showAISuggestion ? (
                <ChevronDownIcon className="h-5 w-5" />
              ) : (
                <ChevronRightIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          {showAISuggestion && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Suggested Points</div>
                  <div className="text-3xl font-bold text-blue-700">
                    {aiSuggestion.points || 0} <span className="text-lg text-gray-500">/ {maxPoints}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">Reasoning</div>
                <div className="bg-white rounded p-3 text-sm text-gray-700 max-h-32 overflow-y-auto border border-blue-200">
                  {aiSuggestion.reasoning || 'No reasoning provided'}
                </div>
              </div>

              {aiSuggestion.criteriaScores && Object.keys(aiSuggestion.criteriaScores).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-2">Rubric Criteria Scores</div>
                  <div className="bg-white rounded border border-blue-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Criterion</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(aiSuggestion.criteriaScores).map(([criterion, score]) => (
                          <tr key={criterion}>
                            <td className="px-3 py-2 text-gray-700">{criterion}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{String(score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                {aiSuggestion.model && <div>Model: {aiSuggestion.model}</div>}
                {aiSuggestion.metadata && (
                  <div>
                    Tokens: {aiSuggestion.metadata.totalTokens || 0} | 
                    Cost: ${(aiSuggestion.metadata.totalCost || 0).toFixed(4)}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAcceptAISuggestion}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Accept Suggestion
                </button>
                <button
                  onClick={handleRejectAISuggestion}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  <XCircleIcon className="h-4 w-4" />
                  Reject & Grade Manually
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
              className="form-input-block"
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
            rows={5}
            disabled={isReadOnly}
            placeholder="Provide feedback to the student..."
            className="form-textarea-block min-h-[140px]"
          />
        </div>
      </div>
    </div>
  );
}
