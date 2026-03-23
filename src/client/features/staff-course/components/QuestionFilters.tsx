import type { ReactNode } from 'react';
import { type QuestionFilters } from '../hooks/useStaffCourse';

type QuestionFiltersProps = {
  filters: QuestionFilters;
  setFilters: (filters: QuestionFilters) => void;
  availableTags: string[];
  children?: ReactNode;
};

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'written', label: 'Written' },
  { value: 'coding', label: 'Coding' },
  { value: 'uml', label: 'UML' },
] as const;

export function QuestionFilters({ filters, setFilters, availableTags, children }: QuestionFiltersProps) {
  const handleSearchChange = (search: string) => {
    setFilters({ ...filters, search: search || undefined });
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    setFilters({ ...filters, tags: newTags.length > 0 ? newTags : undefined });
  };

  const handleTypeToggle = (type: 'mcq' | 'written' | 'coding' | 'uml') => {
    const currentTypes = filters.types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    setFilters({ ...filters, types: newTypes.length > 0 ? newTypes : undefined });
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = filters.search || filters.tags?.length || filters.types?.length;

  return (
    <div className="bg-gray-50 p-4 rounded-lg space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">Filters</h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search + Question Type + extra controls (inline) */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] max-w-sm">
          <label className="block text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            placeholder="Search title or description..."
            className="form-input-block"
          />
        </div>

        {/* Question Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Type
          </label>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((type) => {
              const isSelected = filters.types?.includes(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleTypeToggle(type.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {children && <div className="ml-auto flex flex-wrap items-end gap-3">{children}</div>}
      </div>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = filters.tags?.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
