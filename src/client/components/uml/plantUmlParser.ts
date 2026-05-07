import {
  generateMemberId,
  parseLegacyAttribute,
  parseLegacyMethod,
  type ClassDiagramEdge,
  type ClassDiagramNode,
  type ClassDiagramState,
  type RelationshipType,
  type UmlElementType,
} from './classDiagram';
import {
  generateSequenceId,
  type LifelineKind,
  type SequenceDiagramState,
  type SequenceFragment,
  type SequenceFragmentKind,
  type SequenceLifeline,
  type SequenceMessage,
  type SequenceMessageType,
} from './sequenceDiagram';

export type ParseResult<TState> = {
  state: TState;
  warnings: string[];
};

const STRIP_COMMENT = /(?<!:)'.*$/;

const stripCommentAndTrim = (raw: string): string =>
  raw.replace(STRIP_COMMENT, '').trim();

const findBodyRange = (lines: string[]): { startIdx: number; endIdx: number } => {
  const startIdx = lines.findIndex((l) => /^@startuml\b/i.test(l.trim()));
  const endIdx = lines.findIndex((l) => /^@enduml\b/i.test(l.trim()));
  return {
    startIdx: startIdx >= 0 ? startIdx : -1,
    endIdx: endIdx >= 0 ? endIdx : lines.length,
  };
};

// =============================================================================
// Class diagram parser
// =============================================================================

const CLASS_DECL_REGEX =
  /^(abstract\s+class|class|interface|enum)\s+(?:"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))\s*(\{)?\s*$/i;

const NOTE_HEADER_REGEX =
  /^note\s+(?:bottom|top|left|right)(?:\s+of\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*)))?(?:\s*:\s*(.+))?$/i;

const CLASS_EDGE_REGEX =
  /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:"([^"]*)"\s*)?(<\|--|--\|>|<\|\.\.|\.\.\|>|o--|--o|\*--|--\*|<-+|-+>|-->|<--|\.\.>|<\.\.|--|\.\.)\s*(?:"([^"]*)"\s*)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*(.+))?$/;

const elementTypeFromKeyword = (keyword: string): UmlElementType => {
  const lower = keyword.toLowerCase();
  if (/^abstract\s+class$/.test(lower)) return 'abstractClass';
  if (lower === 'interface') return 'interface';
  if (lower === 'enum') return 'enum';
  return 'class';
};

const splitGenerics = (raw: string): { name: string; generics?: string } => {
  const m = raw.match(/^([^<]+)<(.+)>$/);
  if (!m) return { name: raw };
  return { name: m[1].trim(), generics: m[2].trim() };
};

const arrowToRelationship = (arrow: string): RelationshipType => {
  if (arrow.includes('<|') || arrow.includes('|>')) {
    return arrow.includes('..') ? 'realization' : 'inheritance';
  }
  if (arrow.includes('o')) return 'aggregation';
  if (arrow.includes('*')) return 'composition';
  if (arrow.includes('..')) return 'dependency';
  return 'association';
};

const classGridPosition = (index: number) => ({
  x: 40 + (index % 4) * 240,
  y: 40 + Math.floor(index / 4) * 220,
});

