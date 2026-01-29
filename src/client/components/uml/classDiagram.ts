export type RelationshipType = 'association' | 'inheritance' | 'aggregation' | 'composition' | 'dependency';

export type ClassDiagramNodeData = {
  name: string;
  attributes: string[];
  methods: string[];
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
      },
    },
  ],
  edges: [],
};

const RELATIONSHIP_MAP: Record<RelationshipType, string> = {
  association: '-->',
  inheritance: '<|--',
  aggregation: 'o--',
  composition: '*--',
  dependency: '..>',
};

const isValidIdentifier = (value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);

const normalizeClassName = (name: string) => name.trim() || 'Class';

export function generateClassDiagramPlantUml(state: ClassDiagramState): string {
  const classAliases = new Map<string, { displayName: string; alias: string }>();
  let aliasCounter = 1;

  for (const node of state.nodes) {
    const displayName = normalizeClassName(node.data.name);
    const alias = isValidIdentifier(displayName) ? displayName : `Class${aliasCounter++}`;
    classAliases.set(node.id, { displayName, alias });
  }

  const lines: string[] = ['@startuml'];

  for (const node of state.nodes) {
    const meta = classAliases.get(node.id);
    if (!meta) continue;

    if (meta.alias === meta.displayName) {
      lines.push(`class ${meta.displayName} {`);
    } else {
      lines.push(`class "${meta.displayName}" as ${meta.alias} {`);
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

    const arrow = RELATIONSHIP_MAP[edge.data.relationship];
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
