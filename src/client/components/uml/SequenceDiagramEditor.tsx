import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SEQUENCE_DIAGRAM_STATE,
  generateSequenceDiagramPlantUml,
  generateSequenceId,
  LIFELINE_KIND_OPTIONS,
  MESSAGE_TYPE_OPTIONS,
  normalizeSequenceDiagramState,
  type LifelineKind,
  type SequenceDiagramState,
  type SequenceLifeline,
  type SequenceMessage,
  type SequenceMessageType,
} from './sequenceDiagram';

type SequenceDiagramEditorProps = {
  initialState?: SequenceDiagramState;
  onChange?: (state: SequenceDiagramState, plantUml: string) => void;
  readOnly?: boolean;
  height?: string;
};

const LIFELINE_KIND_BADGE: Record<LifelineKind, string> = {
  actor: 'bg-amber-100 text-amber-800 border-amber-200',
  participant: 'bg-slate-100 text-slate-700 border-slate-200',
  database: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  control: 'bg-violet-100 text-violet-800 border-violet-200',
  boundary: 'bg-sky-100 text-sky-800 border-sky-200',
  entity: 'bg-rose-100 text-rose-800 border-rose-200',
};

const MESSAGE_TYPE_LABEL: Record<SequenceMessageType, string> = {
  sync: '→',
  async: '⇢',
  reply: '⤺',
};

