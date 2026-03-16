import { useMemo, useState } from 'react';
import type { McqOption, Question } from '../../../lib/api';
import { useClampedPage } from '../../../hooks/useClampedPage';
import { filterQuestions, type QuestionFilters } from '../utils/question-utils';
import { EditQuestionForm } from './EditQuestionForm';
import { QuestionCard } from './QuestionCard';
import { QuestionFilters as QuestionFiltersComponent } from './QuestionFilters';

type QuestionPoolPanelProps = {
  questions: Question[];
  availableTags: string[];
  onDelete?: (questionId: string) => void;
  onEdit?: (
    id: string,
    data: {
      title?: string;
      prompt?: string;
      points?: number;
      options?: McqOption[];
      allowMultiple?: boolean;
      tags?: string[];
      referenceDiagram?: string;
      showCorrectAnswers?: boolean;
      modelAnswer?: string;
    }
  ) => void;
};

type QuestionSort = 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'points-asc' | 'points-desc';
type QuestionViewMode = 'cards' | 'table';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const SORT_OPTIONS: Array<{ value: QuestionSort; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'points-desc', label: 'Points high-low' },
  { value: 'points-asc', label: 'Points low-high' },
];

function sortQuestions(questions: Question[], sort: QuestionSort): Question[] {
  const sorted = [...questions];

  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'title-asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case 'points-asc':
      return sorted.sort((a, b) => a.points - b.points);
    case 'points-desc':
      return sorted.sort((a, b) => b.points - a.points);
    default:
      return sorted;
  }
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleDateString();
}

function getPageNumbers(totalPages: number, currentPage: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export function QuestionPoolPanel({ questions, availableTags, onDelete, onEdit }: QuestionPoolPanelProps) {
  const [filters, setFilters] = useState<QuestionFilters>({});
  const [sort, setSort] = useState<QuestionSort>('newest');
  const [pageSize, setPageSize] = useState<number>(25);
  const [viewMode, setViewMode] = useState<QuestionViewMode>(() =>
    questions.length > 80 ? 'table' : 'cards'
  );
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const filteredQuestions = useMemo(() => filterQuestions(questions, filters), [questions, filters]);
  const sortedQuestions = useMemo(() => sortQuestions(filteredQuestions, sort), [filteredQuestions, sort]);
  const totalQuestions = sortedQuestions.length;
  const totalPages = Math.max(1, Math.ceil(totalQuestions / pageSize));
  const { page, setPage, resetPage } = useClampedPage(totalPages);

  const pagedQuestions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedQuestions.slice(start, start + pageSize);
  }, [page, pageSize, sortedQuestions]);

  const typeCounts = useMemo(() => {
    return questions.reduce(
      (acc, question) => {
        acc[question.type] += 1;
        return acc;
      },
      { mcq: 0, written: 0, coding: 0, uml: 0 }
    );
  }, [questions]);

  const hasActiveFilters = Boolean(filters.search || filters.tags?.length || filters.types?.length);

  const activeFilterCount =
    (filters.search ? 1 : 0) + (filters.tags?.length ?? 0) + (filters.types?.length ?? 0);

  const pageStart = totalQuestions === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalQuestions);
  const pageRangeLabel = totalQuestions === 0 ? '0' : `${pageStart}-${pageEnd}`;
  const pageNumbers = getPageNumbers(totalPages, page);

  const editingQuestion = useMemo(
    () => sortedQuestions.find((question) => question.id === editingQuestionId) ?? null,
    [editingQuestionId, sortedQuestions]
  );

  const handleDelete = (question: Question) => {
    if (!onDelete) {
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${question.title}"?`)) {
      onDelete(question.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-600">
              Total pool size: <span className="font-semibold text-gray-900">{questions.length}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              MCQ {typeCounts.mcq} | Written {typeCounts.written} | UML {typeCounts.uml} | Coding {typeCounts.coding}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="question-pool-sort" className="block text-xs font-medium text-gray-600">
                Sort
              </label>
              <select
                id="question-pool-sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as QuestionSort);
                  resetPage();
                }}
                className="form-select-block"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="question-pool-page-size" className="block text-xs font-medium text-gray-600">
                Per page
              </label>
              <select
                id="question-pool-page-size"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  resetPage();
                }}
                className="form-select-block"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="block text-xs font-medium text-gray-600 mb-1">View</p>
              <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <QuestionFiltersComponent
        filters={filters}
        setFilters={(nextFilters) => {
          setFilters(nextFilters);
          resetPage();
        }}
        availableTags={availableTags}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium text-gray-900">{pageRangeLabel}</span> of{' '}
          <span className="font-medium text-gray-900">{totalQuestions}</span> questions
          {hasActiveFilters && (
            <span className="ml-2 text-xs text-blue-700">
              ({activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'})
            </span>
          )}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters({});
              resetPage();
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Reset filters
          </button>
        )}
      </div>

      {totalQuestions === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-700 font-medium">No questions match your filters.</p>
          <p className="text-sm text-gray-500 mt-1">Try clearing filters or creating a new question.</p>
        </div>
      ) : (
        <>
          {viewMode === 'cards' ? (
            <div className="space-y-4">
              {pagedQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  availableTags={availableTags}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Title
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Points
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Tags
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Updated
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedQuestions.map((question) => (
                    <tr key={question.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-gray-900">{question.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{question.description || 'No description'}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">{question.type.toUpperCase()}</td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">{question.points}</td>
                      <td className="px-4 py-3 align-top">
                        {question.tags && question.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {question.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No tags</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-600">{formatDate(question.updatedAt)}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => setEditingQuestionId(question.id)}
                              className="rounded px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(question)}
                              className="rounded px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'table' && editingQuestion && onEdit && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit: {editingQuestion.title}</h3>
              <EditQuestionForm
                question={editingQuestion}
                availableTags={availableTags}
                onSubmit={(id, data) => {
                  onEdit(id, data);
                  setEditingQuestionId(null);
                }}
                onCancel={() => setEditingQuestionId(null)}
              />
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`px-2 py-1 text-sm rounded border ${
                      pageNumber === page
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
