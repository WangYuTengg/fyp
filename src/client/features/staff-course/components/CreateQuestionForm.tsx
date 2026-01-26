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
  const [umlDiagram, setUmlDiagram] = useState("");

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
    <div className="mb-6 p-4 border border-gray-200 rounded-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="tags" value={JSON.stringify(selectedTags)} />
        <input type="hidden" name="umlDiagram" value={umlDiagram} />
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            name="qTitle"
            required
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Prompt (optional)</label>
          <textarea
            name="qPrompt"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Points</label>
          <input
            type="number"
            name="qPoints"
            defaultValue={10}
            min={1}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Question Type</label>
          <select
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as "mcq" | "written" | "uml")}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
          <p className="mt-1 text-xs text-gray-500">Tags will be normalized (lowercase, trimmed)</p>
        </div>

        {questionType === "mcq" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Options</label>
            {mcqOptions.map((option, index) => (
              <input
                key={option.id}
                type="text"
                value={option.text}
                onChange={(event) => {
                  const value = event.target.value;
                  setMcqOptions(
                    mcqOptions.map((item, itemIndex) => (itemIndex === index ? { ...item, text: value } : item)),
                  );
                }}
                className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={`Option ${index + 1}`}
              />
            ))}
            <button
              type="button"
              onClick={() => setMcqOptions([...mcqOptions, { id: crypto.randomUUID(), text: "" }])}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Add option
            </button>
          </div>
        )}

        {questionType === "uml" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference UML Diagram
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Create a reference diagram that students will see as an example or template.
            </p>
            <UMLEditor 
              initialValue={umlDiagram}
              onChange={setUmlDiagram}
              height="300px"
            />
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
    </div>
  );
}
