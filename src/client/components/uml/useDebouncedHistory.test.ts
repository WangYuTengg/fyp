// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useDebouncedHistory } from './useDebouncedHistory';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const buildHarness = <T>(initial: T) => {
  return renderHook(() => {
    const [state, setState] = useState<T>(initial);
    const handle = useDebouncedHistory(state, {
      applyState: setState,
      debounceMs: 100,
    });
    return { state, setState, ...handle };
  });
};

describe('useDebouncedHistory', () => {
  it('starts with no undo or redo available', () => {
    const { result } = buildHarness({ count: 0 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('commits a snapshot after the debounce window elapses', () => {
    const { result } = buildHarness({ count: 0 });
    act(() => {
      result.current.setState({ count: 1 });
    });
    expect(result.current.canUndo).toBe(false); // not yet committed
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('debounces successive edits into a single snapshot', () => {
    const { result } = buildHarness({ count: 0 });
    act(() => {
      result.current.setState({ count: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      result.current.setState({ count: 2 });
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      result.current.setState({ count: 3 });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    // Only one snapshot of the original state should be on the stack.
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
  });

  it('undoes and redoes through multiple discrete commits', () => {
    const { result } = buildHarness({ count: 0 });

    act(() => {
      result.current.setState({ count: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.setState({ count: 2 });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.setState({ count: 3 });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.state).toEqual({ count: 3 });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toEqual({ count: 2 });
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toEqual({ count: 1 });
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toEqual({ count: 1 });
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toEqual({ count: 2 });
    expect(result.current.canRedo).toBe(true);
  });

  it('clears the redo stack on a fresh edit after an undo', () => {
    const { result } = buildHarness({ value: 'a' });
    act(() => {
      result.current.setState({ value: 'b' });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.setState({ value: 'c' });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.setState({ value: 'd' });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.canRedo).toBe(false);
  });

  it('does not commit a snapshot when the serialized state is unchanged', () => {
    const { result } = buildHarness({ count: 0 });
    act(() => {
      result.current.setState({ count: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.canUndo).toBe(false);
  });
});