export function parseClassDiagramPlantUml(text: string): ParseResult<ClassDiagramState> {
  const warnings: string[] = [];
  const lines = text.split('\n');
  const { startIdx, endIdx } = findBodyRange(lines);
  const body = lines.slice(startIdx + 1, endIdx);

  const nodes: ClassDiagramNode[] = [];
  const edges: ClassDiagramEdge[] = [];
  const nodeByAlias = new Map<string, ClassDiagramNode>();

  type Mode = 'outside' | 'inBody' | 'inNote';
  let mode: Mode = 'outside';
  let currentNode: ClassDiagramNode | null = null;
  let currentNoteTarget: ClassDiagramNode | null = null;
  let currentNoteLines: string[] = [];
  let edgeCounter = 0;

  for (const rawLine of body) {
    const line = stripCommentAndTrim(rawLine);
    if (line.length === 0) continue;

    if (mode === 'inNote') {
      if (/^end\s+note$/i.test(line)) {
        if (currentNoteTarget && currentNoteLines.length > 0) {
          currentNoteTarget.data.note = currentNoteLines.join('\n').trim();
        }
        mode = 'outside';
        currentNoteTarget = null;
        currentNoteLines = [];
      } else {
        currentNoteLines.push(line);
      }
      continue;
    }

    if (mode === 'inBody' && currentNode) {
      if (line === '}') {
        mode = 'outside';
        currentNode = null;
        continue;
      }
      // Method when there's a parenthesised parameter list; otherwise attribute.
      if (/\(.*\)/.test(line)) {
        currentNode.data.methods.push(parseLegacyMethod(line));
      } else {
        currentNode.data.attributes.push(parseLegacyAttribute(line));
      }
      continue;
    }

    // outside

    const noteMatch = line.match(NOTE_HEADER_REGEX);
    if (noteMatch) {
      const targetName = noteMatch[1] ?? noteMatch[2];
      const inlineNote = noteMatch[3];
      if (!targetName) {
        warnings.push('Note without "of <Target>" — skipped (unsupported floating note).');
        continue;
      }
      const targetNode = nodeByAlias.get(targetName);
      if (!targetNode) {
        warnings.push(`Note references unknown class "${targetName}".`);
        continue;
      }
      if (inlineNote) {
        targetNode.data.note = inlineNote.trim();
      } else {
        mode = 'inNote';
        currentNoteTarget = targetNode;
        currentNoteLines = [];
      }
      continue;
    }

    const declMatch = line.match(CLASS_DECL_REGEX);
    if (declMatch) {
      const elementType = elementTypeFromKeyword(declMatch[1]);
      const quotedName = declMatch[2];
      const quotedAlias = declMatch[3];
      const plainName = declMatch[4];
      const hasBody = Boolean(declMatch[5]);

      const rawDisplayName = quotedName ?? plainName!;
      const alias = quotedAlias ?? plainName!;
      const { name, generics } = splitGenerics(rawDisplayName);

      const node: ClassDiagramNode = {
        id: generateMemberId('class'),
        position: classGridPosition(nodes.length),
        data: {
          name,
          generics,
          attributes: [],
          methods: [],
          elementType,
        },
      };
      nodes.push(node);
      nodeByAlias.set(alias, node);

      if (hasBody) {
        mode = 'inBody';
        currentNode = node;
      }
      continue;
    }

    if (line === '{' || line === '}') {
      warnings.push(`Stray "${line}" outside a class body — only inline body openers/closers are supported.`);
      continue;
    }

    const edgeMatch = line.match(CLASS_EDGE_REGEX);
    if (edgeMatch) {
      const sourceAlias = edgeMatch[1];
      const sourceMult = edgeMatch[2];
      const arrow = edgeMatch[3];
      const targetMult = edgeMatch[4];
      const targetAlias = edgeMatch[5];
      const label = edgeMatch[6]?.trim();

      const source = nodeByAlias.get(sourceAlias);
      const target = nodeByAlias.get(targetAlias);
      if (!source || !target) {
        warnings.push(
          `Relationship "${sourceAlias} ${arrow} ${targetAlias}" references undeclared class.`
        );
        continue;
      }

      edges.push({
        id: `edge-${edgeCounter++}`,
        source: source.id,
        target: target.id,
        data: {
          relationship: arrowToRelationship(arrow),
          label: label && label.length > 0 ? label : undefined,
          sourceMultiplicity: sourceMult && sourceMult.length > 0 ? sourceMult : undefined,
          targetMultiplicity: targetMult && targetMult.length > 0 ? targetMult : undefined,
        },
      });
      continue;
    }

    if (line.startsWith('@')) continue;
    if (/^(skinparam|title|hide|show|left to right direction|top to bottom direction)/i.test(line)) {
      continue;
    }

    warnings.push(`Unrecognised line: "${line}".`);
  }

  if (mode === 'inBody') warnings.push('Class body did not close before @enduml.');
  if (mode === 'inNote') warnings.push('Note block did not close before @enduml.');

  return { state: { nodes, edges }, warnings };
}

// =============================================================================
// Sequence diagram parser
// =============================================================================

const LIFELINE_DECL_REGEX =
  /^(actor|participant|database|control|boundary|entity)\s+(?:"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))\s*$/i;

const SEQUENCE_MESSAGE_REGEX =
  /^([A-Za-z_][A-Za-z0-9_]*)\s+(->>|-->|->)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*(.+))?$/;

const FRAGMENT_OPEN_REGEX = /^(alt|opt|loop|par)(?:\s+(.+))?$/i;
const ELSE_REGEX = /^else(?:\s+(.+))?$/i;
const ACTIVATE_REGEX = /^(activate|deactivate)\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i;

const arrowToMessageType = (arrow: string): SequenceMessageType => {
  if (arrow === '->>') return 'async';
  if (arrow === '-->') return 'reply';
  return 'sync';
};

