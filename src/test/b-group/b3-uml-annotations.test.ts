import { describe, it, expect } from 'vitest';
import {
  normalizeAnnotationPin,
  normalizeAnnotationPins,
  type AnnotationPin,
} from '../../client/features/staff-grading/components/annotation-pin-types';

describe('B3: UML Annotation — Data Model', () => {
  it('free-anchored pin captures percentage coordinates', () => {
    const pin: AnnotationPin = {
      id: 'pin-1',
      label: 1,
      comment: 'Should be composition',
      type: 'error',
      anchor: { kind: 'free', x: 45.2, y: 32.1 },
    };

    expect(pin.anchor.kind).toBe('free');
    if (pin.anchor.kind === 'free') {
      expect(pin.anchor.x).toBeGreaterThanOrEqual(0);
      expect(pin.anchor.x).toBeLessThanOrEqual(100);
      expect(pin.anchor.y).toBeGreaterThanOrEqual(0);
      expect(pin.anchor.y).toBeLessThanOrEqual(100);
    }
    expect(pin.label).toBe(1);
    expect(pin.comment).toBe('Should be composition');
    expect(pin.type).toBe('error');
  });

  it('supports all annotation types', () => {
    const types: AnnotationPin['type'][] = ['error', 'improvement', 'good'];
    expect(types).toHaveLength(3);
  });

  it('supports element-anchored pins for class and sequence diagrams', () => {
    const classNodePin: AnnotationPin = {
      id: 'pin-2',
      label: 1,
      comment: 'Wrong visibility',
      type: 'error',
      anchor: { kind: 'class-node', nodeId: 'class-1' },
    };
    const classEdgePin: AnnotationPin = {
      id: 'pin-3',
      label: 2,
      comment: 'Should be aggregation',
      type: 'improvement',
      anchor: { kind: 'class-edge', edgeId: 'edge-1' },
    };
    const lifelinePin: AnnotationPin = {
      id: 'pin-4',
      label: 3,
      comment: 'Missing actor',
      type: 'error',
      anchor: { kind: 'sequence-lifeline', lifelineId: 'l1' },
    };
    const messagePin: AnnotationPin = {
      id: 'pin-5',
      label: 4,
      comment: 'Out of order',
      type: 'improvement',
      anchor: { kind: 'sequence-message', messageId: 'm1' },
    };
    expect(classNodePin.anchor.kind).toBe('class-node');
    expect(classEdgePin.anchor.kind).toBe('class-edge');
    expect(lifelinePin.anchor.kind).toBe('sequence-lifeline');
    expect(messagePin.anchor.kind).toBe('sequence-message');
  });

  it('round-trips a mixed list through JSON serialization', () => {
    const annotations: AnnotationPin[] = [
      {
        id: 'pin-1',
        label: 1,
        comment: 'Missing relationship',
        type: 'error',
        anchor: { kind: 'free', x: 10, y: 20 },
      },
      {
        id: 'pin-2',
        label: 2,
        comment: 'Good naming',
        type: 'good',
        anchor: { kind: 'class-node', nodeId: 'class-book' },
      },
    ];

    const feedbackJson = JSON.stringify({ text: 'Overall feedback', annotations });
    const parsed = JSON.parse(feedbackJson);
    const recovered = normalizeAnnotationPins(parsed.annotations);

    expect(parsed.text).toBe('Overall feedback');
    expect(recovered).toHaveLength(2);
    expect(recovered[0].anchor.kind).toBe('free');
    expect(recovered[1].anchor.kind).toBe('class-node');
  });
});

describe('B3: UML Annotation — Legacy migration', () => {
  it('migrates legacy {x, y} pins into free-anchored pins', () => {
    const legacy = { x: 12.5, y: 67.8, label: 3, comment: 'Old pin', type: 'good' };
    const pin = normalizeAnnotationPin(legacy, 9);
    expect(pin).not.toBeNull();
    if (!pin) throw new Error('expected pin');
    expect(pin.anchor.kind).toBe('free');
    if (pin.anchor.kind === 'free') {
      expect(pin.anchor.x).toBe(12.5);
      expect(pin.anchor.y).toBe(67.8);
    }
    expect(pin.label).toBe(3);
    expect(pin.comment).toBe('Old pin');
    expect(pin.type).toBe('good');
    expect(typeof pin.id).toBe('string');
    expect(pin.id.length).toBeGreaterThan(0);
  });

  it('preserves new-format pins as-is when normalized', () => {
    const pin = normalizeAnnotationPin(
      {
        id: 'pin-7',
        label: 1,
        comment: 'Anchored',
        type: 'error',
        anchor: { kind: 'class-edge', edgeId: 'edge-42' },
      },
      999
    );
    expect(pin?.id).toBe('pin-7');
    expect(pin?.label).toBe(1);
    expect(pin?.anchor).toEqual({ kind: 'class-edge', edgeId: 'edge-42' });
  });

  it('drops malformed pins (no anchor and no x/y)', () => {
    expect(normalizeAnnotationPin({ label: 1, comment: 'no coords' }, 1)).toBeNull();
    expect(normalizeAnnotationPin(null, 1)).toBeNull();
    expect(normalizeAnnotationPin('garbage', 1)).toBeNull();
  });

  it('coerces unknown pin types to "error"', () => {
    const pin = normalizeAnnotationPin(
      { x: 1, y: 1, label: 1, comment: '', type: 'wat' },
      1
    );
    expect(pin?.type).toBe('error');
  });

  it('normalizeAnnotationPins is tolerant to bad input', () => {
    expect(normalizeAnnotationPins(null)).toEqual([]);
    expect(normalizeAnnotationPins('garbage')).toEqual([]);
    expect(normalizeAnnotationPins([null, { x: 1, y: 2, label: 1, type: 'good' }])).toHaveLength(1);
  });
});
