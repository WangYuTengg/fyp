export type LifelineKind =
  | 'actor'
  | 'participant'
  | 'database'
  | 'control'
  | 'boundary'
  | 'entity';

export type SequenceMessageType = 'sync' | 'async' | 'reply';

export type SequenceFragmentKind = 'alt' | 'opt' | 'loop' | 'par';

export const LIFELINE_KIND_OPTIONS: ReadonlyArray<{ value: LifelineKind; label: string }> = [
  { value: 'actor', label: 'Actor' },
  { value: 'participant', label: 'Participant' },
  { value: 'database', label: 'Database' },
  { value: 'control', label: 'Control' },
  { value: 'boundary', label: 'Boundary' },
  { value: 'entity', label: 'Entity' },
];

export const MESSAGE_TYPE_OPTIONS: ReadonlyArray<{ value: SequenceMessageType; label: string }> = [
  { value: 'sync', label: 'Synchronous (→)' },
  { value: 'async', label: 'Asynchronous (⇢)' },
  { value: 'reply', label: 'Reply (- - >)' },
];

export const SEQUENCE_FRAGMENT_KIND_OPTIONS: ReadonlyArray<{
  value: SequenceFragmentKind;
  label: string;
}> = [
  { value: 'alt', label: 'Alternative (alt / else)' },
  { value: 'opt', label: 'Optional (opt)' },
  { value: 'loop', label: 'Loop' },
  { value: 'par', label: 'Parallel (par / else)' },
];

export type SequenceLifeline = {
  id: string;
  data: {
    name: string;
    kind: LifelineKind;
    /** 0-indexed left-to-right position. Lower = further left. */
    order: number;
  };
};

export type SequenceMessage = {
  id: string;
  /** Lifeline id of the sender. */
  source: string;
  /** Lifeline id of the receiver. May equal source for self-messages. */
  target: string;
  data: {
    messageType: SequenceMessageType;
    label?: string;
    /** 0-indexed top-to-bottom position within its parent (top-level or branch). */
    order: number;
    /** When set, the message is rendered inside this fragment's branch. */
    parentFragmentId?: string;
    /** Branch index within the parent fragment. 0 = main branch, 1+ = else branches. */
    parentBranchIndex?: number;
    /** Emit `activate <target>` immediately after this message. */
    activatesTarget?: boolean;
    /** Emit `deactivate <source>` immediately after this message (typical for replies). */
    deactivatesSource?: boolean;
  };
};

export type SequenceFragment = {
  id: string;
  kind: SequenceFragmentKind;
  data: {
    /** Top-level position interleaved with non-fragment messages. */
    order: number;
    /** Header guard / condition (e.g. "x > 0"). */
    label?: string;
    /** Extra branch labels after the main one. alt: else conditions; par: parallel branches. */
    elseLabels?: string[];
  };
};

export type SequenceDiagramState = {
  lifelines: SequenceLifeline[];
  messages: SequenceMessage[];
  fragments?: SequenceFragment[];
};

export const DEFAULT_SEQUENCE_DIAGRAM_STATE: SequenceDiagramState = {
  lifelines: [
    { id: 'lifeline-user', data: { name: 'User', kind: 'actor', order: 0 } },
    { id: 'lifeline-system', data: { name: 'System', kind: 'participant', order: 1 } },
  ],
  messages: [
    {
      id: 'message-1',
      source: 'lifeline-user',
      target: 'lifeline-system',
      data: { messageType: 'sync', label: 'request', order: 0 },
    },
    {
      id: 'message-2',
      source: 'lifeline-system',
      target: 'lifeline-user',
      data: { messageType: 'reply', label: 'response', order: 1 },
    },
  ],
};

export const generateSequenceId = (prefix: 'lifeline' | 'message' | 'fragment') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const isLifelineKind = (value: unknown): value is LifelineKind =>
  value === 'actor' ||
  value === 'participant' ||
  value === 'database' ||
  value === 'control' ||
  value === 'boundary' ||
  value === 'entity';

const isMessageType = (value: unknown): value is SequenceMessageType =>
  value === 'sync' || value === 'async' || value === 'reply';

const isFragmentKind = (value: unknown): value is SequenceFragmentKind =>
  value === 'alt' || value === 'opt' || value === 'loop' || value === 'par';

const ensureLifeline = (value: unknown, fallbackOrder: number): SequenceLifeline | null => {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return null;
  const data =
    typeof v.data === 'object' && v.data !== null ? (v.data as Record<string, unknown>) : {};
  return {
    id: v.id,
    data: {
      name: typeof data.name === 'string' ? data.name : '',
      kind: isLifelineKind(data.kind) ? data.kind : 'participant',
      order: typeof data.order === 'number' ? data.order : fallbackOrder,
    },
  };
};

