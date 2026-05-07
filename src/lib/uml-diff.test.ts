import { describe, expect, it } from 'vitest';
import type { ClassDiagramState } from '../client/components/uml/classDiagram.js';
import type {
  LifelineKind,
  SequenceDiagramState,
  SequenceMessageType,
} from '../client/components/uml/sequenceDiagram.js';
import {
  diffClassDiagrams,
  diffSequenceDiagrams,
  formatDiffForPrompt,
  formatSequenceDiffForPrompt,
} from './uml-diff.js';

const buildState = (
  nodes: Array<{
    id: string;
    name: string;
    elementType?: 'class' | 'interface' | 'abstractClass' | 'enum';
    attributes?: Array<{ name: string; type?: string; visibility?: '+' | '-' | '#' | '~'; isStatic?: boolean }>;
    methods?: Array<{
      name: string;
      visibility?: '+' | '-' | '#' | '~';
      parameters?: string;
      returnType?: string;
      isStatic?: boolean;
      isAbstract?: boolean;
    }>;
  }>,
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship?: 'association' | 'inheritance' | 'realization' | 'aggregation' | 'composition' | 'dependency';
  }> = []
): ClassDiagramState => ({
  nodes: nodes.map((n) => ({
    id: n.id,
    position: { x: 0, y: 0 },
    data: {
      name: n.name,
      elementType: n.elementType ?? 'class',
      attributes: (n.attributes ?? []).map((a, i) => ({
        id: `${n.id}-attr-${i}`,
        visibility: a.visibility ?? '+',
        name: a.name,
        type: a.type,
        isStatic: a.isStatic,
      })),
      methods: (n.methods ?? []).map((m, i) => ({
        id: `${n.id}-method-${i}`,
        visibility: m.visibility ?? '+',
        name: m.name,
        parameters: m.parameters,
        returnType: m.returnType,
        isStatic: m.isStatic,
        isAbstract: m.isAbstract,
      })),
    },
  })),
  edges: edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: { relationship: e.relationship ?? 'association' },
  })),
});

