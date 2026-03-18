import { describe, it, expect } from 'vitest';
import { assignments } from '../../db/schema';

describe('B6: Batch Publish Results - Schema', () => {
  it('has resultsPublished column on assignments', () => {
    expect(assignments.resultsPublished).toBeDefined();
    expect(assignments.resultsPublished.name).toBe('results_published');
  });

  it('has resultsPublishedAt column on assignments', () => {
    expect(assignments.resultsPublishedAt).toBeDefined();
    expect(assignments.resultsPublishedAt.name).toBe('results_published_at');
  });

  it('resultsPublished defaults to false', () => {
    expect(assignments.resultsPublished.hasDefault).toBe(true);
  });
});