export function parseSequenceDiagramPlantUml(text: string): ParseResult<SequenceDiagramState> {
  const warnings: string[] = [];
  const lines = text.split('\n');
  const { startIdx, endIdx } = findBodyRange(lines);
  const body = lines.slice(startIdx + 1, endIdx);

  const lifelines: SequenceLifeline[] = [];
  const messages: SequenceMessage[] = [];
  const fragments: SequenceFragment[] = [];
  const lifelineByAlias = new Map<string, SequenceLifeline>();

  // Stack lets us track which fragment + branch we're inside (no nesting in v1, but stack-shaped for safety).
  type StackEntry = { fragmentId: string; branchIndex: number };
  const fragmentStack: StackEntry[] = [];

  // Counters: top-level shares between top-level messages and fragments;
  //           branch-local counters are per (fragment, branchIndex) for messages inside.
  let topLevelCounter = 0;
  const branchCounters = new Map<string, number>();

  const branchKey = (entry: StackEntry) =>
    `${entry.fragmentId}:${entry.branchIndex}`;

  const allocateMessageOrder = (): number => {
    if (fragmentStack.length === 0) return topLevelCounter++;
    const top = fragmentStack[fragmentStack.length - 1];
    const key = branchKey(top);
    const cur = branchCounters.get(key) ?? 0;
    branchCounters.set(key, cur + 1);
    return cur;
  };

  let lastMessage: SequenceMessage | null = null;

  for (const rawLine of body) {
    const line = stripCommentAndTrim(rawLine);
    if (line.length === 0) continue;

    const lifelineMatch = line.match(LIFELINE_DECL_REGEX);
    if (lifelineMatch) {
      const kind = lifelineMatch[1].toLowerCase() as LifelineKind;
      const displayName = lifelineMatch[2] ?? lifelineMatch[4];
      const alias = lifelineMatch[3] ?? lifelineMatch[4];
      const lifeline: SequenceLifeline = {
        id: generateSequenceId('lifeline'),
        data: {
          name: displayName,
          kind,
          order: lifelines.length,
        },
      };
      lifelines.push(lifeline);
      lifelineByAlias.set(alias, lifeline);
      continue;
    }

    const fragMatch = line.match(FRAGMENT_OPEN_REGEX);
    if (fragMatch) {
      const kind = fragMatch[1].toLowerCase() as SequenceFragmentKind;
      const label = fragMatch[2]?.trim();
      const fragment: SequenceFragment = {
        id: generateSequenceId('fragment'),
        kind,
        data: {
          order: topLevelCounter++,
          label: label && label.length > 0 ? label : undefined,
        },
      };
      fragments.push(fragment);
      fragmentStack.push({ fragmentId: fragment.id, branchIndex: 0 });
      continue;
    }

    const elseMatch = line.match(ELSE_REGEX);
    if (elseMatch) {
      if (fragmentStack.length === 0) {
        warnings.push('Stray "else" with no matching fragment opener.');
        continue;
      }
      const top = fragmentStack[fragmentStack.length - 1];
      const fragment = fragments.find((f) => f.id === top.fragmentId);
      if (fragment) {
        const elseLabel = elseMatch[1]?.trim() ?? '';
        const labels = fragment.data.elseLabels ? [...fragment.data.elseLabels] : [];
        labels.push(elseLabel);
        fragment.data.elseLabels = labels;
        top.branchIndex = labels.length; // 1-indexed branch (0 = main)
      }
      continue;
    }

    if (line.toLowerCase() === 'end') {
      if (fragmentStack.length > 0) {
        fragmentStack.pop();
      } else {
        warnings.push('Stray "end" with no matching fragment opener.');
      }
      continue;
    }

    const actMatch = line.match(ACTIVATE_REGEX);
    if (actMatch) {
      const verb = actMatch[1].toLowerCase();
      const alias = actMatch[2];
      const lifeline = lifelineByAlias.get(alias);
      if (!lifeline) {
        warnings.push(`"${verb} ${alias}" references unknown lifeline.`);
        continue;
      }
      if (!lastMessage) {
        warnings.push(`"${verb} ${alias}" with no preceding message — skipped.`);
        continue;
      }
      if (verb === 'activate' && lifeline.id === lastMessage.target) {
        lastMessage.data.activatesTarget = true;
      } else if (verb === 'deactivate' && lifeline.id === lastMessage.source) {
        lastMessage.data.deactivatesSource = true;
      } else {
        warnings.push(
          `"${verb} ${alias}" doesn't match the previous message's target/source — kept as plain text.`
        );
      }
      continue;
    }

    const msgMatch = line.match(SEQUENCE_MESSAGE_REGEX);
    if (msgMatch) {
      const sourceAlias = msgMatch[1];
      const arrow = msgMatch[2];
      const targetAlias = msgMatch[3];
      const label = msgMatch[4]?.trim();

      const source = lifelineByAlias.get(sourceAlias);
      const target = lifelineByAlias.get(targetAlias);
      if (!source || !target) {
        warnings.push(
          `Message "${sourceAlias} ${arrow} ${targetAlias}" references unknown lifeline.`
        );
        continue;
      }

      const top = fragmentStack[fragmentStack.length - 1];
      const message: SequenceMessage = {
        id: generateSequenceId('message'),
        source: source.id,
        target: target.id,
        data: {
          messageType: arrowToMessageType(arrow),
          label: label && label.length > 0 ? label : undefined,
          order: allocateMessageOrder(),
          parentFragmentId: top?.fragmentId,
          parentBranchIndex: top?.branchIndex,
        },
      };
      messages.push(message);
      lastMessage = message;
      continue;
    }

    if (line.startsWith('@')) continue;
    if (/^(skinparam|title|hide|show|note|autonumber)/i.test(line)) {
      // Notes / autonumber are valid PlantUML but not preserved in the visual builder.
      continue;
    }

    warnings.push(`Unrecognised line: "${line}".`);
  }

  if (fragmentStack.length > 0) {
    warnings.push('Fragment(s) did not close before @enduml.');
  }

  return {
    state: { lifelines, messages, fragments },
    warnings,
  };
}