const ensureMessage = (
  value: unknown,
  fallbackOrder: number,
  knownIds: Set<string>,
  knownFragmentIds: Set<string>
): SequenceMessage | null => {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.source !== 'string' || typeof v.target !== 'string') {
    return null;
  }
  if (!knownIds.has(v.source) || !knownIds.has(v.target)) return null;
  const data =
    typeof v.data === 'object' && v.data !== null ? (v.data as Record<string, unknown>) : {};

  // Drop dangling parentFragmentId; clamp branch index to a sane integer.
  let parentFragmentId: string | undefined;
  let parentBranchIndex: number | undefined;
  if (typeof data.parentFragmentId === 'string' && knownFragmentIds.has(data.parentFragmentId)) {
    parentFragmentId = data.parentFragmentId;
    if (typeof data.parentBranchIndex === 'number' && Number.isFinite(data.parentBranchIndex)) {
      parentBranchIndex = Math.max(0, Math.floor(data.parentBranchIndex));
    } else {
      parentBranchIndex = 0;
    }
  }

  return {
    id: v.id,
    source: v.source,
    target: v.target,
    data: {
      messageType: isMessageType(data.messageType) ? data.messageType : 'sync',
      label: typeof data.label === 'string' && data.label.length > 0 ? data.label : undefined,
      order: typeof data.order === 'number' ? data.order : fallbackOrder,
      parentFragmentId,
      parentBranchIndex,
      activatesTarget: data.activatesTarget === true ? true : undefined,
      deactivatesSource: data.deactivatesSource === true ? true : undefined,
    },
  };
};

const ensureFragment = (value: unknown, fallbackOrder: number): SequenceFragment | null => {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return null;
  if (!isFragmentKind(v.kind)) return null;
  const data =
    typeof v.data === 'object' && v.data !== null ? (v.data as Record<string, unknown>) : {};
  const elseLabelsRaw = Array.isArray(data.elseLabels) ? data.elseLabels : [];
  const elseLabels = elseLabelsRaw
    .map((label) => (typeof label === 'string' ? label : ''))
    .filter((_, idx) => idx < 8); // sane cap on branches
  return {
    id: v.id,
    kind: v.kind,
    data: {
      order: typeof data.order === 'number' ? data.order : fallbackOrder,
      label: typeof data.label === 'string' && data.label.length > 0 ? data.label : undefined,
      elseLabels: elseLabels.length > 0 ? elseLabels : undefined,
    },
  };
};

export function normalizeSequenceDiagramState(state: unknown): SequenceDiagramState {
  if (typeof state !== 'object' || state === null) {
    return { lifelines: [], messages: [], fragments: [] };
  }
  const s = state as Record<string, unknown>;
  const rawLifelines = Array.isArray(s.lifelines) ? s.lifelines : [];
  const lifelines = rawLifelines
    .map((value, idx) => ensureLifeline(value, idx))
    .filter((l): l is SequenceLifeline => l !== null);

  const knownIds = new Set(lifelines.map((l) => l.id));

  const rawFragments = Array.isArray(s.fragments) ? s.fragments : [];
  const fragments = rawFragments
    .map((value, idx) => ensureFragment(value, idx))
    .filter((f): f is SequenceFragment => f !== null);

  const knownFragmentIds = new Set(fragments.map((f) => f.id));

  const rawMessages = Array.isArray(s.messages) ? s.messages : [];
  const messages = rawMessages
    .map((value, idx) => ensureMessage(value, idx, knownIds, knownFragmentIds))
    .filter((m): m is SequenceMessage => m !== null);

  // Stable order: sort by data.order
  lifelines.sort((a, b) => a.data.order - b.data.order);
  messages.sort((a, b) => a.data.order - b.data.order);
  fragments.sort((a, b) => a.data.order - b.data.order);

  return { lifelines, messages, fragments };
}

const isValidIdentifier = (value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);

const lifelineKeyword: Record<LifelineKind, string> = {
  actor: 'actor',
  participant: 'participant',
  database: 'database',
  control: 'control',
  boundary: 'boundary',
  entity: 'entity',
};

const messageArrow: Record<SequenceMessageType, string> = {
  sync: '->',
  async: '->>',
  reply: '-->',
};

