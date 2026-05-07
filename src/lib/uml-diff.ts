import type {
  ClassAttribute,
  ClassDiagramEdge,
  ClassDiagramNode,
  ClassDiagramState,
  ClassMethod,
  RelationshipType,
  UmlElementType,
} from '../client/components/uml/classDiagram.js';

export type DiffStatus = 'matched' | 'missing' | 'extra';

export type AttributeMatch = {
  refName: string;
  studentName: string;
  visibilityMatches: boolean;
  typeMatches: boolean;
  staticMatches: boolean;
  /** 0..1 — partial credit for aspect matches */
  aspectScore: number;
};

export type MethodMatch = {
  refName: string;
  studentName: string;
  visibilityMatches: boolean;
  parametersMatch: boolean;
  returnTypeMatches: boolean;
  staticMatches: boolean;
  abstractMatches: boolean;
  /** 0..1 — partial credit for aspect matches */
  aspectScore: number;
};

export type ClassMatch = {
  refName: string;
  studentName: string;
  refElementType: UmlElementType;
  studentElementType: UmlElementType;
  elementTypeMatches: boolean;
  attributes: {
    matched: AttributeMatch[];
    missing: string[];
    extra: string[];
    score: number; // 0..1
  };
  methods: {
    matched: MethodMatch[];
    missing: string[];
    extra: string[];
    score: number; // 0..1
  };
};

export type EdgeRef = {
  source: string;
  target: string;
  relationship: RelationshipType;
};

export type EdgeMatch = {
  ref: EdgeRef;
  student: EdgeRef;
  relationshipMatches: boolean;
};

export type ClassDiagramDiffResult = {
  /** Aggregate structural score, 0..1 */
  score: number;
  classes: {
    matched: ClassMatch[];
    missing: string[];
    extra: string[];
    score: number; // 0..1
  };
  edges: {
    matched: EdgeMatch[];
    missing: EdgeRef[];
    extra: EdgeRef[];
    score: number; // 0..1
  };
  summary: string;
};

const CLASS_WEIGHT = 0.3;
const EDGE_WEIGHT = 0.25;
const ATTRIBUTE_WEIGHT = 0.25;
const METHOD_WEIGHT = 0.2;

const normalizeName = (raw: string | undefined): string =>
  (raw ?? '').trim().toLowerCase().replace(/\s+/g, '');

const normalizeType = (raw: string | undefined): string =>
  (raw ?? '').trim().toLowerCase().replace(/\s+/g, '');

const normalizeParams = (raw: string | undefined): string => {
  if (!raw) return '';
  // "x: int, y: int" → "x:int,y:int" (case-preserving names but trimmed/joined)
  return raw
    .split(',')
    .map((p) => p.trim().replace(/\s+/g, '').toLowerCase())
    .join(',');
};

const safeRatio = (matched: number, total: number): number => {
  if (total === 0) return 1;
  return matched / total;
};

const compareAttribute = (refAttr: ClassAttribute, studentAttr: ClassAttribute): AttributeMatch => {
  const visibilityMatches = refAttr.visibility === studentAttr.visibility;
  const typeMatches = normalizeType(refAttr.type) === normalizeType(studentAttr.type);
  const staticMatches = Boolean(refAttr.isStatic) === Boolean(studentAttr.isStatic);
  // 4 aspects: presence (always 1 since matched), visibility, type, static
  const aspectScore = (1 + Number(visibilityMatches) + Number(typeMatches) + Number(staticMatches)) / 4;
  return {
    refName: refAttr.name,
    studentName: studentAttr.name,
    visibilityMatches,
    typeMatches,
    staticMatches,
    aspectScore,
  };
};

const compareMethod = (refMethod: ClassMethod, studentMethod: ClassMethod): MethodMatch => {
  const visibilityMatches = refMethod.visibility === studentMethod.visibility;
  const parametersMatch = normalizeParams(refMethod.parameters) === normalizeParams(studentMethod.parameters);
  const returnTypeMatches = normalizeType(refMethod.returnType) === normalizeType(studentMethod.returnType);
  const staticMatches = Boolean(refMethod.isStatic) === Boolean(studentMethod.isStatic);
  const abstractMatches = Boolean(refMethod.isAbstract) === Boolean(studentMethod.isAbstract);
  // 6 aspects: presence (1), visibility, params, return, static, abstract
  const aspectScore =
    (1 +
      Number(visibilityMatches) +
      Number(parametersMatch) +
      Number(returnTypeMatches) +
      Number(staticMatches) +
      Number(abstractMatches)) /
    6;
  return {
    refName: refMethod.name,
    studentName: studentMethod.name,
    visibilityMatches,
    parametersMatch,
    returnTypeMatches,
    staticMatches,
    abstractMatches,
    aspectScore,
  };
};