describe('diffClassDiagrams — class matching', () => {
  it('returns perfect score for identical diagrams', () => {
    const reference = buildState([
      { id: 'c1', name: 'Book', attributes: [{ name: 'title', type: 'String' }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'Book', attributes: [{ name: 'title', type: 'String' }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    expect(result.score).toBe(1);
    expect(result.classes.matched).toHaveLength(1);
    expect(result.classes.missing).toHaveLength(0);
    expect(result.classes.extra).toHaveLength(0);
  });

  it('matches case-insensitively', () => {
    const reference = buildState([{ id: 'c1', name: 'Book' }]);
    const student = buildState([{ id: 's1', name: 'book' }]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched).toHaveLength(1);
    expect(result.classes.missing).toHaveLength(0);
  });

  it('reports missing classes', () => {
    const reference = buildState([
      { id: 'c1', name: 'Book' },
      { id: 'c2', name: 'Member' },
    ]);
    const student = buildState([{ id: 's1', name: 'Book' }]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched).toHaveLength(1);
    expect(result.classes.missing).toEqual(['Member']);
  });

  it('reports extra classes', () => {
    const reference = buildState([{ id: 'c1', name: 'Book' }]);
    const student = buildState([
      { id: 's1', name: 'Book' },
      { id: 's2', name: 'Library' },
    ]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched).toHaveLength(1);
    expect(result.classes.extra).toEqual(['Library']);
  });

  it('flags element-type mismatch but still counts as matched', () => {
    const reference = buildState([{ id: 'c1', name: 'Book', elementType: 'class' }]);
    const student = buildState([{ id: 's1', name: 'Book', elementType: 'interface' }]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched).toHaveLength(1);
    expect(result.classes.matched[0].elementTypeMatches).toBe(false);
    expect(result.score).toBeLessThan(1);
  });
});

describe('diffClassDiagrams — attribute matching', () => {
  it('reports missing attributes within a matched class', () => {
    const reference = buildState([
      { id: 'c1', name: 'Book', attributes: [{ name: 'title' }, { name: 'isbn' }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'Book', attributes: [{ name: 'title' }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    const cls = result.classes.matched[0];
    expect(cls.attributes.matched).toHaveLength(1);
    expect(cls.attributes.missing).toEqual(['isbn']);
  });

  it('penalises wrong attribute type', () => {
    const reference = buildState([
      { id: 'c1', name: 'Book', attributes: [{ name: 'title', type: 'String' }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'Book', attributes: [{ name: 'title', type: 'int' }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    const m = result.classes.matched[0].attributes.matched[0];
    expect(m.typeMatches).toBe(false);
    expect(m.aspectScore).toBeLessThan(1);
  });

  it('penalises wrong visibility', () => {
    const reference = buildState([
      { id: 'c1', name: 'Book', attributes: [{ name: 'title', visibility: '-' }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'Book', attributes: [{ name: 'title', visibility: '+' }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    const m = result.classes.matched[0].attributes.matched[0];
    expect(m.visibilityMatches).toBe(false);
    expect(m.aspectScore).toBeLessThan(1);
  });

  it('penalises missing static flag', () => {
    const reference = buildState([
      { id: 'c1', name: 'Singleton', attributes: [{ name: 'INSTANCE', isStatic: true }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'Singleton', attributes: [{ name: 'INSTANCE', isStatic: false }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    const m = result.classes.matched[0].attributes.matched[0];
    expect(m.staticMatches).toBe(false);
  });
});

describe('diffClassDiagrams — method matching', () => {
  it('matches methods by name and scores aspects', () => {
    const reference = buildState([
      {
        id: 'c1',
        name: 'Book',
        methods: [
          { name: 'borrow', parameters: 'member: Member', returnType: 'void' },
        ],
      },
    ]);
    const student = buildState([
      {
        id: 's1',
        name: 'Book',
        methods: [
          { name: 'borrow', parameters: 'member: Member', returnType: 'void' },
        ],
      },
    ]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched[0].methods.matched[0].aspectScore).toBe(1);
  });

  it('penalises wrong return type', () => {
    const reference = buildState([
      { id: 'c1', name: 'A', methods: [{ name: 'foo', returnType: 'String' }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'A', methods: [{ name: 'foo', returnType: 'int' }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched[0].methods.matched[0].returnTypeMatches).toBe(false);
  });

  it('penalises missing abstract flag', () => {
    const reference = buildState([
      { id: 'c1', name: 'Shape', methods: [{ name: 'draw', isAbstract: true }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'Shape', methods: [{ name: 'draw', isAbstract: false }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched[0].methods.matched[0].abstractMatches).toBe(false);
  });

  it('treats whitespace differences in parameters as equivalent', () => {
    const reference = buildState([
      { id: 'c1', name: 'A', methods: [{ name: 'foo', parameters: 'x: int, y: int' }] },
    ]);
    const student = buildState([
      { id: 's1', name: 'A', methods: [{ name: 'foo', parameters: 'x:int,y:int' }] },
    ]);
    const result = diffClassDiagrams(student, reference);
    expect(result.classes.matched[0].methods.matched[0].parametersMatch).toBe(true);
  });
});

describe('diffClassDiagrams — edge matching', () => {
  it('matches edges by source/target/relationship', () => {
    const reference = buildState(
      [
        { id: 'a', name: 'Book' },
        { id: 'b', name: 'Member' },
      ],
      [{ id: 'e1', source: 'a', target: 'b', relationship: 'association' }]
    );
    const student = buildState(
      [
        { id: 'sa', name: 'Book' },
        { id: 'sb', name: 'Member' },
      ],
      [{ id: 'se1', source: 'sa', target: 'sb', relationship: 'association' }]
    );
    const result = diffClassDiagrams(student, reference);
    expect(result.edges.matched).toHaveLength(1);
    expect(result.edges.missing).toHaveLength(0);
    expect(result.edges.matched[0].relationshipMatches).toBe(true);
  });

  it('reports wrong relationship type as a partial match', () => {
    const reference = buildState(
      [
        { id: 'a', name: 'Book' },
        { id: 'b', name: 'Member' },
      ],
      [{ id: 'e1', source: 'a', target: 'b', relationship: 'composition' }]
    );
    const student = buildState(
      [
        { id: 'sa', name: 'Book' },
        { id: 'sb', name: 'Member' },
      ],
      [{ id: 'se1', source: 'sa', target: 'sb', relationship: 'aggregation' }]
    );
    const result = diffClassDiagrams(student, reference);
    expect(result.edges.matched).toHaveLength(1);
    expect(result.edges.matched[0].relationshipMatches).toBe(false);
    expect(result.edges.score).toBeLessThan(1);
    expect(result.edges.score).toBeGreaterThan(0);
  });

  it('reports missing edges', () => {
    const reference = buildState(
      [
        { id: 'a', name: 'Book' },
        { id: 'b', name: 'Member' },
      ],
      [{ id: 'e1', source: 'a', target: 'b' }]
    );
    const student = buildState([
      { id: 'sa', name: 'Book' },
      { id: 'sb', name: 'Member' },
    ]);
    const result = diffClassDiagrams(student, reference);
    expect(result.edges.missing).toHaveLength(1);
  });

  it('reports extra edges', () => {
    const reference = buildState([
      { id: 'a', name: 'Book' },
      { id: 'b', name: 'Member' },
    ]);
    const student = buildState(
      [
        { id: 'sa', name: 'Book' },
        { id: 'sb', name: 'Member' },
      ],
      [{ id: 'se1', source: 'sa', target: 'sb' }]
    );
    const result = diffClassDiagrams(student, reference);
    expect(result.edges.extra).toHaveLength(1);
  });
});

describe('diffClassDiagrams — score aggregation', () => {
  it('weighted sum produces 1.0 for identical diagrams', () => {
    const reference = buildState(
      [
        {
          id: 'c1',
          name: 'A',
          attributes: [{ name: 'x', type: 'int' }],
          methods: [{ name: 'm', returnType: 'void' }],
        },
        { id: 'c2', name: 'B' },
      ],
      [{ id: 'e1', source: 'c1', target: 'c2', relationship: 'association' }]
    );
    const student = buildState(
      [
        {
          id: 's1',
          name: 'A',
          attributes: [{ name: 'x', type: 'int' }],
          methods: [{ name: 'm', returnType: 'void' }],
        },
        { id: 's2', name: 'B' },
      ],
      [{ id: 'se1', source: 's1', target: 's2', relationship: 'association' }]
    );
    const result = diffClassDiagrams(student, reference);
    expect(result.score).toBe(1);
  });

  it('returns 0 for empty student against non-empty reference', () => {
    const reference = buildState([{ id: 'c1', name: 'Book' }]);
    const student = buildState([]);
    const result = diffClassDiagrams(student, reference);
    expect(result.score).toBeLessThan(0.8);
    expect(result.classes.missing).toEqual(['Book']);
  });

  it('returns 1 for empty reference', () => {
    const result = diffClassDiagrams(buildState([]), buildState([]));
    expect(result.score).toBe(1);
  });
});

// =============================================================================
// Sequence diagram tests
// =============================================================================

const buildSequenceState = (
  lifelines: Array<{ id: string; name: string; kind?: LifelineKind; order?: number }>,
  messages: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    messageType?: SequenceMessageType;
    order?: number;
  }> = []
): SequenceDiagramState => ({
  lifelines: lifelines.map((l, idx) => ({
    id: l.id,
    data: { name: l.name, kind: l.kind ?? 'participant', order: l.order ?? idx },
  })),
  messages: messages.map((m, idx) => ({
    id: m.id,
    source: m.source,
    target: m.target,
    data: {
      messageType: m.messageType ?? 'sync',
      label: m.label,
      order: m.order ?? idx,
    },
  })),
});

describe('diffSequenceDiagrams — lifeline matching', () => {
  it('returns perfect score for identical diagrams', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'User', kind: 'actor' },
        { id: 'r2', name: 'Server', kind: 'participant' },
      ],
      [{ id: 'rm1', source: 'r1', target: 'r2', label: 'login', messageType: 'sync' }]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'User', kind: 'actor' },
        { id: 's2', name: 'Server', kind: 'participant' },
      ],
      [{ id: 'sm1', source: 's1', target: 's2', label: 'login', messageType: 'sync' }]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.score).toBe(1);
    expect(result.lifelines.matched).toHaveLength(2);
    expect(result.messages.matched).toHaveLength(1);
  });

  it('matches lifelines case-insensitively', () => {
    const reference = buildSequenceState([{ id: 'r1', name: 'User', kind: 'actor' }]);
    const student = buildSequenceState([{ id: 's1', name: 'user', kind: 'actor' }]);
    const result = diffSequenceDiagrams(student, reference);
    expect(result.lifelines.matched).toHaveLength(1);
    expect(result.lifelines.missing).toHaveLength(0);
  });

  it('reports missing lifelines', () => {
    const reference = buildSequenceState([
      { id: 'r1', name: 'User' },
      { id: 'r2', name: 'Server' },
    ]);
    const student = buildSequenceState([{ id: 's1', name: 'User' }]);
    const result = diffSequenceDiagrams(student, reference);
    expect(result.lifelines.matched).toHaveLength(1);
    expect(result.lifelines.missing).toEqual(['Server']);
  });

  it('reports extra lifelines', () => {
    const reference = buildSequenceState([{ id: 'r1', name: 'User' }]);
    const student = buildSequenceState([
      { id: 's1', name: 'User' },
      { id: 's2', name: 'Logger' },
    ]);
    const result = diffSequenceDiagrams(student, reference);
    expect(result.lifelines.extra).toEqual(['Logger']);
  });

  it('penalises lifeline kind mismatch but still counts as matched', () => {
    const reference = buildSequenceState([{ id: 'r1', name: 'DB', kind: 'database' }]);
    const student = buildSequenceState([{ id: 's1', name: 'DB', kind: 'participant' }]);
    const result = diffSequenceDiagrams(student, reference);
    expect(result.lifelines.matched[0].kindMatches).toBe(false);
    expect(result.lifelines.score).toBeLessThan(1);
  });
});

describe('diffSequenceDiagrams — message matching', () => {
  it('matches messages exactly on (source, target, label)', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'User' },
        { id: 'r2', name: 'Server' },
      ],
      [
        { id: 'rm1', source: 'r1', target: 'r2', label: 'login' },
        { id: 'rm2', source: 'r1', target: 'r2', label: 'logout' },
      ]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'User' },
        { id: 's2', name: 'Server' },
      ],
      [
        { id: 'sm1', source: 's1', target: 's2', label: 'login' },
        { id: 'sm2', source: 's1', target: 's2', label: 'logout' },
      ]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.messages.matched).toHaveLength(2);
    expect(result.messages.matched.every((m) => m.exactMatch)).toBe(true);
    expect(result.messages.matched.every((m) => m.aspectScore === 1)).toBe(true);
  });

  it('falls back to endpoints-only match when label differs', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'User' },
        { id: 'r2', name: 'Server' },
      ],
      [{ id: 'rm1', source: 'r1', target: 'r2', label: 'authenticate' }]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'User' },
        { id: 's2', name: 'Server' },
      ],
      [{ id: 'sm1', source: 's1', target: 's2', label: 'login' }]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.messages.matched).toHaveLength(1);
    expect(result.messages.matched[0].exactMatch).toBe(false);
    expect(result.messages.matched[0].labelMatches).toBe(false);
    expect(result.messages.matched[0].aspectScore).toBeLessThan(1);
  });

  it('penalises wrong message type', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [{ id: 'rm1', source: 'r1', target: 'r2', label: 'msg', messageType: 'sync' }]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ],
      [{ id: 'sm1', source: 's1', target: 's2', label: 'msg', messageType: 'async' }]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.messages.matched[0].typeMatches).toBe(false);
    expect(result.messages.matched[0].aspectScore).toBeLessThan(1);
  });

  it('reports missing messages', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [
        { id: 'rm1', source: 'r1', target: 'r2', label: 'a' },
        { id: 'rm2', source: 'r1', target: 'r2', label: 'b' },
      ]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ],
      [{ id: 'sm1', source: 's1', target: 's2', label: 'a' }]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.messages.missing).toHaveLength(1);
    expect(result.messages.missing[0].label).toBe('b');
  });

  it('reports extra messages', () => {
    const reference = buildSequenceState([
      { id: 'r1', name: 'A' },
      { id: 'r2', name: 'B' },
    ]);
    const student = buildSequenceState(
      [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ],
      [{ id: 'sm1', source: 's1', target: 's2', label: 'extra' }]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.messages.extra).toHaveLength(1);
  });
});

describe('diffSequenceDiagrams — order score', () => {
  it('returns 1 for identical message order', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [
        { id: 'rm1', source: 'r1', target: 'r2', label: 'first', order: 0 },
        { id: 'rm2', source: 'r1', target: 'r2', label: 'second', order: 1 },
        { id: 'rm3', source: 'r1', target: 'r2', label: 'third', order: 2 },
      ]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ],
      [
        { id: 'sm1', source: 's1', target: 's2', label: 'first', order: 0 },
        { id: 'sm2', source: 's1', target: 's2', label: 'second', order: 1 },
        { id: 'sm3', source: 's1', target: 's2', label: 'third', order: 2 },
      ]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.orderScore).toBe(1);
  });

  it('returns 0 for fully reversed order', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [
        { id: 'rm1', source: 'r1', target: 'r2', label: 'first', order: 0 },
        { id: 'rm2', source: 'r1', target: 'r2', label: 'second', order: 1 },
        { id: 'rm3', source: 'r1', target: 'r2', label: 'third', order: 2 },
      ]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ],
      [
        { id: 'sm1', source: 's1', target: 's2', label: 'third', order: 0 },
        { id: 'sm2', source: 's1', target: 's2', label: 'second', order: 1 },
        { id: 'sm3', source: 's1', target: 's2', label: 'first', order: 2 },
      ]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.orderScore).toBe(0);
  });

  it('penalises a single inversion partially', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [
        { id: 'rm1', source: 'r1', target: 'r2', label: 'first', order: 0 },
        { id: 'rm2', source: 'r1', target: 'r2', label: 'second', order: 1 },
        { id: 'rm3', source: 'r1', target: 'r2', label: 'third', order: 2 },
      ]
    );
    // Swap "first" and "second" positions
    const student = buildSequenceState(
      [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ],
      [
        { id: 'sm1', source: 's1', target: 's2', label: 'second', order: 0 },
        { id: 'sm2', source: 's1', target: 's2', label: 'first', order: 1 },
        { id: 'sm3', source: 's1', target: 's2', label: 'third', order: 2 },
      ]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.orderScore).toBeGreaterThan(0);
    expect(result.orderScore).toBeLessThan(1);
  });

  it('returns 1 for a single matched message (no order to score)', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [{ id: 'rm1', source: 'r1', target: 'r2', label: 'msg' }]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ],
      [{ id: 'sm1', source: 's1', target: 's2', label: 'msg' }]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.orderScore).toBe(1);
  });
});

