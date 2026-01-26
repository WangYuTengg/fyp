import { useState } from 'react';
import type { McqOption, Question } from '../../../lib/api';
import { UMLEditor } from '../../../components/UMLEditor';

type EditQuestionFormProps = {
  question: Question;
  onSubmit: (id: string, data: {
    title?: string;
    prompt?: string;
    points?: number;
    options?: McqOption[];
    tags?: string[];
    referenceDiagram?: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  availableTags: string[];
};

function getContent(content: unknown): { 
  prompt: string; 
  options?: McqOption[];
  referenceDiagram?: string;
} {
  if (typeof content !== 'object' || content === null) return { prompt: '' };
  const record = content as Record<string, unknown>;
  const prompt = typeof record.prompt === 'string' ? record.prompt : '';
  const options = Array.isArray(record.options) ? record.options as McqOption[] : undefined;
  const referenceDiagram = typeof record.referenceDiagram === 'string' ? record.referenceDiagram : undefined;
  return { prompt, options, referenceDiagram };
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
        }))
        .filter((option) => option.text.length > 0);

      if (options.length < 2) {
        alert('MCQ requires at least two options.');
        return;
      }

      updateData.options = options;
    } else if (question.type === 'uml') {
      if (!referenceDiagram.trim()) {
        alert('UML question requires a reference diagram.');
        return;
      }
      updateData.referenceDiagram = referenceDiagram;
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
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Points</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            min={1}
            className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
              className="flex-1 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Options</label>
            {mcqOptions.map((option, index) => (
              <input
                key={option.id}
                type="text"
                value={option.text}
                onChange={(e) => {
                  const value = e.target.value;
                  setMcqOptions(
                    mcqOptions.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, text: value } : item
                    )
                  );
                }}
                className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={`Option ${index + 1}`}
              />
            ))}
            <button
              type="button"
              onClick={() =>
                setMcqOptions([...mcqOptions, { id: crypto.randomUUID(), text: '' }])
              }
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Add option
            </button>
          </div>
        )}

        {/* UML Reference Diagram */}
        {question.type === 'uml' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Diagram (PlantUML)
            </label>
            <UMLEditor
              initialValue={referenceDiagram}
              onChange={setReferenceDiagram}
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