type AttributeDiffOutcome = ClassMatch['attributes'];
type MethodDiffOutcome = ClassMatch['methods'];

const diffAttributes = (
  refAttrs: ClassAttribute[],
  studentAttrs: ClassAttribute[]
): AttributeDiffOutcome => {
  const studentByName = new Map<string, ClassAttribute>();
  for (const attr of studentAttrs) studentByName.set(normalizeName(attr.name), attr);

  const matched: AttributeMatch[] = [];
  const missing: string[] = [];
  const usedStudent = new Set<string>();

  for (const refAttr of refAttrs) {
    const key = normalizeName(refAttr.name);
    const studentAttr = studentByName.get(key);
    if (studentAttr) {
      matched.push(compareAttribute(refAttr, studentAttr));
      usedStudent.add(key);
    } else {
      missing.push(refAttr.name);
    }
  }

  const extra: string[] = [];
  for (const studentAttr of studentAttrs) {
    if (!usedStudent.has(normalizeName(studentAttr.name))) {
      extra.push(studentAttr.name);
    }
  }

  // Score: average aspect score weighted by (matched / refTotal)
  const refTotal = refAttrs.length;
  if (refTotal === 0) {
    // No attributes expected — extras aren't penalised structurally
    return { matched, missing, extra, score: 1 };
  }
  const avgAspect = matched.length === 0
    ? 0
    : matched.reduce((acc, m) => acc + m.aspectScore, 0) / matched.length;
  const coverage = matched.length / refTotal;
  const score = coverage * avgAspect;
  return { matched, missing, extra, score };
};

const diffMethods = (
  refMethods: ClassMethod[],
  studentMethods: ClassMethod[]
): MethodDiffOutcome => {
  const studentByName = new Map<string, ClassMethod>();
  for (const method of studentMethods) studentByName.set(normalizeName(method.name), method);

  const matched: MethodMatch[] = [];
  const missing: string[] = [];
  const usedStudent = new Set<string>();

  for (const refMethod of refMethods) {
    const key = normalizeName(refMethod.name);
    const studentMethod = studentByName.get(key);
    if (studentMethod) {
      matched.push(compareMethod(refMethod, studentMethod));
      usedStudent.add(key);
    } else {
      missing.push(refMethod.name);
    }
  }

  const extra: string[] = [];
  for (const studentMethod of studentMethods) {
    if (!usedStudent.has(normalizeName(studentMethod.name))) {
      extra.push(studentMethod.name);
    }
  }

  const refTotal = refMethods.length;
  if (refTotal === 0) {
    return { matched, missing, extra, score: 1 };
  }
  const avgAspect = matched.length === 0
    ? 0
    : matched.reduce((acc, m) => acc + m.aspectScore, 0) / matched.length;
  const coverage = matched.length / refTotal;
  const score = coverage * avgAspect;
  return { matched, missing, extra, score };
};

const buildNodeIndex = (nodes: ClassDiagramNode[]): Map<string, ClassDiagramNode> => {
  const idx = new Map<string, ClassDiagramNode>();
  for (const node of nodes) {
    idx.set(normalizeName(node.data.name), node);
  }
  return idx;
};

const buildClassesById = (nodes: ClassDiagramNode[]): Map<string, ClassDiagramNode> => {
  const idx = new Map<string, ClassDiagramNode>();
  for (const node of nodes) idx.set(node.id, node);
  return idx;
};

const refToEdgeRef = (
  edge: ClassDiagramEdge,
  byId: Map<string, ClassDiagramNode>
): EdgeRef | null => {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;
  return {
    source: source.data.name,
    target: target.data.name,
    relationship: edge.data.relationship,
  };
};

