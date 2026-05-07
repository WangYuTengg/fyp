import { useCallback, useMemo, useRef, useState } from 'react';
import type { UmlEditorState } from '../../../components/UMLEditor';
import type { ClassDiagramState } from '../../../components/uml/classDiagram';
import type { SequenceDiagramState } from '../../../components/uml/sequenceDiagram';
import {
  generateAnnotationPinId,
  type AnnotationAnchor,
  type AnnotationPin,
} from './annotation-pin-types';

const PIN_TYPES: ReadonlyArray<AnnotationPin['type']> = ['error', 'improvement', 'good'];

type ElementOption = {
  anchor: AnnotationAnchor;
  label: string;
  group: string;
};

const isClassDiagramState = (state: UmlEditorState): state is ClassDiagramState =>
  'nodes' in state && Array.isArray((state as ClassDiagramState).nodes);

const isSequenceDiagramState = (state: UmlEditorState): state is SequenceDiagramState =>
  'lifelines' in state && Array.isArray((state as SequenceDiagramState).lifelines);

const buildElementOptions = (state: UmlEditorState | undefined): ElementOption[] => {
  if (!state) return [];
  if (isClassDiagramState(state)) {
    const nameById = new Map(state.nodes.map((n) => [n.id, n.data.name || '(unnamed)']));
    return [
      ...state.nodes.map((node) => ({
        anchor: { kind: 'class-node' as const, nodeId: node.id },
        label: node.data.name || '(unnamed class)',
        group: 'Classes',
      })),
      ...state.edges.map((edge) => ({
        anchor: { kind: 'class-edge' as const, edgeId: edge.id },
        label: `${nameById.get(edge.source) ?? edge.source} → ${nameById.get(edge.target) ?? edge.target} (${edge.data.relationship})`,
        group: 'Relationships',
      })),
    ];
  }
  if (isSequenceDiagramState(state)) {
    const nameById = new Map(state.lifelines.map((l) => [l.id, l.data.name || '(unnamed)']));
    return [
      ...state.lifelines.map((lifeline) => ({
        anchor: { kind: 'sequence-lifeline' as const, lifelineId: lifeline.id },
        label: `${lifeline.data.name || '(unnamed lifeline)'} [${lifeline.data.kind}]`,
        group: 'Lifelines',
      })),
      ...state.messages.map((message) => ({
        anchor: { kind: 'sequence-message' as const, messageId: message.id },
        label: `${message.data.order + 1}. ${nameById.get(message.source) ?? '?'} → ${nameById.get(message.target) ?? '?'}${message.data.label ? ` : ${message.data.label}` : ''}`,
        group: 'Messages',
      })),
    ];
  }
  return [];
};

const describeAnchor = (
  anchor: AnnotationAnchor,
  state: UmlEditorState | undefined
): string => {
  if (anchor.kind === 'free') return `Free pin (${anchor.x.toFixed(1)}%, ${anchor.y.toFixed(1)}%)`;
  if (!state) return 'Anchored element';
  if (isClassDiagramState(state)) {
    if (anchor.kind === 'class-node') {
      const node = state.nodes.find((n) => n.id === anchor.nodeId);
      return node ? `Class: ${node.data.name || '(unnamed)'}` : 'Class (missing)';
    }
    if (anchor.kind === 'class-edge') {
      const edge = state.edges.find((e) => e.id === anchor.edgeId);
      if (!edge) return 'Relationship (missing)';
      const sourceName = state.nodes.find((n) => n.id === edge.source)?.data.name ?? edge.source;
      const targetName = state.nodes.find((n) => n.id === edge.target)?.data.name ?? edge.target;
      return `Relationship: ${sourceName} → ${targetName}`;
    }
  }
  if (isSequenceDiagramState(state)) {
    if (anchor.kind === 'sequence-lifeline') {
      const lifeline = state.lifelines.find((l) => l.id === anchor.lifelineId);
      return lifeline ? `Lifeline: ${lifeline.data.name || '(unnamed)'}` : 'Lifeline (missing)';
    }
    if (anchor.kind === 'sequence-message') {
      const message = state.messages.find((m) => m.id === anchor.messageId);
      if (!message) return 'Message (missing)';
      const sourceName = state.lifelines.find((l) => l.id === message.source)?.data.name ?? '?';
      const targetName = state.lifelines.find((l) => l.id === message.target)?.data.name ?? '?';
      return `Message: ${sourceName} → ${targetName}${message.data.label ? ` (${message.data.label})` : ''}`;
    }
  }
  return 'Anchored element';
};

