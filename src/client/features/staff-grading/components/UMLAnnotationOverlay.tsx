import { useCallback, useRef, useState } from 'react';

export type AnnotationPin = {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  label: number;
  comment: string;
  type: 'error' | 'improvement' | 'good';
};

type UMLAnnotationOverlayProps = {
  annotations: AnnotationPin[];
  onAnnotationsChange?: (annotations: AnnotationPin[]) => void;
  readOnly?: boolean;
};

const PIN_COLORS = {
  error: { bg: 'bg-red-500', ring: 'ring-red-300', text: 'text-white' },
  improvement: { bg: 'bg-yellow-500', ring: 'ring-yellow-300', text: 'text-white' },
  good: { bg: 'bg-green-500', ring: 'ring-green-300', text: 'text-white' },
} as const;

export function UMLAnnotationOverlay({
  annotations,
  onAnnotationsChange,
  readOnly = false,
}: UMLAnnotationOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedPin, setSelectedPin] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState('');
  const [editingType, setEditingType] = useState<AnnotationPin['type']>('error');
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || !overlayRef.current) return;

      // Don't place pin if clicking on an existing pin
      const target = event.target as HTMLElement;
      if (target.closest('[data-annotation-pin]')) return;

      const rect = overlayRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      setPendingClick({ x, y });
      setEditingComment('');
      setEditingType('error');
      setSelectedPin(null);
    },
    [readOnly]
  );

  const handleAddPin = useCallback(() => {
    if (!pendingClick || !onAnnotationsChange) return;

    const newPin: AnnotationPin = {
      x: pendingClick.x,
      y: pendingClick.y,
      label: annotations.length + 1,
      comment: editingComment,
      type: editingType,
    };

    onAnnotationsChange([...annotations, newPin]);
    setPendingClick(null);
    setEditingComment('');
  }, [pendingClick, onAnnotationsChange, annotations, editingComment, editingType]);

  const handleRemovePin = useCallback(
    (index: number) => {
      if (!onAnnotationsChange) return;

      const updated = annotations
        .filter((_, i) => i !== index)
        .map((pin, i) => ({ ...pin, label: i + 1 }));
      onAnnotationsChange(updated);
      setSelectedPin(null);
    },
    [annotations, onAnnotationsChange]
  );

  const handlePinClick = useCallback(
    (index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      setSelectedPin(selectedPin === index ? null : index);
      setPendingClick(null);
    },
    [selectedPin]
  );

  return (
    <div className="relative">
      {/* SVG overlay for click-to-place pins */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 z-10 ${readOnly ? '' : 'cursor-crosshair'}`}
        onClick={handleOverlayClick}
      >
        {/* Render placed pins */}
        {annotations.map((pin, index) => {
          const colors = PIN_COLORS[pin.type];
          return (
            <div
              key={index}
              data-annotation-pin
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            >
              <button
                type="button"
                onClick={(event) => handlePinClick(index, event)}
                className={`w-6 h-6 rounded-full ${colors.bg} ${colors.text} ring-2 ${colors.ring} text-xs font-bold flex items-center justify-center shadow-md hover:scale-110 transition-transform`}
                title={pin.comment}
              >
                {pin.label}
              </button>

              {/* Tooltip */}
              {selectedPin === index ? (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-48 z-30">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        pin.type === 'error'
                          ? 'bg-red-100 text-red-700'
                          : pin.type === 'improvement'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {pin.type}
                    </span>
                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemovePin(index);
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

        {/* Pending click indicator */}
        {pendingClick ? (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            style={{ left: `${pendingClick.x}%`, top: `${pendingClick.y}%` }}
          >
            <div className="w-6 h-6 rounded-full bg-blue-500 text-white ring-2 ring-blue-300 text-xs font-bold flex items-center justify-center animate-pulse">
              ?
            </div>
          </div>
        ) : null}
      </div>

      {/* New pin form */}
      {pendingClick && !readOnly ? (
        <div className="absolute bottom-2 left-2 right-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-30">
          <div className="text-sm font-medium text-gray-700 mb-2">Add Annotation</div>
          <div className="flex gap-2 mb-2">
            {(['error', 'improvement', 'good'] as const).map((type) => (
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
                  handleAddPin();
                }
                if (event.key === 'Escape') {
                  setPendingClick(null);
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleAddPin();
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPendingClick(null);
              }}
              className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Annotation sidebar panel showing all pins and their comments.
 */
export function AnnotationSidebar({
  annotations,
  selectedPin,
  onSelectPin,
}: {
  annotations: AnnotationPin[];
  selectedPin: number | null;
  onSelectPin: (index: number | null) => void;
}) {
  if (annotations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">
        Annotations ({annotations.length})
      </h4>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {annotations.map((pin, index) => {
          const colors = PIN_COLORS[pin.type];
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectPin(selectedPin === index ? null : index)}
              className={`w-full text-left flex items-start gap-2 p-2 rounded border transition-colors ${
                selectedPin === index
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
                <span
                  className={`text-xs ${
                    pin.type === 'error'
                      ? 'text-red-500'
                      : pin.type === 'improvement'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                  }`}
                >
                  {pin.type}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
