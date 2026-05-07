import { describe, expect, it } from 'vitest';
import {
  generateClassDiagramPlantUml,
  normalizeClassDiagramState,
  parseLegacyAttribute,
  parseLegacyMethod,
  type ClassDiagramState,
} from './classDiagram';

describe('parseLegacyAttribute', () => {
  it('parses public attribute with type', () => {
    const result = parseLegacyAttribute('+ name: String');
    expect(result.visibility).toBe('+');
    expect(result.name).toBe('name');
    expect(result.type).toBe('String');
    expect(result.isStatic).toBeUndefined();
    expect(result.id).toBeTruthy();
  });

  it('parses each visibility marker', () => {
    expect(parseLegacyAttribute('- secret: int').visibility).toBe('-');
    expect(parseLegacyAttribute('# protectedField').visibility).toBe('#');
    expect(parseLegacyAttribute('~ packageField').visibility).toBe('~');
  });

  it('defaults to public when no visibility present', () => {
    const result = parseLegacyAttribute('count: int');
    expect(result.visibility).toBe('+');
    expect(result.name).toBe('count');
    expect(result.type).toBe('int');
  });

  it('parses default value', () => {
    const result = parseLegacyAttribute('+ status: String = "active"');
    expect(result.name).toBe('status');
    expect(result.type).toBe('String');
    expect(result.defaultValue).toBe('"active"');
  });

  it('parses {static} flag', () => {
    const result = parseLegacyAttribute('+ {static} INSTANCE: Singleton');
    expect(result.isStatic).toBe(true);
    expect(result.name).toBe('INSTANCE');
    expect(result.type).toBe('Singleton');
  });

  it('handles attribute without type', () => {
    const result = parseLegacyAttribute('+ flag');
    expect(result.name).toBe('flag');
    expect(result.type).toBeUndefined();
  });

  it('handles enum-style bare value', () => {
    const result = parseLegacyAttribute('VALUE_ONE');
    expect(result.name).toBe('VALUE_ONE');
    expect(result.type).toBeUndefined();
  });
});

describe('parseLegacyMethod', () => {
  it('parses method with params and return type', () => {
    const result = parseLegacyMethod('+ setName(name: String): void');
    expect(result.visibility).toBe('+');
    expect(result.name).toBe('setName');
    expect(result.parameters).toBe('name: String');
    expect(result.returnType).toBe('void');
  });

  it('parses parameterless method', () => {
    const result = parseLegacyMethod('- reset()');
    expect(result.visibility).toBe('-');
    expect(result.name).toBe('reset');
    expect(result.parameters).toBeUndefined();
    expect(result.returnType).toBeUndefined();
  });

  it('parses {abstract} flag', () => {
    const result = parseLegacyMethod('+ {abstract} render(): void');
    expect(result.isAbstract).toBe(true);
    expect(result.name).toBe('render');
    expect(result.returnType).toBe('void');
  });

  it('parses {static} flag', () => {
    const result = parseLegacyMethod('+ {static} create(): Builder');
    expect(result.isStatic).toBe(true);
    expect(result.name).toBe('create');
    expect(result.returnType).toBe('Builder');
  });

  it('handles return type without colon', () => {
    const result = parseLegacyMethod('+ getCount() int');
    expect(result.name).toBe('getCount');
    expect(result.returnType).toBe('int');
  });
});

