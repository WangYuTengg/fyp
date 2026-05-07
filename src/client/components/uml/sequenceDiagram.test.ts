import { describe, expect, it } from 'vitest';
import {
  generateSequenceDiagramPlantUml,
  normalizeSequenceDiagramState,
  type SequenceDiagramState,
} from './sequenceDiagram';

describe('normalizeSequenceDiagramState', () => {
  it('returns empty state for invalid input', () => {
    const empty = { lifelines: [], messages: [], fragments: [] };
    expect(normalizeSequenceDiagramState(null)).toEqual(empty);
    expect(normalizeSequenceDiagramState(undefined)).toEqual(empty);
    expect(normalizeSequenceDiagramState('garbage')).toEqual(empty);
    expect(normalizeSequenceDiagramState({})).toEqual(empty);
  });

  it('preserves valid lifelines and messages', () => {
    const state = {
      lifelines: [
        { id: 'l1', data: { name: 'User', kind: 'actor', order: 0 } },
        { id: 'l2', data: { name: 'System', kind: 'participant', order: 1 } },
      ],
      messages: [
        { id: 'm1', source: 'l1', target: 'l2', data: { messageType: 'sync', label: 'go', order: 0 } },
      ],
    };
    const normalized = normalizeSequenceDiagramState(state);
    expect(normalized.lifelines).toHaveLength(2);
    expect(normalized.messages).toHaveLength(1);
    expect(normalized.lifelines[0].data.name).toBe('User');
    expect(normalized.messages[0].data.label).toBe('go');
  });

  it('drops messages that reference unknown lifelines', () => {
    const state = {
      lifelines: [{ id: 'l1', data: { name: 'A', kind: 'participant', order: 0 } }],
      messages: [
        { id: 'm1', source: 'l1', target: 'l1', data: { messageType: 'sync', order: 0 } },
        { id: 'm2', source: 'l1', target: 'lX', data: { messageType: 'sync', order: 1 } },
      ],
    };
    const normalized = normalizeSequenceDiagramState(state);
    expect(normalized.messages).toHaveLength(1);
    expect(normalized.messages[0].id).toBe('m1');
  });

  it('coerces unknown kind to participant and unknown messageType to sync', () => {
    const state = {
      lifelines: [{ id: 'l1', data: { name: 'A', kind: 'goblin', order: 0 } }],
      messages: [
        { id: 'm1', source: 'l1', target: 'l1', data: { messageType: 'unknown', order: 0 } },
      ],
    };
    const normalized = normalizeSequenceDiagramState(state);
    expect(normalized.lifelines[0].data.kind).toBe('participant');
    expect(normalized.messages[0].data.messageType).toBe('sync');
  });

  it('sorts lifelines and messages by their order field', () => {
    const state = {
      lifelines: [
        { id: 'l1', data: { name: 'A', kind: 'participant', order: 2 } },
        { id: 'l2', data: { name: 'B', kind: 'participant', order: 0 } },
        { id: 'l3', data: { name: 'C', kind: 'participant', order: 1 } },
      ],
      messages: [
        { id: 'm1', source: 'l1', target: 'l2', data: { messageType: 'sync', order: 5 } },
        { id: 'm2', source: 'l2', target: 'l3', data: { messageType: 'sync', order: 1 } },
      ],
    };
    const normalized = normalizeSequenceDiagramState(state);
    expect(normalized.lifelines.map((l) => l.id)).toEqual(['l2', 'l3', 'l1']);
    expect(normalized.messages.map((m) => m.id)).toEqual(['m2', 'm1']);
  });
});