const PIN_COLORS = {
  error: { bg: 'bg-red-500', ring: 'ring-red-300', text: 'text-white' },
  improvement: { bg: 'bg-yellow-500', ring: 'ring-yellow-300', text: 'text-white' },
  good: { bg: 'bg-green-500', ring: 'ring-green-300', text: 'text-white' },
} as const;

const TYPE_BADGE_CLASS: Record<AnnotationPin['type'], string> = {
  error: 'bg-red-100 text-red-700',
  improvement: 'bg-yellow-100 text-yellow-700',
  good: 'bg-green-100 text-green-700',
};

type UMLAnnotationOverlayProps = {
  annotations: AnnotationPin[];
  onAnnotationsChange?: (annotations: AnnotationPin[]) => void;
  readOnly?: boolean;
  /** Student's diagram structure. Enables element-anchored pins. */
  editorState?: UmlEditorState;
};

export function UMLAnnotationOverlay({
  annotations,
  onAnnotationsChange,
  readOnly = false,
  editorState,
}: UMLAnnotationOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState('');
  const [editingType, setEditingType] = useState<AnnotationPin['type']>('error');
  const [pendingAnchor, setPendingAnchor] = useState<AnnotationAnchor | null>(null);

  const elementOptions = useMemo(() => buildElementOptions(editorState), [editorState]);
  const optionsByGroup = useMemo(() => {
    const groups = new Map<string, ElementOption[]>();
    for (const option of elementOptions) {
      const list = groups.get(option.group) ?? [];
      list.push(option);
      groups.set(option.group, list);
    }
    return groups;
  }, [elementOptions]);

  const freePins = useMemo(
    () => annotations.filter((pin) => pin.anchor.kind === 'free'),
    [annotations]
  );
  const elementPins = useMemo(
    () => annotations.filter((pin) => pin.anchor.kind !== 'free'),
    [annotations]
  );

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || !overlayRef.current) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-annotation-pin]')) return;

      const rect = overlayRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      setPendingAnchor({ kind: 'free', x, y });
      setEditingComment('');
      setEditingType('error');
      setSelectedPin(null);
    },
    [readOnly]
  );

  const commitPendingPin = useCallback(() => {
    if (!pendingAnchor || !onAnnotationsChange) return;
    const newPin: AnnotationPin = {
      id: generateAnnotationPinId(),
      label: annotations.length + 1,
      comment: editingComment,
      type: editingType,
      anchor: pendingAnchor,
    };
    onAnnotationsChange(
      [...annotations, newPin].map((pin, idx) => ({ ...pin, label: idx + 1 }))
    );
    setPendingAnchor(null);
    setEditingComment('');
  }, [pendingAnchor, onAnnotationsChange, annotations, editingComment, editingType]);

  const handleRemovePin = useCallback(
    (id: string) => {
      if (!onAnnotationsChange) return;
      const updated = annotations
        .filter((pin) => pin.id !== id)
        .map((pin, idx) => ({ ...pin, label: idx + 1 }));
      onAnnotationsChange(updated);
      setSelectedPin(null);
    },
    [annotations, onAnnotationsChange]
  );

  const handlePinClick = useCallback(
    (id: string, event: React.MouseEvent) => {
      event.stopPropagation();
      setSelectedPin(selectedPin === id ? null : id);
      setPendingAnchor(null);
    },
    [selectedPin]
  );

  const startElementAnchor = (anchor: AnnotationAnchor) => {
    setPendingAnchor(anchor);
    setEditingComment('');
    setEditingType('error');
    setSelectedPin(null);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={overlayRef}
          className={`absolute inset-0 z-10 ${readOnly ? '' : 'cursor-crosshair'}`}
          onClick={handleOverlayClick}
        >
          {freePins.map((pin) => {
            if (pin.anchor.kind !== 'free') return null;
            const colors = PIN_COLORS[pin.type];
            return (
              <div
                key={pin.id}
                data-annotation-pin
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ left: `${pin.anchor.x}%`, top: `${pin.anchor.y}%` }}
              >
                <button
                  type="button"
                  onClick={(event) => handlePinClick(pin.id, event)}
                  className={`w-6 h-6 rounded-full ${colors.bg} ${colors.text} ring-2 ${colors.ring} text-xs font-bold flex items-center justify-center shadow-md hover:scale-110 transition-transform`}
                  title={pin.comment}
                >
                  {pin.label}
                </button>
                {selectedPin === pin.id ? (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-48 z-30">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE_CLASS[pin.type]}`}>
                        {pin.type}
                      </span>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemovePin(pin.id);
                          }}
                          className="text-gray-400 hover:text-red-500 text-xs"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-700">{pin.comment || 'No comment'}</p>
                  </div>
                ) : null}
              </div>
            );
          })}

          {pendingAnchor && pendingAnchor.kind === 'free' ? (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${pendingAnchor.x}%`, top: `${pendingAnchor.y}%` }}
            >
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white ring-2 ring-blue-300 text-xs font-bold flex items-center justify-center animate-pulse">
                ?
              </div>
            </div>
          ) : null}
        </div>

        {pendingAnchor && !readOnly ? (
          <div className="absolute bottom-2 left-2 right-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-30">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Add Annotation —{' '}
              <span className="text-gray-500">{describeAnchor(pendingAnchor, editorState)}</span>
            </div>
            <div className="flex gap-2 mb-2">
              {PIN_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingType(type);
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    editingType === type
                      ? type === 'error'
                        ? 'bg-red-100 border-red-300 text-red-700'
                        : type === 'improvement'
                          ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                          : 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={editingComment}
                onChange={(event) => setEditingComment(event.target.value)}
                placeholder="Comment..."
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitPendingPin();
                  }
                  if (event.key === 'Escape') {
                    setPendingAnchor(null);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  commitPendingPin();
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPendingAnchor(null);
                }}
                className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!readOnly && elementOptions.length > 0 ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
            + Anchor pin to element ({elementOptions.length} available)
          </summary>
          <div className="mt-2 space-y-2">
            {[...optionsByGroup.entries()].map(([group, options]) => (
              <div key={group}>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{group}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {options.map((option, idx) => (
                    <button
                      key={`${group}-${idx}`}
                      type="button"
                      onClick={() => startElementAnchor(option.anchor)}
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {elementPins.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
            Element-anchored pins ({elementPins.length})
          </p>
          <ul className="divide-y divide-slate-100">
            {elementPins.map((pin) => {
              const colors = PIN_COLORS[pin.type];
              return (
                <li key={pin.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${colors.bg} ${colors.text} text-[11px] font-bold`}
                  >
                    {pin.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE_CLASS[pin.type]}`}>
                        {pin.type}
                      </span>
                      <span className="truncate text-xs text-slate-600">
                        {describeAnchor(pin.anchor, editorState)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{pin.comment || 'No comment'}</p>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => handleRemovePin(pin.id)}
                      className="text-xs text-rose-600 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Annotation sidebar — shows every pin with its anchor description.
 */
export function AnnotationSidebar({
  annotations,
  selectedPin,
  onSelectPin,
  editorState,
}: {
  annotations: AnnotationPin[];
  selectedPin: string | null;
  onSelectPin: (id: string | null) => void;
  editorState?: UmlEditorState;
}) {
  if (annotations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Annotations ({annotations.length})</h4>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {annotations.map((pin) => {
          const colors = PIN_COLORS[pin.type];
          return (
            <button
              key={pin.id}
              type="button"
              onClick={() => onSelectPin(selectedPin === pin.id ? null : pin.id)}
              className={`w-full text-left flex items-start gap-2 p-2 rounded border transition-colors ${
                selectedPin === pin.id
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full ${colors.bg} ${colors.text} text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}
              >
                {pin.label}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-sm text-gray-700 line-clamp-2">{pin.comment || 'No comment'}</span>
                <span className={`text-xs ${
                  pin.type === 'error'
                    ? 'text-red-500'
                    : pin.type === 'improvement'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                }`}
                >
                  {pin.type} · {describeAnchor(pin.anchor, editorState)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
