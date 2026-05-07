import { describe, expect, it } from 'vitest';
import {
  generateClassDiagramPlantUml,
  normalizeClassDiagramState,
  type ClassDiagramState,
} from './classDiagram';
import {
  generateSequenceDiagramPlantUml,
  normalizeSequenceDiagramState,
  type SequenceDiagramState,
} from './sequenceDiagram';
import {
  parseClassDiagramPlantUml,
  parseSequenceDiagramPlantUml,
} from './plantUmlParser';

// =============================================================================
// Class diagram parser
// =============================================================================

describe('parseClassDiagramPlantUml', () => {
  it('returns empty state for empty input', () => {
    const { state, warnings } = parseClassDiagramPlantUml('');
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('parses a class with attributes and methods', () => {
    const text = `@startuml
class Book {
  + title: String
  - isbn: String
  + borrow(member: Member): void
}
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    expect(state.nodes).toHaveLength(1);
    const node = state.nodes[0];
    expect(node.data.name).toBe('Book');
    expect(node.data.elementType).toBe('class');
    expect(node.data.attributes).toHaveLength(2);
    expect(node.data.attributes[0].name).toBe('title');
    expect(node.data.attributes[0].type).toBe('String');
    expect(node.data.attributes[0].visibility).toBe('+');
    expect(node.data.attributes[1].visibility).toBe('-');
    expect(node.data.methods).toHaveLength(1);
    expect(node.data.methods[0].name).toBe('borrow');
    expect(node.data.methods[0].returnType).toBe('void');
  });

  it('parses interface, abstract class, and enum keywords', () => {
    const text = `@startuml
interface Drawable {
  + draw(): void
}
abstract class Shape {
  + {abstract} area(): double
}
enum Color {
  RED
  GREEN
  BLUE
}
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    const byName = new Map(state.nodes.map((n) => [n.data.name, n]));
    expect(byName.get('Drawable')?.data.elementType).toBe('interface');
    expect(byName.get('Shape')?.data.elementType).toBe('abstractClass');
    expect(byName.get('Shape')?.data.methods[0].isAbstract).toBe(true);
    expect(byName.get('Color')?.data.elementType).toBe('enum');
  });

  it('parses aliased declaration with a quoted display name', () => {
    const text = `@startuml
class "Web Server" as WS {
  + handle()
}
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].data.name).toBe('Web Server');
    expect(state.nodes[0].data.methods).toHaveLength(1);
  });

  it('extracts generics from a quoted name', () => {
    const text = `@startuml
class "Container<T>" as Container {
  + items: List<T>
}
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    expect(state.nodes[0].data.name).toBe('Container');
    expect(state.nodes[0].data.generics).toBe('T');
  });

  it('parses each relationship arrow', () => {
    const text = `@startuml
class A
class B
class C
class D
class E
class F
class G
A --> B
A <|-- C
A <|.. D
A o-- E
A *-- F
A ..> G
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    expect(state.edges).toHaveLength(6);
    const byTarget = new Map(state.edges.map((e) => [e.target, e]));
    const findRel = (targetName: string) => {
      const node = state.nodes.find((n) => n.data.name === targetName);
      if (!node) throw new Error(`missing ${targetName}`);
      return byTarget.get(node.id)?.data.relationship;
    };
    expect(findRel('B')).toBe('association');
    expect(findRel('C')).toBe('inheritance');
    expect(findRel('D')).toBe('realization');
    expect(findRel('E')).toBe('aggregation');
    expect(findRel('F')).toBe('composition');
    expect(findRel('G')).toBe('dependency');
  });

  it('captures multiplicities and labels', () => {
    const text = `@startuml
class A
class B
A "1" --> "*" B : owns
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    const edge = state.edges[0];
    expect(edge.data.sourceMultiplicity).toBe('1');
    expect(edge.data.targetMultiplicity).toBe('*');
    expect(edge.data.label).toBe('owns');
  });

  it('parses inline notes', () => {
    const text = `@startuml
class Foo
note bottom of Foo : See spec section 4.2
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    expect(state.nodes[0].data.note).toBe('See spec section 4.2');
  });

  it('parses multi-line notes', () => {
    const text = `@startuml
class Foo
note bottom of Foo
  Line one
  Line two
end note
@enduml`;
    const { state } = parseClassDiagramPlantUml(text);
    expect(state.nodes[0].data.note).toBe('Line one\nLine two');
  });

  it('warns on relationships referencing undeclared classes', () => {
    const text = `@startuml
class A
A --> Missing
@enduml`;
    const { warnings } = parseClassDiagramPlantUml(text);
    expect(warnings.some((w) => w.includes('undeclared'))).toBe(true);
  });

  it('round-trips through the emitter (structure preserved)', () => {
    const original: ClassDiagramState = normalizeClassDiagramState({
      nodes: [
        {
          id: 'c1',
          position: { x: 0, y: 0 },
          data: {
            name: 'Book',
            elementType: 'class',
            attributes: [{ id: 'a1', visibility: '+', name: 'title', type: 'String' }],
            methods: [
              {
                id: 'm1',
                visibility: '+',
                name: 'borrow',
                parameters: 'member: Member',
                returnType: 'void',
              },
            ],
          },
        },
        {
          id: 'c2',
          position: { x: 0, y: 0 },
          data: { name: 'Member', elementType: 'class', attributes: [], methods: [] },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'c1',
          target: 'c2',
          data: { relationship: 'association', label: 'borrowedBy' },
        },
      ],
    });
    const text = generateClassDiagramPlantUml(original);
    const { state: roundTripped } = parseClassDiagramPlantUml(text);
    expect(roundTripped.nodes.map((n) => n.data.name)).toEqual(['Book', 'Member']);
    expect(roundTripped.edges).toHaveLength(1);
    const edge = roundTripped.edges[0];
    const sourceNode = roundTripped.nodes.find((n) => n.id === edge.source);
    const targetNode = roundTripped.nodes.find((n) => n.id === edge.target);
    expect(sourceNode?.data.name).toBe('Book');
    expect(targetNode?.data.name).toBe('Member');
    expect(edge.data.relationship).toBe('association');
    expect(edge.data.label).toBe('borrowedBy');
  });
});

// =============================================================================
// Sequence diagram parser
// =============================================================================

describe('parseSequenceDiagramPlantUml', () => {
  it('returns empty state for empty input', () => {
    const { state } = parseSequenceDiagramPlantUml('');
    expect(state.lifelines).toHaveLength(0);
    expect(state.messages).toHaveLength(0);
    expect(state.fragments).toHaveLength(0);
  });

  it('parses lifelines for each kind', () => {
    const text = `@startuml
actor User
participant Server
database DB
control Auth
boundary UI
entity Session
@enduml`;
    const { state } = parseSequenceDiagramPlantUml(text);
    expect(state.lifelines.map((l) => l.data.kind)).toEqual([
      'actor',
      'participant',
      'database',
      'control',
      'boundary',
      'entity',
    ]);
  });

  it('parses aliased lifeline declarations', () => {
    const text = `@startuml
participant "Web Server" as WS
@enduml`;
    const { state } = parseSequenceDiagramPlantUml(text);
    expect(state.lifelines).toHaveLength(1);
    expect(state.lifelines[0].data.name).toBe('Web Server');
  });

  it('parses sync, async, and reply messages', () => {
    const text = `@startuml
participant A
participant B
A -> B : sync
A ->> B : async
B --> A : reply
@enduml`;
    const { state } = parseSequenceDiagramPlantUml(text);
    expect(state.messages).toHaveLength(3);
    expect(state.messages.map((m) => m.data.messageType)).toEqual(['sync', 'async', 'reply']);
    expect(state.messages.map((m) => m.data.label)).toEqual(['sync', 'async', 'reply']);
  });

  it('attaches activate/deactivate to the most recent message', () => {
    const text = `@startuml
participant A
participant B
A -> B : do
activate B
B --> A : ok
deactivate B
@enduml`;
    const { state } = parseSequenceDiagramPlantUml(text);
    expect(state.messages[0].data.activatesTarget).toBe(true);
    // deactivate B after reply (B->A) should NOT match (B is the source, not target — but
    // emitter pattern is "deactivate source", so this is the source for reply which is B). ✓
    expect(state.messages[1].data.deactivatesSource).toBe(true);
  });

  it('parses opt fragment with a label and includes nested message', () => {
    const text = `@startuml
participant A
participant B
opt logged in
  A -> B : inside
end
@enduml`;
    const { state } = parseSequenceDiagramPlantUml(text);
    expect(state.fragments).toHaveLength(1);
    expect(state.fragments?.[0].kind).toBe('opt');
    expect(state.fragments?.[0].data.label).toBe('logged in');
    expect(state.messages[0].data.parentFragmentId).toBe(state.fragments?.[0].id);
    expect(state.messages[0].data.parentBranchIndex).toBe(0);
  });

  it('parses alt with else branches', () => {
    const text = `@startuml
participant A
participant B
alt x > 0
  A -> B : positive
else x < 0
  A -> B : negative
else x == 0
  A -> B : zero
end
@enduml`;
    const { state } = parseSequenceDiagramPlantUml(text);
    expect(state.fragments).toHaveLength(1);
    const fragment = state.fragments?.[0];
    expect(fragment?.kind).toBe('alt');
    expect(fragment?.data.elseLabels).toEqual(['x < 0', 'x == 0']);
    expect(state.messages[0].data.parentBranchIndex).toBe(0);
    expect(state.messages[1].data.parentBranchIndex).toBe(1);
    expect(state.messages[2].data.parentBranchIndex).toBe(2);
  });

  it('warns on stray "end" without an opener', () => {
    const text = `@startuml
participant A
end
@enduml`;
    const { warnings } = parseSequenceDiagramPlantUml(text);
    expect(warnings.some((w) => w.toLowerCase().includes('stray'))).toBe(true);
  });

  it('warns on a fragment that did not close', () => {
    const text = `@startuml
participant A
opt cond
@enduml`;
    const { warnings } = parseSequenceDiagramPlantUml(text);
    expect(warnings.some((w) => w.toLowerCase().includes('did not close'))).toBe(true);
  });

  it('round-trips through the emitter', () => {
    const original: SequenceDiagramState = normalizeSequenceDiagramState({
      lifelines: [
        { id: 'l1', data: { name: 'User', kind: 'actor', order: 0 } },
        { id: 'l2', data: { name: 'Server', kind: 'participant', order: 1 } },
      ],
      fragments: [
        { id: 'f1', kind: 'opt', data: { order: 1, label: 'authenticated' } },
      ],
      messages: [
        {
          id: 'm1',
          source: 'l1',
          target: 'l2',
          data: { messageType: 'sync', label: 'request', order: 0 },
        },
        {
          id: 'm2',
          source: 'l1',
          target: 'l2',
          data: {
            messageType: 'sync',
            label: 'inside',
            order: 0,
            parentFragmentId: 'f1',
            parentBranchIndex: 0,
          },
        },
        {
          id: 'm3',
          source: 'l2',
          target: 'l1',
          data: { messageType: 'reply', label: 'response', order: 2 },
        },
      ],
    });
    const text = generateSequenceDiagramPlantUml(original);
    const { state: roundTripped } = parseSequenceDiagramPlantUml(text);
    expect(roundTripped.lifelines.map((l) => l.data.name)).toEqual(['User', 'Server']);
    expect(roundTripped.messages.map((m) => m.data.label)).toEqual(['request', 'inside', 'response']);
    expect(roundTripped.fragments).toHaveLength(1);
    expect(roundTripped.fragments?.[0].data.label).toBe('authenticated');
  });
});