describe('normalizeClassDiagramState', () => {
  it('returns empty state for null/undefined', () => {
    expect(normalizeClassDiagramState(null)).toEqual({ nodes: [], edges: [] });
    expect(normalizeClassDiagramState(undefined)).toEqual({ nodes: [], edges: [] });
    expect(normalizeClassDiagramState({})).toEqual({ nodes: [], edges: [] });
  });

  it('migrates legacy string-based attributes and methods', () => {
    const legacy = {
      nodes: [
        {
          id: 'class-1',
          position: { x: 10, y: 20 },
          data: {
            name: 'User',
            attributes: ['+ id: int', '- name: String'],
            methods: ['+ login(): boolean'],
            elementType: 'class',
          },
        },
      ],
      edges: [],
    };

    const normalized = normalizeClassDiagramState(legacy);
    expect(normalized.nodes).toHaveLength(1);
    const node = normalized.nodes[0];
    expect(node.data.name).toBe('User');
    expect(node.data.attributes).toHaveLength(2);
    expect(node.data.attributes[0]).toMatchObject({
      visibility: '+',
      name: 'id',
      type: 'int',
    });
    expect(node.data.attributes[0].id).toBeTruthy();
    expect(node.data.attributes[1]).toMatchObject({
      visibility: '-',
      name: 'name',
      type: 'String',
    });
    expect(node.data.methods).toHaveLength(1);
    expect(node.data.methods[0]).toMatchObject({
      visibility: '+',
      name: 'login',
      returnType: 'boolean',
    });
  });

  it('preserves new-format structured members', () => {
    const fresh: ClassDiagramState = {
      nodes: [
        {
          id: 'class-1',
          position: { x: 0, y: 0 },
          data: {
            name: 'Order',
            attributes: [
              { id: 'a1', visibility: '#', name: 'total', type: 'BigDecimal', isStatic: true },
            ],
            methods: [
              {
                id: 'm1',
                visibility: '+',
                name: 'submit',
                parameters: 'user: User',
                returnType: 'void',
                isAbstract: true,
              },
            ],
            elementType: 'class',
          },
        },
      ],
      edges: [],
    };

    const normalized = normalizeClassDiagramState(fresh);
    expect(normalized.nodes[0].data.attributes[0]).toEqual({
      id: 'a1',
      visibility: '#',
      name: 'total',
      type: 'BigDecimal',
      isStatic: true,
    });
    expect(normalized.nodes[0].data.methods[0]).toEqual({
      id: 'm1',
      visibility: '+',
      name: 'submit',
      parameters: 'user: User',
      returnType: 'void',
      isAbstract: true,
    });
  });

  it('rejects malformed nodes/edges', () => {
    const bad = {
      nodes: [
        { id: 'good', position: { x: 0, y: 0 }, data: { name: 'A', attributes: [], methods: [] } },
        { position: {}, data: {} }, // missing id
        null,
      ],
      edges: [
        { id: 'edge-1', source: 'good', target: 'good', data: {} },
        { id: 'edge-2', source: 'good' }, // missing target
        { source: 'a', target: 'b' }, // missing id
      ],
    };
    const normalized = normalizeClassDiagramState(bad);
    expect(normalized.nodes).toHaveLength(1);
    expect(normalized.edges).toHaveLength(1);
  });

  it('coerces unknown visibility to public', () => {
    const result = normalizeClassDiagramState({
      nodes: [
        {
          id: 'class-1',
          position: { x: 0, y: 0 },
          data: {
            name: 'A',
            attributes: [{ id: 'a1', visibility: '?', name: 'x' }],
            methods: [],
          },
        },
      ],
      edges: [],
    });
    expect(result.nodes[0].data.attributes[0].visibility).toBe('+');
  });
});