describe('generateSequenceDiagramPlantUml', () => {
  const baseState = (overrides: Partial<SequenceDiagramState> = {}): SequenceDiagramState => ({
    lifelines: [],
    messages: [],
    ...overrides,
  });

  it('emits empty diagram for empty state', () => {
    expect(generateSequenceDiagramPlantUml(baseState())).toBe('@startuml\n@enduml');
  });

  it('emits each lifeline kind with the right keyword', () => {
    const state = baseState({
      lifelines: [
        { id: 'a', data: { name: 'User', kind: 'actor', order: 0 } },
        { id: 'b', data: { name: 'Browser', kind: 'participant', order: 1 } },
        { id: 'c', data: { name: 'Cache', kind: 'database', order: 2 } },
        { id: 'd', data: { name: 'Boundary', kind: 'boundary', order: 3 } },
        { id: 'e', data: { name: 'Ctrl', kind: 'control', order: 4 } },
        { id: 'f', data: { name: 'Entity', kind: 'entity', order: 5 } },
      ],
    });
    const out = generateSequenceDiagramPlantUml(state);
    expect(out).toContain('actor User');
    expect(out).toContain('participant Browser');
    expect(out).toContain('database Cache');
    expect(out).toContain('boundary Boundary');
    expect(out).toContain('control Ctrl');
    expect(out).toContain('entity Entity');
  });

  it('quotes display names with spaces and aliases them', () => {
    const state = baseState({
      lifelines: [
        { id: 'l1', data: { name: 'Web Server', kind: 'participant', order: 0 } },
      ],
    });
    const out = generateSequenceDiagramPlantUml(state);
    expect(out).toMatch(/participant "Web Server" as P\d+/);
  });

  it('emits sync, async, and reply arrows', () => {
    const state = baseState({
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      messages: [
        { id: 'm1', source: 'a', target: 'b', data: { messageType: 'sync', label: 's', order: 0 } },
        { id: 'm2', source: 'a', target: 'b', data: { messageType: 'async', label: 'a', order: 1 } },
        { id: 'm3', source: 'b', target: 'a', data: { messageType: 'reply', label: 'r', order: 2 } },
      ],
    });
    const out = generateSequenceDiagramPlantUml(state);
    expect(out).toContain('A -> B : s');
    expect(out).toContain('A ->> B : a');
    expect(out).toContain('B --> A : r');
  });

  it('respects message order', () => {
    const state = baseState({
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      messages: [
        { id: 'm1', source: 'a', target: 'b', data: { messageType: 'sync', label: 'second', order: 1 } },
        { id: 'm2', source: 'a', target: 'b', data: { messageType: 'sync', label: 'first', order: 0 } },
      ],
    });
    const lines = generateSequenceDiagramPlantUml(state).split('\n');
    const firstIdx = lines.findIndex((l) => l.includes(': first'));
    const secondIdx = lines.findIndex((l) => l.includes(': second'));
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('emits self-messages', () => {
    const state = baseState({
      lifelines: [{ id: 'a', data: { name: 'Auth', kind: 'control', order: 0 } }],
      messages: [
        { id: 'm1', source: 'a', target: 'a', data: { messageType: 'sync', label: 'verify', order: 0 } },
      ],
    });
    expect(generateSequenceDiagramPlantUml(state)).toContain('Auth -> Auth : verify');
  });

  it('omits the message label when not provided', () => {
    const state = baseState({
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      messages: [{ id: 'm1', source: 'a', target: 'b', data: { messageType: 'sync', order: 0 } }],
    });
    const out = generateSequenceDiagramPlantUml(state);
    expect(out).toContain('A -> B');
    expect(out).not.toContain('A -> B :');
  });

  it('emits activate/deactivate lines following the message', () => {
    const state = baseState({
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      messages: [
        {
          id: 'm1',
          source: 'a',
          target: 'b',
          data: { messageType: 'sync', label: 'do', order: 0, activatesTarget: true },
        },
        {
          id: 'm2',
          source: 'b',
          target: 'a',
          data: { messageType: 'reply', label: 'ok', order: 1, deactivatesSource: true },
        },
      ],
    });
    const out = generateSequenceDiagramPlantUml(state);
    const lines = out.split('\n');
    const doIdx = lines.findIndex((l) => l.includes('A -> B : do'));
    const actIdx = lines.findIndex((l) => l.includes('activate B'));
    const okIdx = lines.findIndex((l) => l.includes('B --> A : ok'));
    const deactIdx = lines.findIndex((l) => l.includes('deactivate B'));
    expect(actIdx).toBe(doIdx + 1);
    expect(deactIdx).toBe(okIdx + 1);
  });
});

describe('generateSequenceDiagramPlantUml — fragments', () => {
  it('emits opt fragment with header label and end marker', () => {
    const state: SequenceDiagramState = {
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      fragments: [
        { id: 'f1', kind: 'opt', data: { order: 0, label: 'logged in' } },
      ],
      messages: [
        {
          id: 'm1',
          source: 'a',
          target: 'b',
          data: {
            messageType: 'sync',
            label: 'inside',
            order: 0,
            parentFragmentId: 'f1',
            parentBranchIndex: 0,
          },
        },
      ],
    };
    const out = generateSequenceDiagramPlantUml(state);
    const lines = out.split('\n');
    const optIdx = lines.findIndex((l) => l.trim() === 'opt logged in');
    const insideIdx = lines.findIndex((l) => l.includes('A -> B : inside'));
    const endIdx = lines.findIndex((l) => l.trim() === 'end');
    expect(optIdx).toBeGreaterThanOrEqual(0);
    expect(insideIdx).toBeGreaterThan(optIdx);
    expect(endIdx).toBeGreaterThan(insideIdx);
  });

  it('emits alt with else branches in order', () => {
    const state: SequenceDiagramState = {
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      fragments: [
        {
          id: 'f1',
          kind: 'alt',
          data: { order: 0, label: 'x > 0', elseLabels: ['x < 0', 'x == 0'] },
        },
      ],
      messages: [
        {
          id: 'm1',
          source: 'a',
          target: 'b',
          data: {
            messageType: 'sync',
            label: 'positive',
            order: 0,
            parentFragmentId: 'f1',
            parentBranchIndex: 0,
          },
        },
        {
          id: 'm2',
          source: 'a',
          target: 'b',
          data: {
            messageType: 'sync',
            label: 'negative',
            order: 0,
            parentFragmentId: 'f1',
            parentBranchIndex: 1,
          },
        },
        {
          id: 'm3',
          source: 'a',
          target: 'b',
          data: {
            messageType: 'sync',
            label: 'zero',
            order: 0,
            parentFragmentId: 'f1',
            parentBranchIndex: 2,
          },
        },
      ],
    };
    const out = generateSequenceDiagramPlantUml(state);
    expect(out).toContain('alt x > 0');
    expect(out).toContain('A -> B : positive');
    expect(out).toContain('else x < 0');
    expect(out).toContain('A -> B : negative');
    expect(out).toContain('else x == 0');
    expect(out).toContain('A -> B : zero');
    expect(out.indexOf('positive')).toBeLessThan(out.indexOf('negative'));
    expect(out.indexOf('negative')).toBeLessThan(out.indexOf('zero'));
  });

  it('interleaves top-level messages with fragments based on order', () => {
    const state: SequenceDiagramState = {
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      fragments: [{ id: 'f1', kind: 'opt', data: { order: 1, label: 'check' } }],
      messages: [
        { id: 'm1', source: 'a', target: 'b', data: { messageType: 'sync', label: 'before', order: 0 } },
        {
          id: 'm2',
          source: 'a',
          target: 'b',
          data: {
            messageType: 'sync',
            label: 'inside',
            order: 0,
            parentFragmentId: 'f1',
            parentBranchIndex: 0,
          },
        },
        { id: 'm3', source: 'a', target: 'b', data: { messageType: 'sync', label: 'after', order: 2 } },
      ],
    };
    const out = generateSequenceDiagramPlantUml(state);
    const idxBefore = out.indexOf(': before');
    const idxOpt = out.indexOf('opt check');
    const idxInside = out.indexOf(': inside');
    const idxEnd = out.indexOf('\nend\n');
    const idxAfter = out.indexOf(': after');
    expect(idxBefore).toBeLessThan(idxOpt);
    expect(idxOpt).toBeLessThan(idxInside);
    expect(idxInside).toBeLessThan(idxEnd);
    expect(idxEnd).toBeLessThan(idxAfter);
  });

  it('drops parentFragmentId on a message when the fragment is missing', () => {
    const state = {
      lifelines: [
        { id: 'a', data: { name: 'A', kind: 'participant', order: 0 } },
        { id: 'b', data: { name: 'B', kind: 'participant', order: 1 } },
      ],
      fragments: [],
      messages: [
        {
          id: 'm1',
          source: 'a',
          target: 'b',
          data: {
            messageType: 'sync',
            label: 'orphan',
            order: 0,
            parentFragmentId: 'gone',
            parentBranchIndex: 1,
          },
        },
      ],
    };
    const normalized = normalizeSequenceDiagramState(state);
    expect(normalized.messages).toHaveLength(1);
    expect(normalized.messages[0].data.parentFragmentId).toBeUndefined();
    expect(normalized.messages[0].data.parentBranchIndex).toBeUndefined();
  });

  it('drops fragments with unknown kinds', () => {
    const state = {
      lifelines: [{ id: 'a', data: { name: 'A', kind: 'participant', order: 0 } }],
      fragments: [
        { id: 'f1', kind: 'opt', data: { order: 0 } },
        { id: 'f2', kind: 'unknown', data: { order: 1 } },
      ],
      messages: [],
    };
    const normalized = normalizeSequenceDiagramState(state);
    expect(normalized.fragments).toHaveLength(1);
    expect(normalized.fragments?.[0].id).toBe('f1');
  });
});
