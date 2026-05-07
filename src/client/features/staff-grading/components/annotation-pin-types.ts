export type AnnotationAnchor =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'class-node'; nodeId: string }
  | { kind: 'class-edge'; edgeId: string }
  | { kind: 'sequence-lifeline'; lifelineId: string }
  | { kind: 'sequence-message'; messageId: string };

export type AnnotationPin = {
  id: string;
  label: number;
  comment: string;
  type: 'error' | 'improvement' | 'good';
  anchor: AnnotationAnchor;
};

const generatePinId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pin-${crypto.randomUUID()}`;
  }
  return `pin-${Math.random().toString(36).slice(2, 10)}`;
};

const isPinType = (value: unknown): value is AnnotationPin['type'] =>
  value === 'error' || value === 'improvement' || value === 'good';

const isAnchor = (value: unknown): value is AnnotationAnchor => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case 'free':
      return typeof v.x === 'number' && typeof v.y === 'number';
    case 'class-node':
      return typeof v.nodeId === 'string';
    case 'class-edge':
      return typeof v.edgeId === 'string';
    case 'sequence-lifeline':
      return typeof v.lifelineId === 'string';
    case 'sequence-message':
      return typeof v.messageId === 'string';
    default:
      return false;
  }
};

/**
 * Tolerant pin parser. Accepts both the new `{anchor: {...}}` shape and the
 * legacy `{x, y}` shape used by data persisted before element-anchored pins.
 */
export function normalizeAnnotationPin(
  value: unknown,
  fallbackLabel: number
): AnnotationPin | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  const id = typeof v.id === 'string' && v.id.length > 0 ? v.id : generatePinId();
  const label = typeof v.label === 'number' ? v.label : fallbackLabel;
  const comment = typeof v.comment === 'string' ? v.comment : '';
  const type = isPinType(v.type) ? v.type : 'error';

  if (isAnchor(v.anchor)) {
    return { id, label, comment, type, anchor: v.anchor };
  }

  if (typeof v.x === 'number' && typeof v.y === 'number') {
    return { id, label, comment, type, anchor: { kind: 'free', x: v.x, y: v.y } };
  }

  return null;
}

export function normalizeAnnotationPins(value: unknown): AnnotationPin[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, idx) => normalizeAnnotationPin(item, idx + 1))
    .filter((pin): pin is AnnotationPin => pin !== null);
}

export const generateAnnotationPinId = generatePinId;