export function diffClassDiagrams(
  student: ClassDiagramState,
  reference: ClassDiagramState
): ClassDiagramDiffResult {
  const refByName = buildNodeIndex(reference.nodes);
  const studentByName = buildNodeIndex(student.nodes);

  const matchedClasses: ClassMatch[] = [];
  const missingClasses: string[] = [];
  const usedStudent = new Set<string>();

  let attrMatchedCount = 0;
  let attrTotalCount = 0;
  let attrAggregateScore = 0;

  let methodMatchedCount = 0;
  let methodTotalCount = 0;
  let methodAggregateScore = 0;

  for (const [refKey, refNode] of refByName) {
    const studentNode = studentByName.get(refKey);
    if (!studentNode) {
      missingClasses.push(refNode.data.name);
      attrTotalCount += refNode.data.attributes.length;
      methodTotalCount += refNode.data.methods.length;
      continue;
    }

    usedStudent.add(refKey);

    const refElementType = refNode.data.elementType ?? 'class';
    const studentElementType = studentNode.data.elementType ?? 'class';
    const elementTypeMatches = refElementType === studentElementType;

    const attrOutcome = diffAttributes(refNode.data.attributes, studentNode.data.attributes);
    const methodOutcome = diffMethods(refNode.data.methods, studentNode.data.methods);

    matchedClasses.push({
      refName: refNode.data.name,
      studentName: studentNode.data.name,
      refElementType,
      studentElementType,
      elementTypeMatches,
      attributes: attrOutcome,
      methods: methodOutcome,
    });

    attrMatchedCount += attrOutcome.matched.length;
    attrTotalCount += refNode.data.attributes.length;
    attrAggregateScore += attrOutcome.score * Math.max(refNode.data.attributes.length, 1);

    methodMatchedCount += methodOutcome.matched.length;
    methodTotalCount += refNode.data.methods.length;
    methodAggregateScore += methodOutcome.score * Math.max(refNode.data.methods.length, 1);
  }

  const extraClasses: string[] = [];
  for (const [studentKey, studentNode] of studentByName) {
    if (!usedStudent.has(studentKey)) {
      extraClasses.push(studentNode.data.name);
    }
  }

  const refClassTotal = reference.nodes.length;
  const classCoverage = safeRatio(matchedClasses.length, refClassTotal);
  // Element-type mismatches discount the matched class to 0.7
  const matchedClassQuality =
    matchedClasses.length === 0
      ? 1
      : matchedClasses.reduce(
          (acc, m) => acc + (m.elementTypeMatches ? 1 : 0.7),
          0
        ) / matchedClasses.length;
  const classScore = classCoverage * matchedClassQuality;

  const refClassesById = buildClassesById(reference.nodes);
  const studentClassesById = buildClassesById(student.nodes);

  const refEdges: EdgeRef[] = reference.edges
    .map((e) => refToEdgeRef(e, refClassesById))
    .filter((e): e is EdgeRef => e !== null);
  const studentEdges: EdgeRef[] = student.edges
    .map((e) => refToEdgeRef(e, studentClassesById))
    .filter((e): e is EdgeRef => e !== null);

  // Match edges: prefer exact (source, target, relationship); fall back to (source, target)
  const matchedEdges: EdgeMatch[] = [];
  const missingEdges: EdgeRef[] = [];
  const usedStudentEdges = new Set<number>();

  for (const refEdge of refEdges) {
    const refKey = `${normalizeName(refEdge.source)}->${normalizeName(refEdge.target)}`;
    let foundIdx = -1;
    let exactMatch = false;
    for (let i = 0; i < studentEdges.length; i += 1) {
      if (usedStudentEdges.has(i)) continue;
      const se = studentEdges[i];
      const seKey = `${normalizeName(se.source)}->${normalizeName(se.target)}`;
      if (seKey === refKey) {
        if (se.relationship === refEdge.relationship) {
          foundIdx = i;
          exactMatch = true;
          break;
        }
        if (foundIdx === -1) foundIdx = i; // tentative wrong-type match
      }
    }
    if (foundIdx >= 0) {
      const studentEdge = studentEdges[foundIdx];
      matchedEdges.push({
        ref: refEdge,
        student: studentEdge,
        relationshipMatches: exactMatch || studentEdge.relationship === refEdge.relationship,
      });
      usedStudentEdges.add(foundIdx);
    } else {
      missingEdges.push(refEdge);
    }
  }

  const extraEdges: EdgeRef[] = studentEdges.filter((_, idx) => !usedStudentEdges.has(idx));

  const refEdgeTotal = refEdges.length;
  const edgeCoverage = safeRatio(matchedEdges.length, refEdgeTotal);
  const edgeQuality =
    matchedEdges.length === 0
      ? 1
      : matchedEdges.reduce(
          (acc, m) => acc + (m.relationshipMatches ? 1 : 0.5),
          0
        ) / matchedEdges.length;
  const edgeScore = edgeCoverage * edgeQuality;

  const attrScore = attrTotalCount === 0 ? 1 : attrAggregateScore / Math.max(attrTotalCount, 1);
  const methodScore =
    methodTotalCount === 0 ? 1 : methodAggregateScore / Math.max(methodTotalCount, 1);

  const totalScore =
    classScore * CLASS_WEIGHT +
    edgeScore * EDGE_WEIGHT +
    attrScore * ATTRIBUTE_WEIGHT +
    methodScore * METHOD_WEIGHT;

  const summary = formatSummary({
    classMatched: matchedClasses.length,
    classMissing: missingClasses.length,
    classExtra: extraClasses.length,
    edgeMatched: matchedEdges.length,
    edgeMissing: missingEdges.length,
    edgeExtra: extraEdges.length,
    attrMatched: attrMatchedCount,
    attrTotal: attrTotalCount,
    methodMatched: methodMatchedCount,
    methodTotal: methodTotalCount,
    score: totalScore,
  });

  return {
    score: Math.max(0, Math.min(1, totalScore)),
    classes: {
      matched: matchedClasses,
      missing: missingClasses,
      extra: extraClasses,
      score: classScore,
    },
    edges: {
      matched: matchedEdges,
      missing: missingEdges,
      extra: extraEdges,
      score: edgeScore,
    },
    summary,
  };
}

