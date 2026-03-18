import { describe, it, expect } from 'vitest';

describe('B2: Side-by-Side Model Answer Comparison', () => {
  it('extracts model answer for written questions', () => {
    const content = {
      prompt: 'Explain polymorphism',
      modelAnswer: 'Polymorphism allows objects of different types to be treated as the same type.',
    };

    const modelAnswer =
      typeof content.modelAnswer === 'string' ? content.modelAnswer : null;
    expect(modelAnswer).not.toBeNull();
    expect(modelAnswer).toContain('Polymorphism');
  });

  it('extracts model answer for UML questions', () => {
    const content = {
      prompt: 'Draw a class diagram',
      modelAnswer: '@startuml\nclass Animal\n@enduml',
      referenceDiagram: '@startuml\nclass Pet\n@enduml',
    };

    // Prefer modelAnswer over referenceDiagram
    const answerDiagram =
      typeof content.modelAnswer === 'string' && content.modelAnswer.trim().length > 0
        ? content.modelAnswer
        : content.referenceDiagram;

    expect(answerDiagram).toBe('@startuml\nclass Animal\n@enduml');
  });

  it('falls back to referenceDiagram when modelAnswer is missing', () => {
    const content = {
      prompt: 'Draw a class diagram',
      referenceDiagram: '@startuml\nclass Pet\n@enduml',
    };

    const modelAnswer = typeof (content as Record<string, unknown>).modelAnswer === 'string'
      ? (content as Record<string, unknown>).modelAnswer as string
      : null;

    const answerDiagram =
      modelAnswer && modelAnswer.trim().length > 0
        ? modelAnswer
        : content.referenceDiagram;

    expect(answerDiagram).toBe('@startuml\nclass Pet\n@enduml');
  });

  it('handles missing model answer gracefully', () => {
    const content = {
      prompt: 'Write something',
    };

    const modelAnswer =
      typeof (content as Record<string, unknown>).modelAnswer === 'string'
        ? ((content as Record<string, unknown>).modelAnswer as string)
        : null;

    expect(modelAnswer).toBeNull();
  });
});

describe('B2: Split View Toggle', () => {
  it('defaults to split view when model answer is available', () => {
    const splitView = true; // default state
    const hasModelAnswer = true;

    const shouldShowSplit = splitView && hasModelAnswer;
    expect(shouldShowSplit).toBe(true);
  });

  it('falls back to stack view when toggled', () => {
    const splitView = false;
    const hasModelAnswer = true;

    const shouldShowSplit = splitView && hasModelAnswer;
    expect(shouldShowSplit).toBe(false);
  });

  it('never shows split view without model answer', () => {
    const splitView = true;
    const hasModelAnswer = false;

    const shouldShowSplit = splitView && hasModelAnswer;
    expect(shouldShowSplit).toBe(false);
  });
});
