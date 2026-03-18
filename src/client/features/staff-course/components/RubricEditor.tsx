import { useCallback, useEffect, useState } from 'react';
import { rubricsApi, type RubricCriterion } from '../../../lib/api';
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

type RubricLevel = {
  label: string;
  points: number;
  description?: string;
};

type CriterionDraft = {
  id: string;
  description: string;
  maxPoints: number;
  levels: RubricLevel[];
  expanded: boolean;
};

type RubricEditorProps = {
  questionId: string;
  questionPoints: number;
};

function createDefaultLevels(maxPoints: number): RubricLevel[] {
  return [
    { label: 'Excellent', points: maxPoints, description: '' },
    { label: 'Good', points: Math.round(maxPoints * 0.7), description: '' },
    { label: 'Fair', points: Math.round(maxPoints * 0.4), description: '' },
    { label: 'Poor', points: Math.round(maxPoints * 0.1), description: '' },
  ];
}

export function RubricEditor({ questionId, questionPoints }: RubricEditorProps) {
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load existing rubric
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await rubricsApi.getByQuestion(questionId);
        if (data.rubric && Array.isArray(data.rubric.criteria)) {
          setCriteria(
            (data.rubric.criteria as RubricCriterion[]).map((c) => ({
              ...c,
              levels: c.levels || [],
              expanded: false,
            }))
          );
        }
      } catch {
        // No rubric yet, that's fine
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [questionId]);

  const addCriterion = useCallback(() => {
    const remainingPoints = questionPoints - criteria.reduce((sum, c) => sum + c.maxPoints, 0);
    const points = Math.max(1, remainingPoints);

    setCriteria((prev) => [
      ...prev,
      {
        id: `criterion-${Date.now()}`,
        description: '',
        maxPoints: points,
        levels: createDefaultLevels(points),
        expanded: true,
      },
    ]);
  }, [criteria, questionPoints]);

  const removeCriterion = useCallback((index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCriterion = useCallback((index: number, updates: Partial<CriterionDraft>) => {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  }, []);

  const addLevel = useCallback((criterionIndex: number) => {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i === criterionIndex
          ? { ...c, levels: [...c.levels, { label: '', points: 0, description: '' }] }
          : c
      )
    );
  }, []);

  const updateLevel = useCallback(
    (criterionIndex: number, levelIndex: number, updates: Partial<RubricLevel>) => {
      setCriteria((prev) =>
        prev.map((c, i) =>
          i === criterionIndex
            ? {
                ...c,
                levels: c.levels.map((l, j) => (j === levelIndex ? { ...l, ...updates } : l)),
              }
            : c
        )
      );
    },
    []
  );

  const removeLevel = useCallback((criterionIndex: number, levelIndex: number) => {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i === criterionIndex
          ? { ...c, levels: c.levels.filter((_, j) => j !== levelIndex) }
          : c
      )
    );
  }, []);

  const handleSave = async () => {
    if (criteria.length === 0) {
      setError('Add at least one criterion');
      return;
    }

    for (const c of criteria) {
      if (!c.description.trim()) {
        setError('All criteria must have a description');
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await rubricsApi.save(
        questionId,
        criteria.map((c) => ({
          id: c.id,
          description: c.description,
          maxPoints: c.maxPoints,
          levels: c.levels.filter((l) => l.label.trim()),
        }))
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save rubric');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await rubricsApi.remove(questionId);
      setCriteria([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete rubric');
    } finally {
      setSaving(false);
    }
  };

  const totalPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading rubric...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Rubric</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className={totalPoints === questionPoints ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
            {totalPoints}/{questionPoints} pts
          </span>
          {totalPoints !== questionPoints ? (
            <span className="text-xs text-amber-500">
              ({totalPoints > questionPoints ? '+' : ''}{totalPoints - questionPoints})
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      ) : null}
      {success ? (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">Rubric saved.</div>
      ) : null}

      {/* Criteria list */}
      <div className="space-y-3">
        {criteria.map((criterion, cIdx) => (
          <div key={criterion.id} className="border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3 p-3">
              <button
                type="button"
                onClick={() => updateCriterion(cIdx, { expanded: !criterion.expanded })}
                className="mt-1 text-gray-400 hover:text-gray-600"
              >
                {criterion.expanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={criterion.description}
                  onChange={(event) => updateCriterion(cIdx, { description: event.target.value })}
                  placeholder="Criterion description"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={criterion.maxPoints}
                  onChange={(event) => {
                    const val = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
                    updateCriterion(cIdx, { maxPoints: val });
                  }}
                  min={1}
                  className="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm text-center"
                />
                <span className="text-xs text-gray-500">pts</span>
                <button
                  type="button"
                  onClick={() => removeCriterion(cIdx)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quality levels */}
            {criterion.expanded ? (
              <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase mb-2">Quality Levels</div>
                {criterion.levels.map((level, lIdx) => (
                  <div key={lIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={level.label}
                      onChange={(event) => updateLevel(cIdx, lIdx, { label: event.target.value })}
                      placeholder="Label (e.g. Excellent)"
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      value={level.points}
                      onChange={(event) =>
                        updateLevel(cIdx, lIdx, {
                          points: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                        })
                      }
                      min={0}
                      max={criterion.maxPoints}
                      className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                    />
                    <span className="text-xs text-gray-400">pts</span>
                    <input
                      type="text"
                      value={level.description || ''}
                      onChange={(event) => updateLevel(cIdx, lIdx, { description: event.target.value })}
                      placeholder="Description (optional)"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeLevel(cIdx, lIdx)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addLevel(cIdx)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Add level
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addCriterion}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
        >
          <PlusIcon className="h-4 w-4" /> Add Criterion
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || criteria.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Rubric'}
        </button>
        {criteria.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving}
            className="px-3 py-2 text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
          >
            Delete Rubric
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Interactive rubric checklist for manual grading.
 * Staff clicks a quality level → auto-fills that criterion's score.
 */
export function RubricGradingChecklist({
  rubric,
  onScoreChange,
}: {
  rubric: { criteria: RubricCriterion[] };
  onScoreChange: (totalPoints: number) => void;
}) {
  const [selectedLevels, setSelectedLevels] = useState<Record<string, number>>({});

  const handleSelectLevel = (criterionId: string, points: number) => {
    const updated = { ...selectedLevels, [criterionId]: points };
    setSelectedLevels(updated);
    const total = Object.values(updated).reduce((sum, p) => sum + p, 0);
    onScoreChange(total);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Rubric Checklist</h4>
      {rubric.criteria.map((criterion) => (
        <div key={criterion.id} className="border border-gray-200 rounded p-3">
          <div className="text-sm font-medium text-gray-800 mb-2">
            {criterion.description}
            <span className="text-gray-400 ml-1">({criterion.maxPoints} pts)</span>
          </div>
          {criterion.levels && criterion.levels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {criterion.levels.map((level, idx) => {
                const isSelected = selectedLevels[criterion.id] === level.points;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectLevel(criterion.id, level.points)}
                    className={`px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-100 border-blue-400 text-blue-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    title={level.description || undefined}
                  >
                    {level.label} ({level.points})
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="number"
              min={0}
              max={criterion.maxPoints}
              value={selectedLevels[criterion.id] || 0}
              onChange={(event) =>
                handleSelectLevel(
                  criterion.id,
                  Math.min(criterion.maxPoints, Math.max(0, Number.parseInt(event.target.value, 10) || 0))
                )
              }
              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          )}
        </div>
      ))}
      <div className="text-sm font-medium text-gray-900 pt-1 border-t border-gray-200">
        Total: {Object.values(selectedLevels).reduce((s, p) => s + p, 0)} /{' '}
        {rubric.criteria.reduce((s, c) => s + c.maxPoints, 0)} pts
      </div>
    </div>
  );
}