const normalizeName = (raw: string, fallback: string) => {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

type LifelineMeta = { displayName: string; alias: string; kind: LifelineKind };

const buildLifelineAliases = (
  state: SequenceDiagramState
): { aliases: Map<string, LifelineMeta>; sortedLifelines: SequenceLifeline[] } => {
  const aliases = new Map<string, LifelineMeta>();
  let aliasCounter = 1;
  const sortedLifelines = [...state.lifelines].sort((a, b) => a.data.order - b.data.order);
  for (const lifeline of sortedLifelines) {
    const displayName = normalizeName(lifeline.data.name, `Participant${aliasCounter}`);
    const alias = isValidIdentifier(displayName) ? displayName : `P${aliasCounter++}`;
    aliases.set(lifeline.id, { displayName, alias, kind: lifeline.data.kind });
  }
  return { aliases, sortedLifelines };
};

const emitMessageLines = (
  message: SequenceMessage,
  aliases: Map<string, LifelineMeta>,
  out: string[],
  indent: string
): void => {
  const sourceMeta = aliases.get(message.source);
  const targetMeta = aliases.get(message.target);
  if (!sourceMeta || !targetMeta) return;
  const arrow = messageArrow[message.data.messageType];
  const label = message.data.label?.trim();
  const head = `${sourceMeta.alias} ${arrow} ${targetMeta.alias}`;
  out.push(`${indent}${label ? `${head} : ${label}` : head}`);
  if (message.data.activatesTarget) out.push(`${indent}activate ${targetMeta.alias}`);
  if (message.data.deactivatesSource) out.push(`${indent}deactivate ${sourceMeta.alias}`);
};

export function generateSequenceDiagramPlantUml(state: SequenceDiagramState): string {
  const { aliases, sortedLifelines } = buildLifelineAliases(state);
  const fragments = state.fragments ?? [];
  const lines: string[] = ['@startuml'];

  for (const lifeline of sortedLifelines) {
    const meta = aliases.get(lifeline.id);
    if (!meta) continue;
    const keyword = lifelineKeyword[meta.kind];
    if (meta.alias === meta.displayName) {
      lines.push(`${keyword} ${meta.displayName}`);
    } else {
      lines.push(`${keyword} "${meta.displayName}" as ${meta.alias}`);
    }
  }

  const hasBody = state.messages.length > 0 || fragments.length > 0;
  if (sortedLifelines.length > 0 && hasBody) {
    lines.push('');
  }

  // Bucket messages by parent fragment + branch.
  type Bucket = Map<number, SequenceMessage[]>;
  const messagesByFragment = new Map<string, Bucket>();
  const topLevelMessages: SequenceMessage[] = [];
  for (const message of state.messages) {
    const parentId = message.data.parentFragmentId;
    if (parentId) {
      let bucket = messagesByFragment.get(parentId);
      if (!bucket) {
        bucket = new Map<number, SequenceMessage[]>();
        messagesByFragment.set(parentId, bucket);
      }
      const branchIdx = message.data.parentBranchIndex ?? 0;
      const arr = bucket.get(branchIdx) ?? [];
      arr.push(message);
      bucket.set(branchIdx, arr);
    } else {
      topLevelMessages.push(message);
    }
  }

  // Top-level items: messages + fragments, interleaved by data.order.
  type Item =
    | { kind: 'message'; m: SequenceMessage; order: number }
    | { kind: 'fragment'; f: SequenceFragment; order: number };
  const items: Item[] = [
    ...topLevelMessages.map((m) => ({ kind: 'message' as const, m, order: m.data.order })),
    ...fragments.map((f) => ({ kind: 'fragment' as const, f, order: f.data.order })),
  ].sort((a, b) => a.order - b.order);

  const emitFragmentBlock = (fragment: SequenceFragment, indent: string) => {
    const headerLabel = fragment.data.label?.trim();
    lines.push(`${indent}${fragment.kind}${headerLabel ? ` ${headerLabel}` : ''}`);
    const childIndent = `${indent}  `;
    const bucket = messagesByFragment.get(fragment.id) ?? new Map<number, SequenceMessage[]>();
    const mainMessages = (bucket.get(0) ?? []).sort((a, b) => a.data.order - b.data.order);
    for (const message of mainMessages) emitMessageLines(message, aliases, lines, childIndent);

    const elseLabels = fragment.data.elseLabels ?? [];
    for (let i = 0; i < elseLabels.length; i += 1) {
      const branchIdx = i + 1;
      const elseLabel = elseLabels[i]?.trim();
      lines.push(`${indent}else${elseLabel ? ` ${elseLabel}` : ''}`);
      const branchMessages = (bucket.get(branchIdx) ?? []).sort(
        (a, b) => a.data.order - b.data.order
      );
      for (const message of branchMessages) emitMessageLines(message, aliases, lines, childIndent);
    }

    lines.push(`${indent}end`);
  };

  for (const item of items) {
    if (item.kind === 'message') {
      emitMessageLines(item.m, aliases, lines, '');
    } else {
      emitFragmentBlock(item.f, '');
    }
  }

  lines.push('@enduml');
  return lines.join('\n');
}
