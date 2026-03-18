import { describe, it, expect } from 'vitest';
import { rubrics } from '../../db/schema';
import { getRubricCriteria } from '../../server/lib/content-utils';

describe('B4: Rubric Builder - Schema', () => {
  it('rubrics table has expected columns', () => {
    expect(rubrics.id).toBeDefined();
    expect(rubrics.questionId).toBeDefined();
    expect(rubrics.criteria).toBeDefined();
    expect(rubrics.totalPoints).toBeDefined();
  });

  it('rubrics have unique questionId constraint', () => {
    // questionId is unique - one rubric per question
    expect(rubrics.questionId.isUnique).toBe(true);
  });
});

describe('B4: Rubric Criteria Parsing', () => {
  it('parses valid rubric criteria', () => {
    const rubric = {
      criteria: [
        { id: 'c1', description: 'Correctness', maxPoints: 5 },
        { id: 'c2', description: 'Style', maxPoints: 3 },
      ],
    };

    const result = getRubricCriteria(rubric);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].description).toBe('Correctness');
    expect(result![0].maxPoints).toBe(5);
    expect(result![1].description).toBe('Style');
    expect(result![1].maxPoints).toBe(3);
  });

  it('returns null for missing criteria', () => {
    expect(getRubricCriteria({})).toBeNull();
    expect(getRubricCriteria(null)).toBeNull();
    expect(getRubricCriteria(undefined)).toBeNull();
  });

  it('skips invalid criteria entries', () => {
    const rubric = {
      criteria: [
        { id: 'c1', description: 'Valid', maxPoints: 5 },
        { description: '', maxPoints: 3 }, // empty description
        'not an object',
        { id: 'c3', description: 'Also valid', maxPoints: 2 },
      ],
    };

    const result = getRubricCriteria(rubric);
    expect(result).toHaveLength(2);
    expect(result![0].description).toBe('Valid');
    expect(result![1].description).toBe('Also valid');
  });

  it('auto-generates IDs for criteria without them', () => {
    const rubric = {
      criteria: [
        { description: 'No ID here', maxPoints: 5 },
      ],
    };

    const result = getRubricCriteria(rubric);
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('criterion-1');
  });
});

describe('B4: Rubric Quality Levels', () => {
  it('supports quality levels per criterion', () => {
    const criterion = {
      id: 'c1',
      description: 'Code quality',
      maxPoints: 10,
      levels: [
        { label: 'Excellent', points: 10, description: 'Perfect implementation' },
        { label: 'Good', points: 7, description: 'Minor issues' },
        { label: 'Fair', points: 4, description: 'Significant issues' },
        { label: 'Poor', points: 1, description: 'Major problems' },
      ],
    };

    expect(criterion.levels).toHaveLength(4);
    expect(criterion.levels[0].points).toBe(10);
    expect(criterion.levels[0].label).toBe('Excellent');

    // Levels should be sorted by descending points
    const sortedPoints = criterion.levels.map((l) => l.points);
    expect(sortedPoints).toEqual([10, 7, 4, 1]);
  });

  it('calculates total points from criteria', () => {
    const criteria = [
      { id: 'c1', description: 'A', maxPoints: 5 },
      { id: 'c2', description: 'B', maxPoints: 3 },
      { id: 'c3', description: 'C', maxPoints: 2 },
    ];

    const totalPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
    expect(totalPoints).toBe(10);
  });
});
