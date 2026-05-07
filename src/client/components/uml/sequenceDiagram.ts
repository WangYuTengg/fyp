export type LifelineKind =
  | 'actor'
  | 'participant'
  | 'database'
  | 'control'
  | 'boundary'
  | 'entity';

export type SequenceMessageType = 'sync' | 'async' | 'reply';

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
    /** 0-indexed top-to-bottom position. Lower = earlier. */
    order: number;
  };
};

export type SequenceDiagramState = {
  lifelines: SequenceLifeline[];
  messages: SequenceMessage[];
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

export const generateSequenceId = (prefix: 'lifeline' | 'message') => {
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
  knownIds: Set<string>
): SequenceMessage | null => {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.source !== 'string' || typeof v.target !== 'string') {
    return null;
  }
  if (!knownIds.has(v.source) || !knownIds.has(v.target)) return null;
  const data =
    typeof v.data === 'object' && v.data !== null ? (v.data as Record<string, unknown>) : {};
  return {
    id: v.id,
    source: v.source,
    target: v.target,
    data: {
      messageType: isMessageType(data.messageType) ? data.messageType : 'sync',
      label: typeof data.label === 'string' && data.label.length > 0 ? data.label : undefined,
      order: typeof data.order === 'number' ? data.order : fallbackOrder,
    },
  };
};

export function normalizeSequenceDiagramState(state: unknown): SequenceDiagramState {
  if (typeof state !== 'object' || state === null) {
    return { lifelines: [], messages: [] };
  }
  const s = state as Record<string, unknown>;
  const rawLifelines = Array.isArray(s.lifelines) ? s.lifelines : [];
  const lifelines = rawLifelines
    .map((value, idx) => ensureLifeline(value, idx))
    .filter((l): l is SequenceLifeline => l !== null);

  const knownIds = new Set(lifelines.map((l) => l.id));

  const rawMessages = Array.isArray(s.messages) ? s.messages : [];
  const messages = rawMessages
    .map((value, idx) => ensureMessage(value, idx, knownIds))
    .filter((m): m is SequenceMessage => m !== null);

  // Stable order: sort by data.order
  lifelines.sort((a, b) => a.data.order - b.data.order);
  messages.sort((a, b) => a.data.order - b.data.order);

  return { lifelines, messages };
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

export function generateSequenceDiagramPlantUml(state: SequenceDiagramState): string {
  const aliases = new Map<string, { displayName: string; alias: string; kind: LifelineKind }>();
  let aliasCounter = 1;

  const sortedLifelines = [...state.lifelines].sort((a, b) => a.data.order - b.data.order);
  for (const lifeline of sortedLifelines) {
    const displayName = normalizeName(lifeline.data.name, `Participant${aliasCounter}`);
    const alias = isValidIdentifier(displayName) ? displayName : `P${aliasCounter++}`;
    aliases.set(lifeline.id, { displayName, alias, kind: lifeline.data.kind });
  }

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

  if (sortedLifelines.length > 0 && state.messages.length > 0) {
    lines.push('');
  }

  const sortedMessages = [...state.messages].sort((a, b) => a.data.order - b.data.order);
  for (const message of sortedMessages) {
    const sourceMeta = aliases.get(message.source);
    const targetMeta = aliases.get(message.target);
    if (!sourceMeta || !targetMeta) continue;
    const arrow = messageArrow[message.data.messageType];
    const label = message.data.label?.trim();
    const head = `${sourceMeta.alias} ${arrow} ${targetMeta.alias}`;
    lines.push(label ? `${head} : ${label}` : head);
  }

  lines.push('@enduml');
  return lines.join('\n');
}
