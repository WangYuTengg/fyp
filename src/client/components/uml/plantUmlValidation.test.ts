import { describe, expect, it } from 'vitest';
import { validatePlantUml } from './plantUmlValidation';

describe('validatePlantUml — empty input', () => {
  it('returns no issues for empty text', () => {
    expect(validatePlantUml('')).toEqual([]);
    expect(validatePlantUml('   \n\t  ')).toEqual([]);
  });
});

describe('validatePlantUml — class diagram structural checks', () => {
  it('flags missing @startuml', () => {
    const text = 'class Foo\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('@startuml'))).toBe(true);
  });

  it('flags missing @enduml', () => {
    const text = '@startuml\nclass Foo';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('@enduml'))).toBe(true);
  });

  it('passes a minimal valid diagram', () => {
    const text = '@startuml\nclass Foo {\n  + bar()\n}\n@enduml';
    expect(validatePlantUml(text)).toEqual([]);
  });

  it('warns when @enduml comes before @startuml', () => {
    const text = '@enduml\n@startuml\nclass Foo\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.message.includes('before @startuml'))).toBe(true);
  });

  it('warns on multiple @startuml blocks', () => {
    const text = '@startuml\nclass A\n@enduml\n@startuml\nclass B\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('Multiple @startuml'))).toBe(true);
  });

  it('warns on empty diagram body', () => {
    const text = '@startuml\n\n\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.message.includes('empty'))).toBe(true);
  });
});

describe('validatePlantUml — brace balance', () => {
  it('flags unmatched opening brace', () => {
    const text = '@startuml\nclass Foo {\n  + bar()\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('"{"'))).toBe(true);
  });

  it('flags unmatched closing brace', () => {
    const text = '@startuml\nclass Foo\n}\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('"}"'))).toBe(true);
  });

  it('ignores braces inside quoted display names', () => {
    const text = '@startuml\nclass "Foo {bar}" as Baz\n@enduml';
    expect(validatePlantUml(text)).toEqual([]);
  });
});

describe('validatePlantUml — undeclared references', () => {
  it('warns when a relationship references an undeclared class', () => {
    const text = '@startuml\nclass Foo\nFoo --> Bar\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('"Bar"'))).toBe(true);
  });

  it('does not flag relationships when no classes are declared (relies on inference)', () => {
    const text = '@startuml\nFoo --> Bar\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.filter((i) => i.message.includes('referenced')).length).toBe(0);
  });

  it('handles abstract class and interface declarations', () => {
    const text = '@startuml\nabstract class Shape\ninterface Drawable\nclass Circle\nCircle --|> Shape\nCircle ..|> Drawable\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues.filter((i) => i.message.includes('referenced')).length).toBe(0);
  });

  it('handles aliased declarations with quoted names', () => {
    const text = '@startuml\nclass "Web Server" as WS\nclass Database\nWS --> Database\n@enduml';
    const issues = validatePlantUml(text);
    expect(issues).toEqual([]);
  });
});

describe('validatePlantUml — sequence diagrams', () => {
  it('passes a minimal valid sequence diagram', () => {
    const text = '@startuml\nactor User\nparticipant Server\nUser -> Server : request\nServer --> User : response\n@enduml';
    expect(validatePlantUml(text, 'sequence')).toEqual([]);
  });

  it('warns when an arrow targets an undeclared lifeline', () => {
    const text = '@startuml\nactor User\nUser -> Auth : login\n@enduml';
    const issues = validatePlantUml(text, 'sequence');
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('"Auth"'))).toBe(true);
  });

  it('handles all sequence stereotypes', () => {
    const text = '@startuml\nactor A\nparticipant B\ndatabase C\ncontrol D\nboundary E\nentity F\nA -> B\nB -> C\nC -> D\nD -> E\nE -> F\n@enduml';
    expect(validatePlantUml(text, 'sequence')).toEqual([]);
  });
});

describe('validatePlantUml — comment + label tolerance', () => {
  it('skips PlantUML single-quote comments', () => {
    const text = "@startuml\nclass Foo\n' this is a comment with { unmatched\nclass Bar\n@enduml";
    expect(validatePlantUml(text)).toEqual([]);
  });

  it('does not treat a label-leading colon as a comment terminator', () => {
    const text = '@startuml\nclass Foo\nclass Bar\nFoo --> Bar : "let\'s go"\n@enduml';
    expect(validatePlantUml(text)).toEqual([]);
  });
});