export function SequenceDiagramEditor({
  initialState,
  onChange,
  readOnly = false,
  height = '420px',
}: SequenceDiagramEditorProps) {
  const [state, setState] = useState<SequenceDiagramState>(() =>
    normalizeSequenceDiagramState(initialState ?? DEFAULT_SEQUENCE_DIAGRAM_STATE)
  );
  const [selectedLifelineId, setSelectedLifelineId] = useState<string | null>(null);
  const hasMountedRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    onChangeRef.current?.(state, generateSequenceDiagramPlantUml(state));
  }, [state]);

  const reorderLifelines = (lifelines: SequenceLifeline[]): SequenceLifeline[] =>
    lifelines.map((l, idx) => ({ ...l, data: { ...l.data, order: idx } }));

  const reorderMessages = (messages: SequenceMessage[]): SequenceMessage[] =>
    messages.map((m, idx) => ({ ...m, data: { ...m.data, order: idx } }));

  const addLifeline = () => {
    if (readOnly) return;
    const newLifeline: SequenceLifeline = {
      id: generateSequenceId('lifeline'),
      data: {
        name: `Participant${state.lifelines.length + 1}`,
        kind: 'participant',
        order: state.lifelines.length,
      },
    };
    setState((prev) => ({ ...prev, lifelines: [...prev.lifelines, newLifeline] }));
  };

  const removeLifeline = (id: string) => {
    if (readOnly) return;
    setState((prev) => ({
      lifelines: reorderLifelines(prev.lifelines.filter((l) => l.id !== id)),
      messages: reorderMessages(prev.messages.filter((m) => m.source !== id && m.target !== id)),
    }));
    if (selectedLifelineId === id) setSelectedLifelineId(null);
  };

  const updateLifeline = (id: string, patch: Partial<SequenceLifeline['data']>) => {
    if (readOnly) return;
    setState((prev) => ({
      ...prev,
      lifelines: prev.lifelines.map((l) =>
        l.id === id ? { ...l, data: { ...l.data, ...patch } } : l
      ),
    }));
  };

  const moveLifeline = (id: string, direction: -1 | 1) => {
    if (readOnly) return;
    setState((prev) => {
      const list = [...prev.lifelines].sort((a, b) => a.data.order - b.data.order);
      const idx = list.findIndex((l) => l.id === id);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= list.length) return prev;
      const swapped = [...list];
      [swapped[idx], swapped[targetIdx]] = [swapped[targetIdx], swapped[idx]];
      return { ...prev, lifelines: reorderLifelines(swapped) };
    });
  };

  const addMessage = () => {
    if (readOnly) return;
    if (state.lifelines.length === 0) return;
    const defaultSource = state.lifelines[0].id;
    const defaultTarget = state.lifelines[Math.min(1, state.lifelines.length - 1)].id;
    const newMessage: SequenceMessage = {
      id: generateSequenceId('message'),
      source: defaultSource,
      target: defaultTarget,
      data: {
        messageType: 'sync',
        label: '',
        order: state.messages.length,
      },
    };
    setState((prev) => ({ ...prev, messages: [...prev.messages, newMessage] }));
  };

  const removeMessage = (id: string) => {
    if (readOnly) return;
    setState((prev) => ({
      ...prev,
      messages: reorderMessages(prev.messages.filter((m) => m.id !== id)),
    }));
  };

  const updateMessage = (
    id: string,
    patch: Partial<SequenceMessage['data']> & { source?: string; target?: string }
  ) => {
    if (readOnly) return;
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => {
        if (m.id !== id) return m;
        const { source, target, ...dataPatch } = patch;
        return {
          ...m,
          source: source ?? m.source,
          target: target ?? m.target,
          data: { ...m.data, ...dataPatch },
        };
      }),
    }));
  };

  const moveMessage = (id: string, direction: -1 | 1) => {
    if (readOnly) return;
    setState((prev) => {
      const list = [...prev.messages].sort((a, b) => a.data.order - b.data.order);
      const idx = list.findIndex((m) => m.id === id);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= list.length) return prev;
      const swapped = [...list];
      [swapped[idx], swapped[targetIdx]] = [swapped[targetIdx], swapped[idx]];
      return { ...prev, messages: reorderMessages(swapped) };
    });
  };

  const sortedLifelines = [...state.lifelines].sort((a, b) => a.data.order - b.data.order);
  const sortedMessages = [...state.messages].sort((a, b) => a.data.order - b.data.order);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sequence diagram</h3>
          <p className="mt-1 text-xs text-slate-500">
            {readOnly
              ? 'Inspect lifelines and messages.'
              : 'Add lifelines (left-to-right), then sequence messages (top-to-bottom). Self-messages are allowed.'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2" style={{ minHeight: height }}>
        <section className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <header className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              Lifelines ({sortedLifelines.length})
            </h4>
            {!readOnly && (
              <button
                type="button"
                onClick={addLifeline}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                + Lifeline
              </button>
            )}
          </header>
          <p className="mt-1 text-xs text-slate-500">Order determines left-to-right placement.</p>

          {sortedLifelines.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
              Add a lifeline to start.
            </p>
          ) : (
            <ol className="mt-4 space-y-2">
              {sortedLifelines.map((lifeline, idx) => (
                <li
                  key={lifeline.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    selectedLifelineId === lifeline.id
                      ? 'border-blue-300 bg-blue-50/60'
                      : 'border-slate-200 bg-white'
                  }`}
                  onClick={() =>
                    setSelectedLifelineId(selectedLifelineId === lifeline.id ? null : lifeline.id)
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        LIFELINE_KIND_BADGE[lifeline.data.kind]
                      }`}
                    >
                      {lifeline.data.kind}
                    </span>
                    <input
                      type="text"
                      value={lifeline.data.name}
                      onChange={(event) => updateLifeline(lifeline.id, { name: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                      readOnly={readOnly}
                      placeholder="Name"
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={lifeline.data.kind}
                      onChange={(event) =>
                        updateLifeline(lifeline.id, { kind: event.target.value as LifelineKind })
                      }
                      onClick={(event) => event.stopPropagation()}
                      disabled={readOnly}
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
                    >
                      {LIFELINE_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {!readOnly && (
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveLifeline(lifeline.id, -1);
                          }}
                          disabled={idx === 0}
                          aria-label="Move left"
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveLifeline(lifeline.id, 1);
                          }}
                          disabled={idx === sortedLifelines.length - 1}
                          aria-label="Move right"
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeLifeline(lifeline.id);
                          }}
                          aria-label="Remove lifeline"
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="p-4">
          <header className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              Messages ({sortedMessages.length})
            </h4>
            {!readOnly && (
              <button
                type="button"
                onClick={addMessage}
                disabled={sortedLifelines.length === 0}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                + Message
              </button>
            )}
          </header>
          <p className="mt-1 text-xs text-slate-500">
            Order determines top-to-bottom flow. Self-messages allowed when source = target.
          </p>

          {sortedMessages.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
              {sortedLifelines.length === 0
                ? 'Add lifelines first.'
                : 'Add a message to define the sequence.'}
            </p>
          ) : (
            <ol className="mt-4 space-y-2">
              {sortedMessages.map((message, idx) => (
                <li key={message.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
                      {idx + 1}
                    </span>
                    <select
                      value={message.source}
                      onChange={(event) => updateMessage(message.id, { source: event.target.value })}
                      disabled={readOnly}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                      aria-label="Source lifeline"
                    >
                      {sortedLifelines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.data.name || '(unnamed)'}
                        </option>
                      ))}
                    </select>
                    <select
                      value={message.data.messageType}
                      onChange={(event) =>
                        updateMessage(message.id, {
                          messageType: event.target.value as SequenceMessageType,
                        })
                      }
                      disabled={readOnly}
                      title="Message type"
                      className="rounded border border-slate-300 px-2 py-1 font-mono disabled:bg-slate-100"
                      aria-label="Message type"
                    >
                      {MESSAGE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {MESSAGE_TYPE_LABEL[option.value]} {option.label.replace(/\s*\(.+\)$/, '')}
                        </option>
                      ))}
                    </select>
                    <select
                      value={message.target}
                      onChange={(event) => updateMessage(message.id, { target: event.target.value })}
                      disabled={readOnly}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                      aria-label="Target lifeline"
                    >
                      {sortedLifelines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.data.name || '(unnamed)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={message.data.label ?? ''}
                      onChange={(event) =>
                        updateMessage(message.id, { label: event.target.value || undefined })
                      }
                      readOnly={readOnly}
                      placeholder="Label (optional)"
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
                    />
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveMessage(message.id, -1)}
                          disabled={idx === 0}
                          aria-label="Move up"
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMessage(message.id, 1)}
                          disabled={idx === sortedMessages.length - 1}
                          aria-label="Move down"
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMessage(message.id)}
                          aria-label="Remove message"
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