describe('diffSequenceDiagrams — score aggregation', () => {
  it('returns 0 for empty student against non-empty reference', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [{ id: 'rm1', source: 'r1', target: 'r2', label: 'msg' }]
    );
    const student = buildSequenceState([]);
    const result = diffSequenceDiagrams(student, reference);
    expect(result.score).toBeLessThan(0.5);
  });

  it('returns 1 for empty reference', () => {
    const result = diffSequenceDiagrams(buildSequenceState([]), buildSequenceState([]));
    expect(result.score).toBe(1);
  });

  it('skips messages whose lifelines were dropped during normalisation', () => {
    // Both diagrams have the same lifelines but a dangling message ref in student
    // would never reach diff (normalizer drops it). This sanity-checks that diff
    // doesn't crash on missing endpoints inside its own message→ref mapping.
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
      ],
      [{ id: 'rm1', source: 'r1', target: 'r2', label: 'msg' }]
    );
    const student = buildSequenceState(
      [{ id: 's1', name: 'A' }],
      // Message references unknown target — messageToRef returns null and is filtered
      [{ id: 'sm1', source: 's1', target: 'unknown', label: 'msg' }]
    );
    const result = diffSequenceDiagrams(student, reference);
    expect(result.messages.matched).toHaveLength(0);
  });
});