const formatSummary = (input: {
  classMatched: number;
  classMissing: number;
  classExtra: number;
  edgeMatched: number;
  edgeMissing: number;
  edgeExtra: number;
  attrMatched: number;
  attrTotal: number;
  methodMatched: number;
  methodTotal: number;
  score: number;
}): string => {
  const pct = (input.score * 100).toFixed(1);
  return [
    `Structural score: ${pct}%.`,
    `Classes: ${input.classMatched} matched, ${input.classMissing} missing, ${input.classExtra} extra.`,
    `Relationships: ${input.edgeMatched} matched, ${input.edgeMissing} missing, ${input.edgeExtra} extra.`,
    `Attributes: ${input.attrMatched}/${input.attrTotal} matched.`,
    `Methods: ${input.methodMatched}/${input.methodTotal} matched.`,
  ].join(' ');
};

/**
 * Render the diff result as a compact textual block to embed in an LLM prompt.
 * Stable formatting keeps the prompt deterministic and explainable.
 */
export function formatDiffForPrompt(diff: ClassDiagramDiffResult): string {
  const lines: string[] = [];
  lines.push(`Structural score (deterministic): ${(diff.score * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('CLASSES:');
  if (diff.classes.matched.length > 0) {
    lines.push(`  Matched (${diff.classes.matched.length}):`);
    for (const m of diff.classes.matched) {
      const elem = m.elementTypeMatches
        ? `[${m.refElementType}]`
        : `[expected ${m.refElementType}, got ${m.studentElementType}]`;
      lines.push(`    - ${m.refName} ${elem}`);
      if (m.attributes.missing.length > 0) {
        lines.push(`        missing attrs: ${m.attributes.missing.join(', ')}`);
      }
      if (m.attributes.extra.length > 0) {
        lines.push(`        extra attrs: ${m.attributes.extra.join(', ')}`);
      }
      if (m.methods.missing.length > 0) {
        lines.push(`        missing methods: ${m.methods.missing.join(', ')}`);
      }
      if (m.methods.extra.length > 0) {
        lines.push(`        extra methods: ${m.methods.extra.join(', ')}`);
      }
    }
  }
  if (diff.classes.missing.length > 0) {
    lines.push(`  Missing (${diff.classes.missing.length}): ${diff.classes.missing.join(', ')}`);
  }
  if (diff.classes.extra.length > 0) {
    lines.push(`  Extra (${diff.classes.extra.length}): ${diff.classes.extra.join(', ')}`);
  }
  lines.push('');
  lines.push('RELATIONSHIPS:');
  if (diff.edges.matched.length > 0) {
    lines.push(`  Matched (${diff.edges.matched.length}):`);
    for (const m of diff.edges.matched) {
      const tag = m.relationshipMatches
        ? `[${m.ref.relationship}]`
        : `[expected ${m.ref.relationship}, got ${m.student.relationship}]`;
      lines.push(`    - ${m.ref.source} → ${m.ref.target} ${tag}`);
    }
  }
  if (diff.edges.missing.length > 0) {
    lines.push(`  Missing (${diff.edges.missing.length}):`);
    for (const e of diff.edges.missing) {
      lines.push(`    - ${e.source} → ${e.target} [${e.relationship}]`);
    }
  }
  if (diff.edges.extra.length > 0) {
    lines.push(`  Extra (${diff.edges.extra.length}):`);
    for (const e of diff.edges.extra) {
      lines.push(`    - ${e.source} → ${e.target} [${e.relationship}]`);
    }
  }
  return lines.join('\n');
}
