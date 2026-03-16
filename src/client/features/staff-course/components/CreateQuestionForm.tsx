import { useMemo, useState } from 'react';
import type { McqOption } from '../../../lib/api';
import type { StaffAssignment } from '../types';
import { UMLEditor } from '../../../components/UMLEditor';
import type { ClassDiagramState } from '../../../components/uml/classDiagram';

type QuestionType = 'mcq' | 'written' | 'uml';

type CreateQuestionFormProps = {
  questionType: QuestionType;
  setQuestionType: (type: QuestionType) => void;
  mcqOptions: McqOption[];
  setMcqOptions: (options: McqOption[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  assignments: StaffAssignment[];
  selectedAssignmentId: string;
  setSelectedAssignmentId: (id: string) => void;
  tags: string[];
};

const STEP_TITLES_BY_TYPE: Record<QuestionType, readonly string[]> = {
  mcq: ['Question Type', 'Core Details', 'Options & Answer Key', 'Assignment & Tags', 'Review'],
  written: ['Question Type', 'Core Details', 'Model Answer', 'Assignment & Tags', 'Review'],
  uml: ['Question Type', 'Core Details', 'Answer Diagram', 'Reference Diagram', 'Assignment & Tags', 'Review'],
};

const STEP_DESCRIPTIONS_BY_TYPE: Record<QuestionType, readonly string[]> = {
  mcq: [
    'Choose the question format.',
    'Define the prompt students will answer.',
    'Add options and mark correct answer(s).',
    'Optionally attach this question to an assignment and add tags.',
    'Check details before creating the question.',
  ],
  written: [
    'Choose the question format.',
    'Define the prompt students will answer.',
    'Optionally provide a grader-facing model answer.',
    'Optionally attach this question to an assignment and add tags.',
    'Check details before creating the question.',
  ],
  uml: [
    'Choose the question format.',
    'Define the prompt students will answer.',
    'Provide the expected solution diagram used for grading (hidden from students).',
    'Optionally provide a starter/reference diagram shown to students.',
    'Optionally attach this question to an assignment and add tags.',
    'Check details before creating the question.',
  ],
};

const hasMeaningfulUmlContent = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => line !== '@startuml' && line !== '@enduml');

export function CreateQuestionForm({
  questionType,
  setQuestionType,
  mcqOptions,
  setMcqOptions,
  onSubmit,
  isSubmitting = false,
  assignments,
  selectedAssignmentId,
  setSelectedAssignmentId,
  tags,
}: CreateQuestionFormProps) {
  const [step, setStep] = useState(0);
  const [submitIntent, setSubmitIntent] = useState(false);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [points, setPoints] = useState(10);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [umlTemplateDiagram, setUmlTemplateDiagram] = useState('');
  const [umlModelAnswer, setUmlModelAnswer] = useState('');
  const [umlTemplateDiagramState, setUmlTemplateDiagramState] = useState<ClassDiagramState | undefined>(undefined);
  const [umlModelDiagramState, setUmlModelDiagramState] = useState<ClassDiagramState | undefined>(undefined);
  const [modelAnswer, setModelAnswer] = useState('');
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);

  const availableAssignments = useMemo(
    () => [...assignments].sort((a, b) => a.title.localeCompare(b.title)),
    [assignments]
  );
  const validMcqOptions = useMemo(
    () => mcqOptions.filter((option) => option.text.trim().length > 0),
    [mcqOptions]
  );
  const hasDuplicateMcqOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const option of validMcqOptions) {
      const normalizedText = option.text.trim();
      if (seen.has(normalizedText)) {
        return true;
      }
      seen.add(normalizedText);
    }
    return false;
  }, [validMcqOptions]);
  const correctMcqOptionsCount = useMemo(
    () => validMcqOptions.filter((option) => option.isCorrect).length,
    [validMcqOptions]
  );
  const stepTitles = STEP_TITLES_BY_TYPE[questionType];
  const stepDescriptions = STEP_DESCRIPTIONS_BY_TYPE[questionType];
  const assignmentStep = questionType === 'uml' ? 4 : 3;
  const reviewStep = stepTitles.length - 1;
  const isLastStep = step === reviewStep;

  const canProceed = useMemo(() => {
    if (step === 1) return title.trim().length > 0 && Number.isFinite(points) && points >= 1;
    if (step === 2) {
      if (questionType === 'mcq') {
        return validMcqOptions.length >= 2 && !hasDuplicateMcqOptions && correctMcqOptionsCount > 0;
      }
      if (questionType === 'uml') return hasMeaningfulUmlContent(umlModelAnswer);
    }
    return true;
  }, [correctMcqOptionsCount, hasDuplicateMcqOptions, points, questionType, step, title, umlModelAnswer, validMcqOptions.length]);

  const handleAddTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !selectedTags.includes(normalized)) {
      setSelectedTags([...selectedTags, normalized]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleTypeChange = (type: QuestionType) => {
    setQuestionType(type);
    setSelectedAssignmentId('');
  };

  const handleNext = () => {
    if (isLastStep || !canProceed) return;
    setSubmitIntent(false);
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (step === 0) return;
    setSubmitIntent(false);
    setStep((current) => current - 1);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isLastStep) {
      e.preventDefault();
      setSubmitIntent(false);
      if (canProceed) {
        handleNext();
      }
      return;
    }
    if (!submitIntent) {
      e.preventDefault();
      return;
    }
    setSubmitIntent(false);
    onSubmit(e);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <input type="hidden" name="qTitle" value={title} />
      <input type="hidden" name="qPrompt" value={prompt} />
      <input type="hidden" name="qPoints" value={String(points)} />
      <input type="hidden" name="tags" value={JSON.stringify(selectedTags)} />
      <input type="hidden" name="umlTemplateDiagram" value={umlTemplateDiagram} />
      <input type="hidden" name="umlModelAnswer" value={umlModelAnswer} />
      <input type="hidden" name="showCorrectAnswers" value={showCorrectAnswers ? 'on' : 'off'} />
      <input type="hidden" name="modelAnswer" value={modelAnswer} />
      <input type="hidden" name="mcqOptions" value={JSON.stringify(mcqOptions)} />

      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <p>
          <span className="font-medium">Step {step + 1} of {stepTitles.length}:</span> {stepTitles[step]}
        </p>
        <p className="text-xs text-gray-600 mt-1">{stepDescriptions[step]}</p>
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Pick the format first.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleTypeChange('written')}
              className={`rounded border px-3 py-2 text-sm font-medium ${
                questionType === 'written'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Written
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('mcq')}
              className={`rounded border px-3 py-2 text-sm font-medium ${
                questionType === 'mcq'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              MCQ
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('uml')}
              className={`rounded border px-3 py-2 text-sm font-medium ${
                questionType === 'uml'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              UML Diagram
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="create-question-title" className="block text-sm font-medium text-gray-700">Title</label>
            <input
              id="create-question-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input-block"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="create-question-prompt" className="block text-sm font-medium text-gray-700">Prompt (optional)</label>
            <textarea
              id="create-question-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="form-textarea-block"
            />
          </div>
          <div>
            <label htmlFor="create-question-points" className="block text-sm font-medium text-gray-700">Points</label>
            <input
              id="create-question-points"
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value) || 1)}
              min={1}
              className="form-input-block"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {questionType === 'mcq' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="block text-sm font-medium text-gray-700">Options</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Use the <span className="font-medium">Mark Correct</span> toggle on each option to set answer keys.
                  </p>
                </div>
                <label htmlFor="create-question-show-correct" className="flex items-center gap-2 text-sm">
                  <input
                    id="create-question-show-correct"
                    type="checkbox"
                    checked={showCorrectAnswers}
                    onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700">Show correct answers to students</span>
                </label>
              </div>

              {mcqOptions.map((option, index) => (
                <div
                  key={option.id}
                  className={`flex gap-3 items-start p-3 rounded-lg border ${
                    option.isCorrect ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-transparent'
                  }`}
                >
                  <div className="w-32 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMcqOptions(
                          mcqOptions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, isCorrect: !item.isCorrect } : item
                          )
                        );
                      }}
                      aria-pressed={option.isCorrect || false}
                      className={`w-full rounded-md px-3 py-2 text-xs font-semibold border transition-colors ${
                        option.isCorrect
                          ? 'bg-green-100 border-green-400 text-green-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                      title="Toggle correct answer"
                    >
                      {option.isCorrect ? 'Correct answer' : 'Mark as correct'}
                    </button>
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 mb-1">Option {index + 1}</p>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        setMcqOptions(
                          mcqOptions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, text: e.target.value } : item
                          )
                        );
                      }}
                      className="form-input w-full"
                      placeholder={`Option ${index + 1}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setMcqOptions(mcqOptions.filter((_, i) => i !== index))}
                    className="text-red-600 hover:text-red-800 font-bold text-xl pt-2"
                    disabled={mcqOptions.length <= 2}
                    title="Remove option"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setMcqOptions([
                    ...mcqOptions,
                    { id: crypto.randomUUID(), text: '', isCorrect: false },
                  ])
                }
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add option
              </button>

              {validMcqOptions.length < 2 && (
                <p className="text-sm text-amber-600">Add at least two non-empty options to continue.</p>
              )}
              {hasDuplicateMcqOptions && (
                <p className="text-sm text-amber-600">Options cannot have duplicate text.</p>
              )}
              {correctMcqOptionsCount === 0 && (
                <p className="text-sm text-amber-600">Select at least one correct option.</p>
              )}
              {correctMcqOptionsCount > 1 && (
                <p className="text-sm text-gray-600">
                  Multiple correct answers selected. Students can select multiple options, with penalty for wrong picks.
                </p>
              )}
            </div>
          )}

          {questionType === 'written' && (
            <div>
              <label htmlFor="create-question-model-answer" className="block text-sm font-medium text-gray-700">
                Model Answer (optional)
                <span className="text-gray-500 font-normal ml-2">- Reference for graders</span>
              </label>
              <textarea
                id="create-question-model-answer"
                value={modelAnswer}
                onChange={(e) => setModelAnswer(e.target.value)}
                rows={4}
                className="form-textarea-block"
                placeholder="Provide a reference answer to guide grading..."
                autoFocus
              />
            </div>
          )}

          {questionType === 'uml' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Build the answer key diagram</p>
                    <p className="mt-1 text-sm text-slate-600">
                      This hidden diagram is the grading reference for staff and auto-marking.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Hidden from students
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Model the full solution</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Include every class, interface, attribute, method, and relationship you expect in a correct answer.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Stay visual first</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Use the canvas to shape the diagram, then open PlantUML only when you want to inspect or refine the export.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Scaffold later</p>
                    <p className="mt-1 text-xs text-slate-500">
                      The next step is optional and only for student-facing starter diagrams. Keep the grading answer complete here.
                    </p>
                  </div>
                </div>
              </div>

              <UMLEditor
                initialValue={umlModelAnswer}
                initialDiagramState={umlModelDiagramState}
                onChange={(value, editorState) => {
                  setUmlModelAnswer(value);
                  setUmlModelDiagramState(editorState);
                }}
                height="min(68vh, 620px)"
              />

              {!hasMeaningfulUmlContent(umlModelAnswer) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Add at least one meaningful UML element before continuing.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {questionType === 'uml' && step === 3 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">Optional student starter diagram</p>
                <p className="mt-1 text-sm text-slate-600">
                  Use this only when students should begin from a partial scaffold instead of a blank canvas.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Visible to students
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">Use partial structure</p>
                <p className="mt-1 text-xs text-slate-500">
                  Good starter diagrams usually include the key boxes or one anchor relationship, not the full answer.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">Keep it optional</p>
                <p className="mt-1 text-xs text-slate-500">
                  Leave this empty if students should construct the diagram entirely from the prompt.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">Match the assessment goal</p>
                <p className="mt-1 text-xs text-slate-500">
                  Scaffold only the parts that are not being assessed, so the template guides without giving away the mark scheme.
                </p>
              </div>
            </div>
          </div>

          <UMLEditor
            initialValue={umlTemplateDiagram}
            initialDiagramState={umlTemplateDiagramState}
            onChange={(value, editorState) => {
              setUmlTemplateDiagram(value);
              setUmlTemplateDiagramState(editorState);
            }}
            height="min(60vh, 560px)"
          />
        </div>
      )}

      {step === assignmentStep && (
        <div className="space-y-4">
          <div>
            <label htmlFor="create-question-assignment" className="block text-sm font-medium text-gray-700">Add to Assignment (optional)</label>
            <select
              id="create-question-assignment"
              value={selectedAssignmentId}
              onChange={(event) => setSelectedAssignmentId(event.target.value)}
              className="form-select-block"
            >
              <option value="">-- None (add to question pool only) --</option>
              {availableAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="create-question-tag-input" className="block text-sm font-medium text-gray-700 mb-2">Tags</label>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-blue-600 hover:text-blue-800 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {tags.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Click to add existing tags:</p>
                <div className="flex flex-wrap gap-2">
                  {tags
                    .filter((tag) => !selectedTags.includes(tag))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                id="create-question-tag-input"
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(newTagInput);
                  }
                }}
                placeholder="Add new tag..."
                className="form-input flex-1"
              />
              <button
                type="button"
                onClick={() => handleAddTag(newTagInput)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
              >
                Add
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Tags are normalized (lowercase, trimmed).</p>
          </div>
        </div>
      )}

      {step === reviewStep && (
        <div className="space-y-3 rounded-md border border-gray-200 p-4 text-sm text-gray-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
            <p className="font-medium text-gray-900">{questionType.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Title</p>
            <p className="font-medium text-gray-900">{title}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Points</p>
            <p className="text-gray-900">{points}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Assignment</p>
            <p className="text-gray-900">
              {selectedAssignmentId
                ? availableAssignments.find((assignment) => assignment.id === selectedAssignmentId)?.title ??
                  'Selected assignment'
                : 'Question pool only'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Tags</p>
            <p className="text-gray-900">{selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0 || isSubmitting}
          className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        {isLastStep ? (
          <button
            type="submit"
            onClick={() => setSubmitIntent(true)}
            disabled={isSubmitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Question'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        )}
      </div>
    </form>
  );
}
