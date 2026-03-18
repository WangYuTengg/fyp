import { useMemo, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import type { GradingAnswer, GradingMark, QuestionGrade } from '../types';
import { UMLViewer } from '../../../components/UMLViewer';
import { UMLAnnotationOverlay, AnnotationSidebar, type AnnotationPin } from './UMLAnnotationOverlay';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const OVERRIDE_REASONS = [
  { value: 'too_lenient', label: 'AI too lenient' },
  { value: 'too_strict', label: 'AI too strict' },
  { value: 'partial_credit', label: 'Partial credit' },
  { value: 'misunderstood_rubric', label: 'Misunderstood rubric' },
  { value: 'other', label: 'Other' },
] as const;

type QuestionGradeCardProps = {
  answer: GradingAnswer;
  questionNumber: number;
  grade: QuestionGrade | undefined;
  onGradeChange: (grade: QuestionGrade) => void;
  isReadOnly: boolean;
  pointsInputRef?: RefObject<HTMLInputElement | null>;
  existingMark?: GradingMark | null;
};

type ParsedAISuggestion = {
  points?: number;
  reasoning?: string;
  confidence?: number | null;
  criteriaScores?: Record<string, unknown>;
  model?: string;
  metadata?: {
    totalTokens?: number;
    totalCost?: number;
  };
};

export function QuestionGradeCard({
  answer,
  questionNumber,
  grade,
  onGradeChange,
  isReadOnly,
  pointsInputRef,
  existingMark,
}: QuestionGradeCardProps) {
  const [showReference, setShowReference] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(true);
  const [aiSuggestionDismissed, setAISuggestionDismissed] = useState(false);
  const question = answer.question;

  const aiSuggestion = useMemo<ParsedAISuggestion | null>(() => {
    if (!answer.aiGradingSuggestion) return null;

    if (typeof answer.aiGradingSuggestion === 'string') {
      try {
        return JSON.parse(answer.aiGradingSuggestion) as ParsedAISuggestion;
      } catch {
        return null;
      }
    }

    return answer.aiGradingSuggestion as ParsedAISuggestion;
  }, [answer.aiGradingSuggestion]);

  // B7: Track whether this is an override of an AI-graded mark
  const isAiMark = existingMark?.isAiAssisted || existingMark?.aiSuggestionAccepted;
  const [showOverrideReason, setShowOverrideReason] = useState(false);

  const handleOverrideReasonChange = useCallback(
    (reason: string) => {
      const currentGradeValue =
        grade ?? {
          answerId: answer.id,
          questionId: answer.questionId,
          points: 0,
          maxPoints: question?.points ?? 0,
          feedback: '',
        };

      onGradeChange({ ...currentGradeValue, overrideReason: reason });
    },
    [grade, answer.id, answer.questionId, question?.points, onGradeChange]
  );

  if (!question) {
    return null;
  }

  const maxPoints = question.points;
  const currentGrade =
    grade ??
    ({
      answerId: answer.id,
      questionId: answer.questionId,
      points: 0,
      maxPoints,
      feedback: '',
    } satisfies QuestionGrade);

  const currentPoints = currentGrade.points;
  const currentFeedback = currentGrade.feedback;

  const handlePointsChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const points = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(maxPoints, parsed));

    // Show override reason dropdown if changing an AI-graded mark
    if (isAiMark && existingMark && points !== existingMark.points) {
      setShowOverrideReason(true);
    }

    onGradeChange({
      ...currentGrade,
      points,
      maxPoints,
    });
  };

  const handleFeedbackChange = (value: string) => {
    onGradeChange({
      ...currentGrade,
      feedback: value,
      maxPoints,
    });
  };

  const handleAcceptAISuggestion = () => {
    if (!aiSuggestion) return;

    const suggestedPoints = Number.isFinite(aiSuggestion.points)
      ? Number(aiSuggestion.points)
      : 0;

    onGradeChange({
      ...currentGrade,
      points: Math.max(0, Math.min(maxPoints, Math.round(suggestedPoints))),
      feedback: aiSuggestion.reasoning || currentFeedback,
      maxPoints,
    });
    setAISuggestionDismissed(true);
  };

  const handleRejectAISuggestion = () => {
    setAISuggestionDismissed(true);
  };

  const getConfidenceBadge = (confidence: number | null | undefined) => {
    if (typeof confidence !== 'number') return null;

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

  // B2: Split view toggle
  const [splitView, setSplitView] = useState(true);

  // B3: UML Annotations
  const [annotations, setAnnotations] = useState<AnnotationPin[]>(() => {
    // Parse existing annotations from feedback JSONB
    if (existingMark?.feedback) {
      try {
        const parsed = JSON.parse(existingMark.feedback);
        if (parsed && Array.isArray(parsed.annotations)) {
          return parsed.annotations as AnnotationPin[];
        }
      } catch {
        // Not JSON feedback, that's fine
      }
    }
    return [];
  });

  const handleAnnotationsChange = useCallback(
    (newAnnotations: AnnotationPin[]) => {
      setAnnotations(newAnnotations);
      // Store annotations in feedback as JSON
      const feedbackObj = {
        text: currentGrade?.feedback || '',
        annotations: newAnnotations,
      };
      onGradeChange({
        ...(currentGrade ?? {
          answerId: answer.id,
          questionId: answer.questionId,
          points: 0,
          maxPoints: question?.points ?? 0,
          feedback: '',
        }),
        feedback: JSON.stringify(feedbackObj),
      });
    },
    [currentGrade, answer.id, answer.questionId, question?.points, onGradeChange]
  );

  // Extract content based on question type.
  const renderAnswer = () => {
    if (question.type === 'written') {
      const modelAnswer =
        typeof question.content.modelAnswer === 'string' ? question.content.modelAnswer : null;

      const studentPanel = (
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Student Answer</h4>
          <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap h-full">
            {(answer.content.text as string) || (
              <em className="text-gray-400">No answer provided</em>
            )}
          </div>
        </div>
      );

      const modelPanel = modelAnswer ? (
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-green-700 mb-2">Model Answer</h4>
          <div className="bg-green-50 rounded p-4 whitespace-pre-wrap border border-green-200 h-full">
            {modelAnswer}
          </div>
        </div>
      ) : null;

      return (
        <div className="space-y-2">
          {modelAnswer ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSplitView((prev) => !prev)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {splitView ? 'Stack view' : 'Split view'}
              </button>
            </div>
          ) : null}
          <div className={modelAnswer && splitView ? 'grid grid-cols-2 gap-4' : 'space-y-3'}>
            {studentPanel}
            {modelPanel}
          </div>
        </div>
      );
    }

    if (question.type === 'mcq') {
      const selectedIds = (answer.content.selectedOptionIds as string[]) || [];
      const options =
        (question.content.options as Array<{
          id: string;
          text: string;
          isCorrect?: boolean;
        }>) || [];
      const allowMultiple = question.content.allowMultiple === true;

      return (
        <div className="space-y-2">
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            const isCorrect = option.isCorrect || false;

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
                  <input type={allowMultiple ? 'checkbox' : 'radio'} checked={isSelected} disabled className="mt-1" />
                  <div className="flex-1">
                    <span className={isSelected ? 'font-medium' : ''}>{option.text}</span>
                    {isCorrect && !isSelected ? (
                      <span className="ml-2 text-xs text-green-600">(Correct answer)</span>
                    ) : null}
                    {isSelected && !isCorrect ? (
                      <span className="ml-2 text-xs text-red-600">(Incorrect)</span>
                    ) : null}
                    {isSelected && isCorrect ? (
                      <span className="ml-2 text-xs text-green-600">Correct</span>
                    ) : null}
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
      const answerDiagram =
        typeof question.content.modelAnswer === 'string' && question.content.modelAnswer.trim().length > 0
          ? question.content.modelAnswer
          : question.content.referenceDiagram;
      const templateDiagram = question.content.referenceDiagram;
      const hasAnswerDiagram = answerDiagram && typeof answerDiagram === 'string';

      const studentDiagram = (
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-700 mb-2">Student Submission</h4>
          <div className="relative">
            {umlText && typeof umlText === 'string' ? (
              <>
                <UMLViewer umlText={umlText} title="Student Diagram" />
                <UMLAnnotationOverlay
                  annotations={annotations}
                  onAnnotationsChange={isReadOnly ? undefined : handleAnnotationsChange}
                  readOnly={isReadOnly}
                />
              </>
            ) : answer.fileUrl ? (
              <div className="border rounded-lg overflow-hidden relative">
                <img src={answer.fileUrl} alt="UML Diagram" className="w-full h-auto" />
                <UMLAnnotationOverlay
                  annotations={annotations}
                  onAnnotationsChange={isReadOnly ? undefined : handleAnnotationsChange}
                  readOnly={isReadOnly}
                />
                <div className="p-2 bg-gray-50 text-xs text-gray-600">
                  <a
                    href={answer.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View full size
                  </a>
                </div>
              </div>
            ) : (
              <em className="text-gray-400">No diagram submitted</em>
            )}
          </div>
          {annotations.length > 0 ? (
            <div className="mt-3">
              <AnnotationSidebar
                annotations={annotations}
                selectedPin={null}
                onSelectPin={() => {}}
              />
            </div>
          ) : null}
          {!isReadOnly && question.type === 'uml' ? (
            <p className="text-xs text-gray-400 mt-2">Click on the diagram to place annotation pins.</p>
          ) : null}
        </div>
      );

      const referenceDiagramPanel = hasAnswerDiagram ? (
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-green-700 mb-2">Answer Diagram</h4>
          <UMLViewer umlText={answerDiagram} title="Answer Diagram" className="border-green-300" />
        </div>
      ) : null;

      return (
        <div className="space-y-3">
          {hasAnswerDiagram ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowReference(!showReference)}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                {showReference ? 'Hide' : 'Show'} Answer Diagram
              </button>
              {showReference ? (
                <button
                  type="button"
                  onClick={() => setSplitView((prev) => !prev)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {splitView ? 'Stack view' : 'Side by side'}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className={showReference && hasAnswerDiagram && splitView ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
            {studentDiagram}
            {showReference ? referenceDiagramPanel : null}
          </div>

          {templateDiagram && typeof templateDiagram === 'string' && templateDiagram.trim().length > 0 ? (
            <div className="text-xs text-gray-500">
              Template diagram was shown to students during the assignment.
            </div>
          ) : null}
        </div>
      );
    }

    return <em className="text-gray-400">Unsupported question type</em>;
  };

  return (
    <div className="bg-white shadow rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            Q{questionNumber}. {question.title}
          </h3>
          {question.content.prompt && typeof question.content.prompt === 'string' ? (
            <p className="mt-1 text-sm text-gray-600">{question.content.prompt}</p>
          ) : null}
        </div>
        <div className="text-sm text-gray-500 whitespace-nowrap">{maxPoints} pts</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div>{renderAnswer()}</div>

          {aiSuggestion && !aiSuggestionDismissed && !isReadOnly ? (
            <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <SparklesIcon className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-900">AI Suggestion</h4>
                  {getConfidenceBadge(aiSuggestion.confidence)}
                </div>
                <button
                  type="button"
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

              {showAISuggestion ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                      Suggested Points
                    </div>
                    <div className="text-2xl font-bold text-blue-700">
                      {Math.round(aiSuggestion.points || 0)}
                      <span className="text-base text-gray-500"> / {maxPoints}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Reasoning</div>
                    <div className="bg-white rounded p-3 text-sm text-gray-700 max-h-32 overflow-y-auto border border-blue-200 whitespace-pre-wrap">
                      {aiSuggestion.reasoning || 'No reasoning provided'}
                    </div>
                  </div>

                  {aiSuggestion.criteriaScores && Object.keys(aiSuggestion.criteriaScores).length > 0 ? (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">Criteria Scores</div>
                      <div className="bg-white rounded border border-blue-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Criterion
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Score
                              </th>
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
                  ) : null}

                  <div className="text-xs text-gray-500 space-y-1">
                    {aiSuggestion.model ? <div>Model: {aiSuggestion.model}</div> : null}
                    {aiSuggestion.metadata ? (
                      <div>
                        Tokens: {aiSuggestion.metadata.totalTokens || 0} | Cost: ${
                          aiSuggestion.metadata.totalCost?.toFixed(4) || '0.0000'
                        }
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAcceptAISuggestion}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectAISuggestion}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border rounded-lg p-4 bg-gray-50 xl:sticky xl:top-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="points" className="block text-sm font-medium text-gray-700">Points</label>
              <input
                id="points"
                ref={pointsInputRef}
                type="number"
                value={currentPoints}
                onChange={(event) => handlePointsChange(event.target.value)}
                min={0}
                max={maxPoints}
                step={1}
                disabled={isReadOnly}
                className="form-input-block"
              />
            </div>

            <div className="text-sm bg-white border border-gray-200 rounded-md p-3">
              <span className="text-gray-600">Score: </span>
              <span className="font-semibold text-lg">
                {currentPoints}/{maxPoints}
              </span>
              <span className="text-gray-500 ml-2">
                ({maxPoints > 0 ? ((currentPoints / maxPoints) * 100).toFixed(1) : '0.0'}%)
              </span>
            </div>

            <div>
              <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">Feedback (optional)</label>
              <textarea
                id="feedback"
                value={currentFeedback}
                onChange={(event) => handleFeedbackChange(event.target.value)}
                rows={6}
                disabled={isReadOnly}
                placeholder="Feedback for this question"
                className="form-textarea-block min-h-45"
              />
            </div>

            {showOverrideReason && !isReadOnly ? (
              <div className="border-t border-gray-200 pt-3">
                <label htmlFor="overrideReason" className="block text-sm font-medium text-amber-700 mb-1">
                  Override Reason
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  You're changing an AI-graded score. Why?
                </p>
                <select
                  id="overrideReason"
                  value={currentGrade.overrideReason || ''}
                  onChange={(event) => handleOverrideReasonChange(event.target.value)}
                  className="form-select-block"
                >
                  <option value="">Select a reason...</option>
                  {OVERRIDE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
