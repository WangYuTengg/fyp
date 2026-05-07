export type UmlElementType = 'class' | 'interface' | 'abstractClass' | 'enum';

export type RelationshipType =
  | 'association'
  | 'inheritance'
  | 'realization'
  | 'aggregation'
  | 'composition'
  | 'dependency';

export type Visibility = '+' | '-' | '#' | '~';

export const VISIBILITY_OPTIONS: ReadonlyArray<{ value: Visibility; label: string }> = [
  { value: '+', label: 'public' },
  { value: '-', label: 'private' },
  { value: '#', label: 'protected' },
  { value: '~', label: 'package' },
];

export type ClassAttribute = {
  id: string;
  visibility: Visibility;
  name: string;
  type?: string;
  isStatic?: boolean;
  defaultValue?: string;
};

export type ClassMethod = {
  id: string;
  visibility: Visibility;
  name: string;
  parameters?: string;
  returnType?: string;
  isStatic?: boolean;
  isAbstract?: boolean;
};

export type ClassDiagramNodeData = {
  name: string;
  generics?: string;
  attributes: ClassAttribute[];
  methods: ClassMethod[];
  elementType?: UmlElementType;
  note?: string;
};

export type ClassDiagramEdgeData = {
  relationship: RelationshipType;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
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

export const generateMemberId = (prefix: 'attr' | 'method' | 'class') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

export const DEFAULT_CLASS_DIAGRAM_STATE: ClassDiagramState = {
  nodes: [
    {
      id: 'class-1',
      position: { x: 40, y: 40 },
      data: {
        name: 'Example',
        attributes: [
          { id: 'attr-default-1', visibility: '+', name: 'attribute', type: 'String' },
        ],
        methods: [
          { id: 'method-default-1', visibility: '+', name: 'method' },
        ],
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

export const normalizeElementType = (value?: UmlElementType): UmlElementType => value ?? 'class';

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

const isVisibility = (value: string): value is Visibility =>
  value === '+' || value === '-' || value === '#' || value === '~';

const stripVisibility = (raw: string): { visibility: Visibility; rest: string } => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { visibility: '+', rest: '' };
  const first = trimmed.charAt(0);
  if (isVisibility(first)) {
    return { visibility: first, rest: trimmed.slice(1).trim() };
  }
  return { visibility: '+', rest: trimmed };
};

const stripFlags = (rest: string): { rest: string; isStatic: boolean; isAbstract: boolean } => {
  let working = rest;
  let isStatic = false;
  let isAbstract = false;
  if (/\{static\}/i.test(working)) {
    isStatic = true;
    working = working.replace(/\{static\}/gi, ' ');
  }
  if (/\{abstract\}/i.test(working)) {
    isAbstract = true;
    working = working.replace(/\{abstract\}/gi, ' ');
  }
  working = working.replace(/\s+/g, ' ').trim();
  return { rest: working, isStatic, isAbstract };
};

export function parseLegacyAttribute(raw: string): ClassAttribute {
  const { visibility, rest } = stripVisibility(raw);
  const { rest: noFlags, isStatic } = stripFlags(rest);

  const eqIdx = noFlags.indexOf('=');
  let core = noFlags;
  let defaultValue: string | undefined;
  if (eqIdx >= 0) {
    core = noFlags.slice(0, eqIdx).trim();
    const after = noFlags.slice(eqIdx + 1).trim();
    defaultValue = after.length > 0 ? after : undefined;
  }

  const colonIdx = core.indexOf(':');
  if (colonIdx >= 0) {
    const name = core.slice(0, colonIdx).trim();
    const type = core.slice(colonIdx + 1).trim();
    return {
      id: generateMemberId('attr'),
      visibility,
      name,
      type: type.length > 0 ? type : undefined,
      isStatic: isStatic || undefined,
      defaultValue,
    };
  }

  return {
    id: generateMemberId('attr'),
    visibility,
    name: core,
    isStatic: isStatic || undefined,
    defaultValue,
  };
}

export function parseLegacyMethod(raw: string): ClassMethod {
  const { visibility, rest } = stripVisibility(raw);
  const { rest: noFlags, isStatic, isAbstract } = stripFlags(rest);

  const parenStart = noFlags.indexOf('(');
  const parenEnd = noFlags.lastIndexOf(')');

  if (parenStart >= 0 && parenEnd > parenStart) {
    const name = noFlags.slice(0, parenStart).trim();
    const paramsRaw = noFlags.slice(parenStart + 1, parenEnd).trim();
    const after = noFlags.slice(parenEnd + 1).trim();

    let returnType: string | undefined;
    if (after.startsWith(':')) {
      const r = after.slice(1).trim();
      returnType = r.length > 0 ? r : undefined;
    } else if (after.length > 0) {
      returnType = after;
    }

    return {
      id: generateMemberId('method'),
      visibility,
      name,
      parameters: paramsRaw.length > 0 ? paramsRaw : undefined,
      returnType,
      isStatic: isStatic || undefined,
      isAbstract: isAbstract || undefined,
    };
  }

  return {
    id: generateMemberId('method'),
    visibility,
    name: noFlags,
    isStatic: isStatic || undefined,
    isAbstract: isAbstract || undefined,
  };
}

const ensureAttribute = (value: unknown): ClassAttribute => {
  if (typeof value === 'string') return parseLegacyAttribute(value);
  if (typeof value !== 'object' || value === null) {
    return parseLegacyAttribute(String(value ?? ''));
  }

  const v = value as Record<string, unknown>;
  const visibilityRaw = typeof v.visibility === 'string' ? v.visibility : '';
  const visibility: Visibility = isVisibility(visibilityRaw) ? visibilityRaw : '+';

  return {
    id: typeof v.id === 'string' && v.id.length > 0 ? v.id : generateMemberId('attr'),
    visibility,
    name: typeof v.name === 'string' ? v.name : '',
    type: typeof v.type === 'string' && v.type.length > 0 ? v.type : undefined,
    isStatic: v.isStatic === true ? true : undefined,
    defaultValue:
      typeof v.defaultValue === 'string' && v.defaultValue.length > 0 ? v.defaultValue : undefined,
  };
};

const ensureMethod = (value: unknown): ClassMethod => {
  if (typeof value === 'string') return parseLegacyMethod(value);
  if (typeof value !== 'object' || value === null) {
    return parseLegacyMethod(String(value ?? ''));
  }

  const v = value as Record<string, unknown>;
  const visibilityRaw = typeof v.visibility === 'string' ? v.visibility : '';
  const visibility: Visibility = isVisibility(visibilityRaw) ? visibilityRaw : '+';

  return {
    id: typeof v.id === 'string' && v.id.length > 0 ? v.id : generateMemberId('method'),
    visibility,
    name: typeof v.name === 'string' ? v.name : '',
    parameters:
      typeof v.parameters === 'string' && v.parameters.length > 0 ? v.parameters : undefined,
    returnType:
      typeof v.returnType === 'string' && v.returnType.length > 0 ? v.returnType : undefined,
    isStatic: v.isStatic === true ? true : undefined,
    isAbstract: v.isAbstract === true ? true : undefined,
  };
};

const normalizeNode = (value: unknown): ClassDiagramNode | null => {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string') return null;

  const position =
    typeof v.position === 'object' && v.position !== null
      ? (v.position as Record<string, unknown>)
      : {};
  const data =
    typeof v.data === 'object' && v.data !== null ? (v.data as Record<string, unknown>) : {};

  const elementType: UmlElementType = (() => {
    const e = data.elementType;
    return e === 'interface' || e === 'abstractClass' || e === 'enum' ? e : 'class';
  })();

  const attributes = Array.isArray(data.attributes) ? data.attributes.map(ensureAttribute) : [];
  const methods = Array.isArray(data.methods) ? data.methods.map(ensureMethod) : [];

  return {
    id: v.id,
    position: {
      x: typeof position.x === 'number' ? position.x : 0,
      y: typeof position.y === 'number' ? position.y : 0,
    },
    data: {
      name: typeof data.name === 'string' ? data.name : '',
      generics:
        typeof data.generics === 'string' && data.generics.length > 0 ? data.generics : undefined,
      attributes,
      methods,
      elementType,
      note: typeof data.note === 'string' && data.note.length > 0 ? data.note : undefined,
    },
  };
};

const normalizeEdge = (value: unknown): ClassDiagramEdge | null => {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.source !== 'string' || typeof v.target !== 'string') {
    return null;
  }

  const data =
    typeof v.data === 'object' && v.data !== null ? (v.data as Record<string, unknown>) : {};

  const relationship: RelationshipType = (() => {
    const r = data.relationship;
    if (
      r === 'association' ||
      r === 'inheritance' ||
      r === 'realization' ||
      r === 'aggregation' ||
      r === 'composition' ||
      r === 'dependency'
    ) {
      return r;
    }
    return 'association';
  })();

  return {
    id: v.id,
    source: v.source,
    target: v.target,
    data: {
      relationship,
      label: typeof data.label === 'string' && data.label.length > 0 ? data.label : undefined,
      sourceMultiplicity:
        typeof data.sourceMultiplicity === 'string' && data.sourceMultiplicity.length > 0
          ? data.sourceMultiplicity
          : undefined,
      targetMultiplicity:
        typeof data.targetMultiplicity === 'string' && data.targetMultiplicity.length > 0
          ? data.targetMultiplicity
          : undefined,
    },
  };
};

export function normalizeClassDiagramState(state: unknown): ClassDiagramState {
  if (typeof state !== 'object' || state === null) {
    return { nodes: [], edges: [] };
  }
  const s = state as Record<string, unknown>;
  const rawNodes = Array.isArray(s.nodes) ? s.nodes : [];
  const rawEdges = Array.isArray(s.edges) ? s.edges : [];
  return {
    nodes: rawNodes.map(normalizeNode).filter((n): n is ClassDiagramNode => n !== null),
    edges: rawEdges.map(normalizeEdge).filter((e): e is ClassDiagramEdge => e !== null),
  };
}

const formatAttribute = (attr: ClassAttribute, isEnum: boolean): string => {
  if (isEnum) return attr.name;

  const parts: string[] = [attr.visibility];
  if (attr.isStatic) parts.push('{static}');

  let body = attr.name;
  if (attr.type) body += `: ${attr.type}`;
  if (attr.defaultValue) body += ` = ${attr.defaultValue}`;
  parts.push(body);

  return parts.join(' ');
};

const formatMethod = (method: ClassMethod): string => {
  const parts: string[] = [method.visibility];
  if (method.isStatic) parts.push('{static}');
  if (method.isAbstract) parts.push('{abstract}');

  let signature = `${method.name}(${method.parameters ?? ''})`;
  if (method.returnType) signature += `: ${method.returnType}`;
  parts.push(signature);

  return parts.join(' ');
};

const escapeNoteLine = (line: string) => line.replace(/[\r\n]+/g, ' ');

export function generateClassDiagramPlantUml(state: ClassDiagramState): string {
  const classAliases = new Map<
    string,
    { displayName: string; alias: string; elementType: UmlElementType }
  >();
  let aliasCounter = 1;

  for (const node of state.nodes) {
    const elementType = normalizeElementType(node.data.elementType);
    const baseName = normalizeElementName(node.data.name, elementType);
    const generics = node.data.generics?.trim();
    const displayName = generics ? `${baseName}<${generics}>` : baseName;
    const alias = isValidIdentifier(displayName) ? displayName : `Class${aliasCounter++}`;
    classAliases.set(node.id, { displayName, alias, elementType });
  }

  const lines: string[] = ['@startuml'];

  for (const node of state.nodes) {
    const meta = classAliases.get(node.id);
    if (!meta) continue;

    const elementKeyword = getElementKeyword(meta.elementType);
    const isEnum = meta.elementType === 'enum';

    if (meta.alias === meta.displayName) {
      lines.push(`${elementKeyword} ${meta.displayName} {`);
    } else {
      lines.push(`${elementKeyword} "${meta.displayName}" as ${meta.alias} {`);
    }

    for (const attr of node.data.attributes ?? []) {
      if (!attr.name?.trim()) continue;
      lines.push(`  ${formatAttribute(attr, isEnum)}`);
    }

    if (!isEnum) {
      for (const method of node.data.methods ?? []) {
        if (!method.name?.trim()) continue;
        lines.push(`  ${formatMethod(method)}`);
      }
    }

    lines.push('}');

    const note = node.data.note?.trim();
    if (note) {
      const noteLines = note.split(/\r?\n/);
      if (noteLines.length === 1) {
        lines.push(`note bottom of ${meta.alias} : ${escapeNoteLine(noteLines[0])}`);
      } else {
        lines.push(`note bottom of ${meta.alias}`);
        for (const noteLine of noteLines) lines.push(`  ${noteLine}`);
        lines.push('end note');
      }
    }
  }

  for (const edge of state.edges) {
    const source = classAliases.get(edge.source)?.alias;
    const target = classAliases.get(edge.target)?.alias;
    if (!source || !target) continue;

    const relationship = edge.data?.relationship ?? 'association';
    const arrow = RELATIONSHIP_MAP[relationship] ?? RELATIONSHIP_MAP.association;
    const sm = edge.data?.sourceMultiplicity?.trim();
    const tm = edge.data?.targetMultiplicity?.trim();
    const label = edge.data?.label?.trim();

    let line = source;
    if (sm) line += ` "${sm}"`;
    line += ` ${arrow}`;
    if (tm) line += ` "${tm}"`;
    line += ` ${target}`;
    if (label) line += ` : ${label}`;

    lines.push(line);
  }

  lines.push('@enduml');
  return lines.join('\n');
}
