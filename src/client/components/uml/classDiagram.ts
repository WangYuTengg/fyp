export type UmlElementType = 'class' | 'interface' | 'abstractClass' | 'enum';

export type RelationshipType =
  | 'association'
  | 'inheritance'
  | 'realization'
  | 'aggregation'
  | 'composition'
  | 'dependency';

export type ClassDiagramNodeData = {
  name: string;
  attributes: string[];
  methods: string[];
  elementType?: UmlElementType;
};

export type ClassDiagramEdgeData = {
  relationship: RelationshipType;
  label?: string;
};

export type ClassDiagramNode = {
  id: string;
  position: { x: number; y: number };
  data: ClassDiagramNodeData;
};

export type ClassDiagramEdge = {
  id: string;
  source: string;
  target: string;
  data: ClassDiagramEdgeData;
};

export type ClassDiagramState = {
  nodes: ClassDiagramNode[];
  edges: ClassDiagramEdge[];
};

export const DEFAULT_CLASS_DIAGRAM_STATE: ClassDiagramState = {
  nodes: [
    {
      id: 'class-1',
      position: { x: 40, y: 40 },
      data: {
        name: 'Example',
        attributes: ['+ attribute: String'],
        methods: ['+ method()'],
        elementType: 'class',
      },
    },
  ],
  edges: [],
};

const RELATIONSHIP_MAP: Record<RelationshipType, string> = {
  association: '-->',
  inheritance: '<|--',
  realization: '<|..',
  aggregation: 'o--',
  composition: '*--',
  dependency: '..>',
};

const isValidIdentifier = (value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);

const normalizeElementType = (value?: UmlElementType): UmlElementType => value ?? 'class';

const normalizeElementName = (name: string, elementType: UmlElementType) => {
  const trimmed = name.trim();
  if (trimmed.length > 0) return trimmed;

  switch (elementType) {
    case 'interface':
      return 'Interface';
    case 'abstractClass':
      return 'AbstractClass';
    case 'enum':
      return 'Enum';
    default:
      return 'Class';
  }
};

const getElementKeyword = (elementType: UmlElementType) => {
  switch (elementType) {
    case 'interface':
      return 'interface';
    case 'abstractClass':
      return 'abstract class';
    case 'enum':
      return 'enum';
    default:
      return 'class';
  }
};

export function generateClassDiagramPlantUml(state: ClassDiagramState): string {
  const classAliases = new Map<string, { displayName: string; alias: string; elementType: UmlElementType }>();
  let aliasCounter = 1;

  for (const node of state.nodes) {
    const elementType = normalizeElementType(node.data.elementType);
    const displayName = normalizeElementName(node.data.name, elementType);
    const alias = isValidIdentifier(displayName) ? displayName : `Class${aliasCounter++}`;
    classAliases.set(node.id, { displayName, alias, elementType });
  }

  const lines: string[] = ['@startuml'];

  for (const node of state.nodes) {
    const meta = classAliases.get(node.id);
    if (!meta) continue;

    const elementKeyword = getElementKeyword(meta.elementType);

    if (meta.alias === meta.displayName) {
      lines.push(`${elementKeyword} ${meta.displayName} {`);
    } else {
      lines.push(`${elementKeyword} "${meta.displayName}" as ${meta.alias} {`);
    }

    const attributes = node.data.attributes ?? [];
    const methods = node.data.methods ?? [];

    for (const attr of attributes) {
      if (attr.trim().length === 0) continue;
      lines.push(`  ${attr}`);
    }

    for (const method of methods) {
      if (method.trim().length === 0) continue;
      lines.push(`  ${method}`);
    }

    lines.push('}');
  }

  for (const edge of state.edges) {
    const source = classAliases.get(edge.source)?.alias;
    const target = classAliases.get(edge.target)?.alias;
    if (!source || !target) continue;

    const relationship = edge.data?.relationship ?? 'association';
    const arrow = RELATIONSHIP_MAP[relationship] ?? RELATIONSHIP_MAP.association;
    const label = edge.data.label?.trim();
    if (label) {
      lines.push(`${source} ${arrow} ${target} : ${label}`);
    } else {
      lines.push(`${source} ${arrow} ${target}`);
    }
  }

  lines.push('@enduml');
  return lines.join('\n');
}
