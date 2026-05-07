import { describe, expect, it } from 'vitest';
import { prompts } from './prompts.js';

describe('UML prompt: userTextWithDiff', () => {
  const baseParams = {
    studentUML: '@startuml\nclass A\n@enduml',
    referenceUML: '@startuml\nclass A\nclass B\n@enduml',
    maxPoints: 10,
    diffSummary:
      'Structural score (deterministic): 50.0%\n\nCLASSES:\n  Matched (1):\n    - A [class]\n  Missing (1): B',
    structuralScore: 0.5,
  };

  it('v1 includes diff summary, baseline, both PlantUML blocks, and rubric anchoring guidance', () => {
    const out = prompts.uml.v1.userTextWithDiff(baseParams);
    expect(out).toContain('Structural diff:');
    expect(out).toContain(baseParams.diffSummary);
    expect(out).toContain('50.0%');
    expect(out).toContain('Student PlantUML Code');
    expect(out).toContain('Reference PlantUML Code');
    expect(out).toContain(baseParams.studentUML);
    expect(out).toContain(baseParams.referenceUML);
    expect(out).toContain('Maximum Points:** 10');
    // Naming/design language is what differentiates this from the baseline prompt
    expect(out.toLowerCase()).toContain('naming');
  });

  it('v1 with rubric mentions per-criterion scoring guidance', () => {
    const out = prompts.uml.v1.userTextWithDiff({
      ...baseParams,
      rubric: [
        { id: 'r1', description: 'Correctness', maxPoints: 5 },
        { id: 'r2', description: 'Naming', maxPoints: 5 },
      ],
    });
    expect(out).toContain('Grading Rubric');
    expect(out).toContain('Correctness');
    expect(out).toContain('Naming');
    expect(out.toLowerCase()).toContain('structural');
  });

  it('v2 emphasises architecture/design judgement on top of diff baseline', () => {
    const out = prompts.uml.v2.userTextWithDiff(baseParams);
    expect(out).toContain('Structural diff');
    expect(out).toContain(baseParams.diffSummary);
    // v2 distinguishes itself with stronger design/architectural language
    expect(out.toLowerCase()).toContain('design');
    expect(out.toLowerCase()).toContain('pattern');
  });

  it('extreme structural scores are formatted to one decimal place', () => {
    const zero = prompts.uml.v1.userTextWithDiff({ ...baseParams, structuralScore: 0 });
    expect(zero).toContain('0.0%');
    const full = prompts.uml.v1.userTextWithDiff({ ...baseParams, structuralScore: 1 });
    expect(full).toContain('100.0%');
  });
});