describe('generateClassDiagramPlantUml', () => {
  const baseState = (overrides: Partial<ClassDiagramState> = {}): ClassDiagramState => ({
    nodes: [],
    edges: [],
    ...overrides,
  });

  it('emits empty diagram for empty state', () => {
    expect(generateClassDiagramPlantUml(baseState())).toBe('@startuml\n@enduml');
  });

  it('emits class with structured attributes and methods', () => {
    const state = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'User',
            attributes: [
              { id: 'a1', visibility: '+', name: 'id', type: 'int' },
              { id: 'a2', visibility: '-', name: 'name', type: 'String' },
            ],
            methods: [
              { id: 'm1', visibility: '+', name: 'login', returnType: 'boolean' },
            ],
            elementType: 'class',
          },
        },
      ],
    });

    const uml = generateClassDiagramPlantUml(state);
    expect(uml).toContain('class User {');
    expect(uml).toContain('  + id: int');
    expect(uml).toContain('  - name: String');
    expect(uml).toContain('  + login(): boolean');
  });

  it('emits {static} and {abstract} flags', () => {
    const state = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'Singleton',
            attributes: [
              { id: 'a1', visibility: '+', name: 'INSTANCE', type: 'Singleton', isStatic: true },
            ],
            methods: [
              { id: 'm1', visibility: '+', name: 'render', isAbstract: true },
              { id: 'm2', visibility: '+', name: 'getInstance', isStatic: true, returnType: 'Singleton' },
            ],
            elementType: 'class',
          },
        },
      ],
    });

    const uml = generateClassDiagramPlantUml(state);
    expect(uml).toContain('+ {static} INSTANCE: Singleton');
    expect(uml).toContain('+ {abstract} render()');
    expect(uml).toContain('+ {static} getInstance(): Singleton');
  });

  it('emits generics with quoted display name and alias', () => {
    const state = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'List',
            generics: 'T',
            attributes: [],
            methods: [{ id: 'm1', visibility: '+', name: 'add', parameters: 'item: T' }],
            elementType: 'class',
          },
        },
      ],
    });

    const uml = generateClassDiagramPlantUml(state);
    expect(uml).toContain('class "List<T>" as Class1 {');
    expect(uml).toContain('  + add(item: T)');
  });

  it('emits enum without methods or visibility', () => {
    const state = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'Status',
            attributes: [
              { id: 'a1', visibility: '+', name: 'ACTIVE' },
              { id: 'a2', visibility: '+', name: 'INACTIVE' },
            ],
            methods: [{ id: 'm1', visibility: '+', name: 'shouldNotAppear' }],
            elementType: 'enum',
          },
        },
      ],
    });

    const uml = generateClassDiagramPlantUml(state);
    expect(uml).toContain('enum Status {');
    expect(uml).toContain('  ACTIVE');
    expect(uml).toContain('  INACTIVE');
    expect(uml).not.toContain('shouldNotAppear');
    expect(uml).not.toContain('+ ACTIVE');
  });

  it('emits abstract class keyword', () => {
    const state = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'Shape',
            attributes: [],
            methods: [],
            elementType: 'abstractClass',
          },
        },
      ],
    });

    expect(generateClassDiagramPlantUml(state)).toContain('abstract class Shape {');
  });

  it('emits interface keyword', () => {
    const state = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'Comparable',
            attributes: [],
            methods: [{ id: 'm1', visibility: '+', name: 'compareTo', returnType: 'int' }],
            elementType: 'interface',
          },
        },
      ],
    });

    expect(generateClassDiagramPlantUml(state)).toContain('interface Comparable {');
  });

  it('emits edge multiplicity at both ends', () => {
    const state = baseState({
      nodes: [
        {
          id: 'a',
          position: { x: 0, y: 0 },
          data: { name: 'Order', attributes: [], methods: [], elementType: 'class' },
        },
        {
          id: 'b',
          position: { x: 0, y: 0 },
          data: { name: 'Item', attributes: [], methods: [], elementType: 'class' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          data: {
            relationship: 'aggregation',
            sourceMultiplicity: '1',
            targetMultiplicity: '*',
            label: 'contains',
          },
        },
      ],
    });

    const uml = generateClassDiagramPlantUml(state);
    expect(uml).toContain('Order "1" o-- "*" Item : contains');
  });

  it('emits single-line and multi-line notes', () => {
    const stateSingle = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'A',
            attributes: [],
            methods: [],
            elementType: 'class',
            note: 'Quick note',
          },
        },
      ],
    });
    expect(generateClassDiagramPlantUml(stateSingle)).toContain('note bottom of A : Quick note');

    const stateMulti = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'B',
            attributes: [],
            methods: [],
            elementType: 'class',
            note: 'first line\nsecond line',
          },
        },
      ],
    });
    const uml = generateClassDiagramPlantUml(stateMulti);
    expect(uml).toContain('note bottom of B\n  first line\n  second line\nend note');
  });

  it('skips empty-name members', () => {
    const state = baseState({
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            name: 'A',
            attributes: [{ id: 'a1', visibility: '+', name: '   ' }],
            methods: [{ id: 'm1', visibility: '+', name: '' }],
            elementType: 'class',
          },
        },
      ],
    });

    const uml = generateClassDiagramPlantUml(state);
    expect(uml).toBe('@startuml\nclass A {\n}\n@enduml');
  });
});

describe('roundtrip: legacy string state → normalize → serialize', () => {
  it('produces stable PlantUML from legacy data', () => {
    const legacy = {
      nodes: [
        {
          id: 'class-1',
          position: { x: 0, y: 0 },
          data: {
            name: 'Student',
            attributes: ['+ matricNo: String', '+ gpa: float = 0.0'],
            methods: ['+ submitDiagram(): void'],
            elementType: 'class',
          },
        },
      ],
      edges: [],
    };

    const normalized = normalizeClassDiagramState(legacy);
    const uml = generateClassDiagramPlantUml(normalized);
    expect(uml).toContain('class Student {');
    expect(uml).toContain('  + matricNo: String');
    expect(uml).toContain('  + gpa: float = 0.0');
    expect(uml).toContain('  + submitDiagram(): void');
  });
});
