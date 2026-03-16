import { useState } from 'react';
import type { McqOption, Question } from '../../../lib/api';
import { UMLEditor } from '../../../components/UMLEditor';
import type { ClassDiagramState } from '../../../components/uml/classDiagram';

type EditQuestionFormProps = {
  question: Question;
  onSubmit: (id: string, data: {
    title?: string;
    prompt?: string;
    points?: number;
    options?: McqOption[];
    allowMultiple?: boolean;
    tags?: string[];
    referenceDiagram?: string;
    showCorrectAnswers?: boolean;
    modelAnswer?: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  availableTags: string[];
};

const hasMeaningfulUmlContent = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => line !== '@startuml' && line !== '@enduml');

function getContent(content: unknown): { 
  prompt: string; 
  options?: McqOption[];
  referenceDiagram?: string;
  showCorrectAnswers?: boolean;
  modelAnswer?: string;
} {
  if (typeof content !== 'object' || content === null) return { prompt: '' };
  const record = content as Record<string, unknown>;
  const prompt = typeof record.prompt === 'string' ? record.prompt : '';
  const options = Array.isArray(record.options) ? record.options as McqOption[] : undefined;
  const referenceDiagram = typeof record.referenceDiagram === 'string' ? record.referenceDiagram : undefined;
  const showCorrectAnswers = typeof record.showCorrectAnswers === 'boolean' ? record.showCorrectAnswers : false;
  const modelAnswer = typeof record.modelAnswer === 'string' ? record.modelAnswer : '';
  return { prompt, options, referenceDiagram, showCorrectAnswers, modelAnswer };
}

export function EditQuestionForm({
  question,
  onSubmit,
  onCancel,
  isSubmitting = false,
  availableTags,
}: EditQuestionFormProps) {
  const content = getContent(question.content);
  const [title, setTitle] = useState(question.title);
  const [prompt, setPrompt] = useState(content.prompt);
  const [points, setPoints] = useState(question.points);
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>(
    content.options || []
  );
  const [referenceDiagram, setReferenceDiagram] = useState(content.referenceDiagram || '');
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(content.showCorrectAnswers || false);
  const [modelAnswer, setModelAnswer] = useState(content.modelAnswer || '');
  const [referenceDiagramState, setReferenceDiagramState] = useState<ClassDiagramState | undefined>(undefined);
  const [modelAnswerDiagramState, setModelAnswerDiagramState] = useState<ClassDiagramState | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>(question.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updateData: Parameters<typeof onSubmit>[1] = {
      title,
      prompt,
      points,
      tags: selectedTags,
    };

    if (question.type === 'mcq') {
      const options = mcqOptions
        .map((option) => ({
          id: option.id || crypto.randomUUID(),
          text: option.text.trim(),
          isCorrect: option.isCorrect || false,
        }))
        .filter((option) => option.text.length > 0);

      if (options.length < 2) {
        alert('MCQ requires at least two options.');
        return;
      }

      const optionTextSet = new Set<string>();
      for (const option of options) {
        if (optionTextSet.has(option.text)) {
          alert('MCQ options must be unique.');
          return;
        }
        optionTextSet.add(option.text);
      }

      const correctOptionsCount = options.filter((option) => option.isCorrect).length;
      if (correctOptionsCount === 0) {
        alert('MCQ requires at least one correct option.');
        return;
      }

      updateData.options = options;
      updateData.allowMultiple = correctOptionsCount > 1;
      updateData.showCorrectAnswers = showCorrectAnswers;
    } else if (question.type === 'written') {
      updateData.modelAnswer = modelAnswer;
    } else if (question.type === 'uml') {
      if (!hasMeaningfulUmlContent(modelAnswer)) {
        alert('UML question requires an answer diagram (PlantUML code).');
        return;
      }
      // modelAnswer is used for grading; referenceDiagram is optional template shown to students.
      updateData.modelAnswer = modelAnswer.trim() || undefined;
      updateData.referenceDiagram = referenceDiagram.trim() || undefined;
    }

    onSubmit(question.id, updateData);
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
      <h4 className="text-lg font-semibold mb-4">Edit Question</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="form-input-block"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="form-textarea-block"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Points</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            min={1}
            className="form-input-block"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          
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

          {availableTags.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">Click to add existing tags:</p>
              <div className="flex flex-wrap gap-2">
                {availableTags
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
        </div>

        {/* MCQ Options */}
        {question.type === 'mcq' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Options</label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showCorrectAnswers}
                  onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-gray-700">Show correct answers to students</span>
              </label>
            </div>
            
            {mcqOptions.map((option, index) => (
              <div key={option.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center pt-3">
                  <input
                    type="checkbox"
                    checked={option.isCorrect || false}
                    onChange={(e) => {
                      setMcqOptions(
                        mcqOptions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, isCorrect: e.target.checked } : item
                        )
                      );
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    title="Mark as correct answer"
                  />
                </div>
                
                <div className="flex-1">
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
                setMcqOptions([...mcqOptions, { id: crypto.randomUUID(), text: '', isCorrect: false }])
              }
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Add option
            </button>
          </div>
        )}

        {question.type === 'uml' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Answer UML Diagram (for grading)</label>
              <UMLEditor
                initialValue={modelAnswer}
                initialDiagramState={modelAnswerDiagramState}
                onChange={(value, editorState) => {
                  setModelAnswer(value);
                  setModelAnswerDiagramState(editorState);
                }}
                height="min(68vh, 620px)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Template / Reference Diagram (optional)</label>
              <UMLEditor
                initialValue={referenceDiagram}
                initialDiagramState={referenceDiagramState}
                onChange={(value, editorState) => {
                  setReferenceDiagram(value);
                  setReferenceDiagramState(editorState);
                }}
                height="min(60vh, 560px)"
              />
            </div>
          </div>
        )}

        {/* Written Model Answer */}
        {question.type === 'written' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Model Answer (optional)
              <span className="text-gray-500 font-normal ml-2">- Reference for graders</span>
            </label>
            <textarea
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
              rows={4}
              className="form-textarea-block"
              placeholder="Provide a reference answer to guide grading..."
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
