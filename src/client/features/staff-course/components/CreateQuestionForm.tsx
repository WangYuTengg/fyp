import { useState } from "react";
import type { McqOption } from "../../../lib/api";
import type { StaffAssignment } from "../types";
import { UMLEditor } from "../../../components/UMLEditor";

type CreateQuestionFormProps = {
  questionType: "mcq" | "written" | "uml";
  setQuestionType: (type: "mcq" | "written" | "uml") => void;
  mcqOptions: McqOption[];
  setMcqOptions: (options: McqOption[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  assignments: StaffAssignment[];
  selectedAssignmentId: string;
  setSelectedAssignmentId: (id: string) => void;
  tags: string[];
};

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [umlTemplateDiagram, setUmlTemplateDiagram] = useState("");
  const [umlModelAnswer, setUmlModelAnswer] = useState("");

  const handleAddTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !selectedTags.includes(normalized)) {
      setSelectedTags([...selectedTags, normalized]);
    }
    setNewTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Add tags to form data
    const formData = new FormData(e.currentTarget);
    formData.set("tags", JSON.stringify(selectedTags));
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="tags" value={JSON.stringify(selectedTags)} />
        <input type="hidden" name="umlTemplateDiagram" value={umlTemplateDiagram} />
        <input type="hidden" name="umlModelAnswer" value={umlModelAnswer} />
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            name="qTitle"
            required
            className="form-input-block"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Prompt (optional)</label>
          <textarea
            name="qPrompt"
            rows={3}
            className="form-textarea-block"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Points</label>
          <input
            type="number"
            name="qPoints"
            defaultValue={10}
            min={1}
            className="form-input-block"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Question Type</label>
          <select
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as "mcq" | "written" | "uml")}
            className="form-select-block"
          >
            <option value="written">Written</option>
            <option value="mcq">MCQ</option>
            <option value="uml">UML Diagram</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Add to Assignment (optional)</label>
          <select
            value={selectedAssignmentId}
            onChange={(event) => setSelectedAssignmentId(event.target.value)}
            className="form-select-block"
          >
            <option value="">-- None (add to question pool only) --</option>
            {assignments
              .filter((a) => a.type === questionType)
              .map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Only {questionType.toUpperCase()} assignments are shown</p>
        </div>

        {/* Tags Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>

          {/* Selected tags chips */}
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

          {/* Existing tags */}
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

          {/* New tag input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
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
          <p className="mt-1 text-xs text-gray-500">Tags will be normalized (lowercase, trimmed)</p>
        </div>

        {questionType === "mcq" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Options</label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="showCorrectAnswers"
                  defaultChecked={false}
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
                
                <div className="w-24">
                  <input
                    type="number"
                    value={option.points ?? 0}
                    onChange={(e) => {
                      setMcqOptions(
                        mcqOptions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, points: Number(e.target.value) } : item
                        )
                      );
                    }}
                    className="form-input w-full"
                    placeholder="Points"
                    min="0"
                    step="0.5"
                  />
                  <p className="text-xs text-gray-500 mt-1">Points</p>
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
              onClick={() => setMcqOptions([
                ...mcqOptions,
                { id: crypto.randomUUID(), text: "", points: 0, isCorrect: false }
              ])}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Add option
            </button>
            
            <input type="hidden" name="mcqOptions" value={JSON.stringify(mcqOptions)} />
          </div>
        )}

        {questionType === "written" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Model Answer (optional)
              <span className="text-gray-500 font-normal ml-2">- Reference for graders</span>
            </label>
            <textarea
              name="modelAnswer"
              rows={4}
              className="form-textarea-block"
              placeholder="Provide a reference answer to guide grading..."
            />
          </div>
        )}

        {questionType === "uml" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer UML Diagram (for grading)
            </label>
            <p className="text-sm text-gray-600 mb-3">
              This is the expected solution used by staff/auto-grading. Students will not see this.
            </p>
            <UMLEditor
              initialValue={umlModelAnswer}
              onChange={setUmlModelAnswer}
              height="300px"
            />

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template / Reference Diagram (optional)
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Optional starter diagram shown to students (e.g., a partial diagram or scaffold).
              </p>
              <UMLEditor
                initialValue={umlTemplateDiagram}
                onChange={setUmlTemplateDiagram}
                height="250px"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating..." : "Create Question"}
        </button>
      </form>
  );
}
