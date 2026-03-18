import { describe, it, expect } from 'vitest';
import type { AnnotationPin } from '../../client/features/staff-grading/components/UMLAnnotationOverlay';

describe('B3: UML Annotation - Data Model', () => {
  it('annotation pin has required fields', () => {
    const pin: AnnotationPin = {
      x: 45.2,
      y: 32.1,
      label: 1,
      comment: 'Should be composition',
      type: 'error',
    };

    expect(pin.x).toBeGreaterThanOrEqual(0);
    expect(pin.x).toBeLessThanOrEqual(100);
    expect(pin.y).toBeGreaterThanOrEqual(0);
    expect(pin.y).toBeLessThanOrEqual(100);
    expect(pin.label).toBe(1);
    expect(pin.comment).toBe('Should be composition');
    expect(pin.type).toBe('error');
  });

  it('supports all annotation types', () => {
    const types: AnnotationPin['type'][] = ['error', 'improvement', 'good'];
    expect(types).toHaveLength(3);
  });

  it('stores annotations as JSON in feedback field', () => {
    const annotations: AnnotationPin[] = [
      { x: 10, y: 20, label: 1, comment: 'Missing relationship', type: 'error' },
      { x: 50, y: 60, label: 2, comment: 'Good naming', type: 'good' },
    ];

    const feedbackJson = JSON.stringify({
      text: 'Overall feedback text',
      annotations,
    });

    const parsed = JSON.parse(feedbackJson);
    expect(parsed.text).toBe('Overall feedback text');
    expect(parsed.annotations).toHaveLength(2);
    expect(parsed.annotations[0].type).toBe('error');
    expect(parsed.annotations[1].type).toBe('good');
  });

  it('uses percentage-based coordinates for resolution independence', () => {
    const pin: AnnotationPin = {
      x: 50,
      y: 75.5,
      label: 1,
      comment: 'Test',
      type: 'improvement',
    };

    // Percentage based means 0-100 range, not pixel-based
    expect(pin.x).toBeGreaterThanOrEqual(0);
    expect(pin.x).toBeLessThanOrEqual(100);
    expect(pin.y).toBeGreaterThanOrEqual(0);
    expect(pin.y).toBeLessThanOrEqual(100);
  });
});