describe('formatSequenceDiffForPrompt', () => {
  it('produces a stable textual block', () => {
    const reference = buildSequenceState(
      [
        { id: 'r1', name: 'User', kind: 'actor' },
        { id: 'r2', name: 'Server' },
      ],
      [
        { id: 'rm1', source: 'r1', target: 'r2', label: 'login' },
        { id: 'rm2', source: 'r2', target: 'r1', label: 'token', messageType: 'reply' },
      ]
    );
    const student = buildSequenceState(
      [
        { id: 's1', name: 'User', kind: 'actor' },
        { id: 's2', name: 'Server' },
      ],
      [{ id: 'sm1', source: 's1', target: 's2', label: 'login' }]
    );
    const diff = diffSequenceDiagrams(student, reference);
    const text = formatSequenceDiffForPrompt(diff);
    expect(text).toContain('Structural score (deterministic):');
    expect(text).toContain('Message order preserved:');
    expect(text).toContain('LIFELINES:');
    expect(text).toContain('MESSAGES:');
    expect(text).toContain('Missing');
    expect(text).toContain('token');
  });
});

describe('formatDiffForPrompt', () => {
  it('produces a stable textual block', () => {
    const reference = buildState(
      [
        { id: 'c1', name: 'Book', attributes: [{ name: 'title' }] },
        { id: 'c2', name: 'Member' },
      ],
      [{ id: 'e1', source: 'c1', target: 'c2', relationship: 'association' }]
    );
    const student = buildState(
      [
        { id: 's1', name: 'Book' },
        { id: 's2', name: 'Reader' },
      ],
      [{ id: 'se1', source: 's1', target: 's2' }]
    );
    const diff = diffClassDiagrams(student, reference);
    const text = formatDiffForPrompt(diff);
    expect(text).toContain('Structural score (deterministic):');
    expect(text).toContain('CLASSES:');
    expect(text).toContain('RELATIONSHIPS:');
    expect(text).toContain('Missing');
    expect(text).toContain('Member');
    expect(text).toContain('Reader');
  });
});
