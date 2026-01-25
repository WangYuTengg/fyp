type TagManagerProps = {
  tags: string[];
};

export function TagManager({ tags }: TagManagerProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold text-gray-700 mb-3">Course Tags</h3>
      
      {tags.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No tags yet. Tags are automatically created when you add them to questions.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      
      <p className="text-xs text-gray-500 mt-3">
        Tags are managed through question creation and editing. Add tags to questions to build your tag library.
      </p>
    </div>
  );
}
