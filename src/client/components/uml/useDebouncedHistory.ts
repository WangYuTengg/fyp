import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_STACK_LIMIT = 50;

type DebouncedHistoryHandle = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

type Options<T> = {
  /** Called when undo/redo restores a previous snapshot. Caller applies it to UI state. */
  applyState: (state: T) => void;
  /** Stable serializer used to detect meaningful changes. Defaults to JSON.stringify. */
  serialize?: (state: T) => string;
  /** ms to wait after the last change before committing a snapshot. */
  debounceMs?: number;
  /** Maximum entries kept in the undo stack. Older snapshots are dropped. */
  stackLimit?: number;
};

/**
 * Debounced undo/redo over a state value.
 *
 * The hook does not own the state — it observes the caller's state and pushes a
 * snapshot when the value has been stable for `debounceMs`. That avoids
 * recording every keystroke as its own undo entry, while still capturing
 * discrete actions cleanly.
 *
 * On undo/redo, the hook calls `applyState` so the caller can write the
 * restored value back into their state. A guard skips the next observation so
 * the restored state isn't immediately re-pushed.
 */
export function useDebouncedHistory<T>(
  currentState: T,
  { applyState, serialize, debounceMs = DEFAULT_DEBOUNCE_MS, stackLimit = DEFAULT_STACK_LIMIT }: Options<T>
): DebouncedHistoryHandle {
  const serializerRef = useRef<(value: T) => string>(
    serialize ?? ((value: T) => JSON.stringify(value))
  );
  useEffect(() => {
    serializerRef.current = serialize ?? ((value: T) => JSON.stringify(value));
  }, [serialize]);

  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);
  const lastCommitted = useRef<T>(currentState);
  const lastCommittedSerialized = useRef<string | undefined>(undefined);
  const isApplyingRef = useRef(false);
  const [stackSizes, setStackSizes] = useState({ undo: 0, redo: 0 });

  // Initialize the serialized baseline once on mount (lazily, in an effect, so
  // we never read refs during render).
  useEffect(() => {
    if (lastCommittedSerialized.current === undefined) {
      lastCommittedSerialized.current = serializerRef.current(lastCommitted.current);
    }
  }, []);

  const refreshStackSizes = useCallback(() => {
    setStackSizes({ undo: undoStack.current.length, redo: redoStack.current.length });
  }, []);

  useEffect(() => {
    if (isApplyingRef.current) {
      isApplyingRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const currentSerialized = serializerRef.current(currentState);
      const baseline = lastCommittedSerialized.current ?? serializerRef.current(lastCommitted.current);
      if (currentSerialized === baseline) {
        lastCommittedSerialized.current = baseline;
        return;
      }

      undoStack.current.push(lastCommitted.current);
      if (undoStack.current.length > stackLimit) {
        undoStack.current.shift();
      }
      redoStack.current = [];
      lastCommitted.current = currentState;
      lastCommittedSerialized.current = currentSerialized;
      refreshStackSizes();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [currentState, debounceMs, stackLimit, refreshStackSizes]);

  const undo = useCallback(() => {
    const target = undoStack.current.pop();
    if (target === undefined) return;
    redoStack.current.push(lastCommitted.current);
    lastCommitted.current = target;
    lastCommittedSerialized.current = serializerRef.current(target);
    isApplyingRef.current = true;
    applyState(target);
    refreshStackSizes();
  }, [applyState, refreshStackSizes]);

  const redo = useCallback(() => {
    const target = redoStack.current.pop();
    if (target === undefined) return;
    undoStack.current.push(lastCommitted.current);
    lastCommitted.current = target;
    lastCommittedSerialized.current = serializerRef.current(target);
    isApplyingRef.current = true;
    applyState(target);
    refreshStackSizes();
  }, [applyState, refreshStackSizes]);

  return {
    undo,
    redo,
    canUndo: stackSizes.undo > 0,
    canRedo: stackSizes.redo > 0,
  };
}

/**
 * Bind Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Ctrl+Y) to undo / redo, scoped to a
 * container element so multiple editors on the same page don't all react.
 */
export function useUndoRedoHotkeys(
  containerRef: React.RefObject<HTMLElement | null>,
  handle: DebouncedHistoryHandle,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      const container = containerRef.current;
      const active = document.activeElement;
      if (container && active && !container.contains(active)) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        if (!handle.canUndo) return;
        event.preventDefault();
        handle.undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (!handle.canRedo) return;
        event.preventDefault();
        handle.redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [containerRef, enabled, handle]);
}
