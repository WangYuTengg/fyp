import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
  Handle,
  MarkerType,
  Position,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  DEFAULT_CLASS_DIAGRAM_STATE,
  generateClassDiagramPlantUml,
  generateMemberId,
  normalizeClassDiagramState,
  normalizeElementType,
  VISIBILITY_OPTIONS,
  type ClassAttribute,
  type ClassDiagramEdge,
  type ClassDiagramEdgeData,
  type ClassDiagramNode,
  type ClassDiagramNodeData,
  type ClassDiagramState,
  type ClassMethod,
  type RelationshipType,
  type UmlElementType,
  type Visibility,
} from './classDiagram';
import { useDebouncedHistory, useUndoRedoHotkeys } from './useDebouncedHistory';

const RELATIONSHIP_OPTIONS: Array<{ value: RelationshipType; label: string }> = [
  { value: 'association', label: 'Association (A --> B)' },
  { value: 'inheritance', label: 'Inheritance (Parent <|-- Child)' },
  { value: 'realization', label: 'Realization (Interface <|.. Implementation)' },
  { value: 'aggregation', label: 'Aggregation (Whole o-- Part)' },
  { value: 'composition', label: 'Composition (Whole *-- Part)' },
  { value: 'dependency', label: 'Dependency (A ..> B)' },
];

const ELEMENT_OPTIONS: Array<{ value: UmlElementType; label: string }> = [
  { value: 'class', label: 'Class' },
  { value: 'interface', label: 'Interface' },
  { value: 'abstractClass', label: 'Abstract Class' },
  { value: 'enum', label: 'Enum' },
];

const buildNodeDefaults = (elementType: UmlElementType, count: number): ClassDiagramNodeData => {
  switch (elementType) {
    case 'interface':
      return {
        name: `Interface${count}`,
        attributes: [],
        methods: [
          { id: generateMemberId('method'), visibility: '+', name: 'operation' },
        ],
        elementType,
      };
    case 'abstractClass':
      return {
        name: `AbstractClass${count}`,
        attributes: [
          { id: generateMemberId('attr'), visibility: '#', name: 'sharedField', type: 'Type' },
        ],
        methods: [
          {
            id: generateMemberId('method'),
            visibility: '+',
            name: 'abstractOperation',
            isAbstract: true,
          },
        ],
        elementType,
      };
    case 'enum':
      return {
        name: `Enum${count}`,
        attributes: [
          { id: generateMemberId('attr'), visibility: '+', name: 'VALUE_ONE' },
          { id: generateMemberId('attr'), visibility: '+', name: 'VALUE_TWO' },
        ],
        methods: [],
        elementType,
      };
    default:
      return {
        name: `Class${count}`,
        attributes: [
          { id: generateMemberId('attr'), visibility: '+', name: 'attribute', type: 'Type' },
        ],
        methods: [
          { id: generateMemberId('method'), visibility: '+', name: 'method' },
        ],
        elementType: 'class',
      };
  }
};

const SOLID_EDGE_STYLE: CSSProperties = { stroke: '#475569', strokeWidth: 1.8 };
const DASHED_EDGE_STYLE: CSSProperties = {
  stroke: '#475569',
  strokeWidth: 1.8,
  strokeDasharray: '6 4',
};
const THICK_EDGE_STYLE: CSSProperties = { stroke: '#334155', strokeWidth: 2.2 };

type EdgeVisuals = Pick<Edge<ClassDiagramEdgeData>, 'markerStart' | 'markerEnd' | 'style'>;

const getEdgeVisuals = (relationship: RelationshipType): EdgeVisuals => {
  switch (relationship) {
    case 'inheritance':
      return {
        markerStart: { type: MarkerType.Arrow },
        markerEnd: undefined,
        style: SOLID_EDGE_STYLE,
      };
    case 'realization':
      return {
        markerStart: { type: MarkerType.Arrow },
        markerEnd: undefined,
        style: DASHED_EDGE_STYLE,
      };
    case 'aggregation':
      return {
        markerStart: { type: MarkerType.ArrowClosed },
        markerEnd: undefined,
        style: SOLID_EDGE_STYLE,
      };
    case 'composition':
      return {
        markerStart: { type: MarkerType.ArrowClosed },
        markerEnd: undefined,
        style: THICK_EDGE_STYLE,
      };
    case 'dependency':
      return {
        markerStart: undefined,
        markerEnd: { type: MarkerType.Arrow },
        style: DASHED_EDGE_STYLE,
      };
    default:
      return {
        markerStart: undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: SOLID_EDGE_STYLE,
      };
  }
};

const formatEdgeLabel = (data: ClassDiagramEdgeData | undefined): string => {
  if (!data) return '';
  const sm = data.sourceMultiplicity?.trim();
  const tm = data.targetMultiplicity?.trim();
  const label = data.label?.trim();
  const segments: string[] = [];
  if (sm || tm) {
    segments.push(`${sm ?? ''} … ${tm ?? ''}`.trim());
  }
  if (label) segments.push(label);
  return segments.join(' · ');
};

const mapStateToNodes = (state: ClassDiagramState): Node<ClassDiagramNodeData>[] =>
  state.nodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: {
      ...node.data,
      elementType: normalizeElementType(node.data.elementType),
    },
    type: 'classNode',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

const mapStateToEdges = (state: ClassDiagramState): Edge<ClassDiagramEdgeData>[] =>
  state.edges.map((edge) => {
    const relationship = edge.data?.relationship ?? 'association';
    const data: ClassDiagramEdgeData = {
      relationship,
      label: edge.data?.label,
      sourceMultiplicity: edge.data?.sourceMultiplicity,
      targetMultiplicity: edge.data?.targetMultiplicity,
    };
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data,
      label: formatEdgeLabel(data),
      ...getEdgeVisuals(relationship),
    };
  });

const mapNodesToState = (nodes: Node<ClassDiagramNodeData>[]): ClassDiagramNode[] =>
  nodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: {
      ...node.data,
      elementType: normalizeElementType(node.data.elementType),
    },
  }));

const mapEdgesToState = (edges: Edge<ClassDiagramEdgeData>[]): ClassDiagramEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: {
      relationship: edge.data?.relationship ?? 'association',
      label: edge.data?.label,
      sourceMultiplicity: edge.data?.sourceMultiplicity,
      targetMultiplicity: edge.data?.targetMultiplicity,
    },
  }));

type ClassNodeProps = {
  data: ClassDiagramNodeData;
  selected: boolean;
};

const NODE_ACCENT_CLASS: Record<UmlElementType, string> = {
  class: 'border-slate-300',
  interface: 'border-violet-300',
  abstractClass: 'border-amber-300',
  enum: 'border-emerald-300',
};

const STEREOTYPE_LABEL: Partial<Record<UmlElementType, string>> = {
  interface: '«interface»',
  abstractClass: '«abstract»',
  enum: '«enum»',
};

const renderAttributeText = (attr: ClassAttribute, isEnum: boolean): string => {
  if (isEnum) return attr.name || 'value';
  let line = `${attr.visibility} ${attr.name || 'attribute'}`;
  if (attr.type) line += `: ${attr.type}`;
  if (attr.defaultValue) line += ` = ${attr.defaultValue}`;
  return line;
};

const renderMethodText = (method: ClassMethod): string => {
  const flags: string[] = [];
  if (method.isStatic) flags.push('{static}');
  if (method.isAbstract) flags.push('{abstract}');
  const flagsText = flags.length > 0 ? `${flags.join(' ')} ` : '';
  const ret = method.returnType ? `: ${method.returnType}` : '';
  return `${method.visibility} ${flagsText}${method.name || 'method'}(${method.parameters ?? ''})${ret}`;
};

function ClassNode({ data, selected }: ClassNodeProps) {
  const elementType = normalizeElementType(data.elementType);
  const isEnum = elementType === 'enum';
  const attributes = data.attributes ?? [];
  const methods = data.methods ?? [];
  const primaryLabel = isEnum ? 'Values' : 'Attributes';
  const stereotype = STEREOTYPE_LABEL[elementType];
  const generics = data.generics?.trim();

  return (
    <div
      className={`rounded-md border bg-white shadow-sm min-w-[220px] text-sm ${
        selected ? 'ring-2 ring-blue-300 border-blue-500' : NODE_ACCENT_CLASS[elementType]
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 8, height: 8, background: '#64748b', border: '1px solid #fff' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 8, height: 8, background: '#64748b', border: '1px solid #fff' }}
      />
      <div className="border-b border-gray-200 px-3 py-1.5 text-gray-900">
        {stereotype ? (
          <div className="text-[10px] uppercase tracking-wide text-gray-500">{stereotype}</div>
        ) : null}
        <div className={`font-semibold ${elementType === 'abstractClass' ? 'italic' : ''}`}>
          {data.name || 'Element'}
          {generics ? <span className="text-gray-500 font-normal">{`<${generics}>`}</span> : null}
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-xs uppercase text-gray-400">{primaryLabel}</div>
        {attributes.length === 0 ? (
          <p className="mt-1 text-xs italic text-gray-400">None</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {attributes.map((attr) => (
              <li
                key={attr.id}
                className={`text-gray-700 ${attr.isStatic ? 'underline decoration-dotted' : ''}`}
              >
                {renderAttributeText(attr, isEnum)}
              </li>
            ))}
          </ul>
        )}
        {!isEnum ? (
          <>
            <div className="mt-2 text-xs uppercase text-gray-400">Methods</div>
            {methods.length === 0 ? (
              <p className="mt-1 text-xs italic text-gray-400">None</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {methods.map((method) => (
                  <li
                    key={method.id}
                    className={`text-gray-700 ${method.isStatic ? 'underline decoration-dotted' : ''} ${
                      method.isAbstract ? 'italic' : ''
                    }`}
                  >
                    {renderMethodText(method)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
        {data.note?.trim() ? (
          <div className="mt-2 rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-[11px] text-yellow-800 whitespace-pre-line">
            {data.note.trim()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const nodeTypes = { classNode: ClassNode };

type AttributeRowProps = {
  attribute: ClassAttribute;
  isEnum: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<ClassAttribute>) => void;
  onRemove: () => void;
};

function AttributeRow({ attribute, isEnum, readOnly, onChange, onRemove }: AttributeRowProps) {
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-1.5">
        {!isEnum ? (
          <select
            value={attribute.visibility}
            onChange={(event) => onChange({ visibility: event.target.value as Visibility })}
            disabled={readOnly}
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-mono text-slate-700 disabled:bg-slate-100"
            title="Visibility"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value} {option.label}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="text"
          value={attribute.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={isEnum ? 'VALUE' : 'name'}
          disabled={readOnly}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={readOnly}
          className="text-rose-600 text-sm leading-none px-1 hover:text-rose-700 disabled:opacity-40"
          aria-label="Remove"
        >
          ×
        </button>
      </div>
      {!isEnum ? (
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs px-1">:</span>
          <input
            type="text"
            value={attribute.type ?? ''}
            onChange={(event) => onChange({ type: event.target.value || undefined })}
            placeholder="Type"
            disabled={readOnly}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
          />
          <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={attribute.isStatic ?? false}
              onChange={(event) => onChange({ isStatic: event.target.checked || undefined })}
              disabled={readOnly}
              className="h-3 w-3"
            />
            static
          </label>
        </div>
      ) : null}
    </div>
  );
}

type MethodRowProps = {
  method: ClassMethod;
  readOnly: boolean;
  onChange: (patch: Partial<ClassMethod>) => void;
  onRemove: () => void;
};

function MethodRow({ method, readOnly, onChange, onRemove }: MethodRowProps) {
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-1.5">
        <select
          value={method.visibility}
          onChange={(event) => onChange({ visibility: event.target.value as Visibility })}
          disabled={readOnly}
          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-mono text-slate-700 disabled:bg-slate-100"
          title="Visibility"
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value} {option.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={method.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="name"
          disabled={readOnly}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={readOnly}
          className="text-rose-600 text-sm leading-none px-1 hover:text-rose-700 disabled:opacity-40"
          aria-label="Remove"
        >
          ×
        </button>
      </div>
      <input
        type="text"
        value={method.parameters ?? ''}
        onChange={(event) => onChange({ parameters: event.target.value || undefined })}
        placeholder="parameters (e.g. x: int, y: int)"
        disabled={readOnly}
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
      />
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs">→</span>
        <input
          type="text"
          value={method.returnType ?? ''}
          onChange={(event) => onChange({ returnType: event.target.value || undefined })}
          placeholder="return type"
          disabled={readOnly}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
        />
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={method.isStatic ?? false}
            onChange={(event) => onChange({ isStatic: event.target.checked || undefined })}
            disabled={readOnly}
            className="h-3 w-3"
          />
          static
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={method.isAbstract ?? false}
            onChange={(event) => onChange({ isAbstract: event.target.checked || undefined })}
            disabled={readOnly}
            className="h-3 w-3"
          />
          abstract
        </label>
      </div>
    </div>
  );
}

type ClassDiagramEditorProps = {
  initialState?: ClassDiagramState;
  onChange?: (state: ClassDiagramState, plantUml: string) => void;
  readOnly?: boolean;
  height?: string;
};

export function ClassDiagramEditor({
  initialState,
  onChange,
  readOnly = false,
  height = '420px',
}: ClassDiagramEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    mapStateToNodes(normalizeClassDiagramState(initialState ?? DEFAULT_CLASS_DIAGRAM_STATE))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    mapStateToEdges(normalizeClassDiagramState(initialState ?? DEFAULT_CLASS_DIAGRAM_STATE))
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const hasMountedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      // Reset on cleanup so StrictMode's simulated remount starts fresh and
      // doesn't fire onChange on the second mount with stale state.
      return () => {
        hasMountedRef.current = false;
      };
    }
    const state: ClassDiagramState = {
      nodes: mapNodesToState(nodes),
      edges: mapEdgesToState(edges),
    };
    const uml = generateClassDiagramPlantUml(state);
    onChangeRef.current?.(state, uml);
  }, [edges, nodes]);

  const historyState = useMemo<ClassDiagramState>(
    () => ({ nodes: mapNodesToState(nodes), edges: mapEdgesToState(edges) }),
    [nodes, edges]
  );

  const applyHistoryState = useCallback(
    (state: ClassDiagramState) => {
      setNodes(mapStateToNodes(state));
      setEdges(mapStateToEdges(state));
    },
    [setNodes, setEdges]
  );

  const history = useDebouncedHistory<ClassDiagramState>(historyState, {
    applyState: applyHistoryState,
  });

  useUndoRedoHotkeys(containerRef, history, !readOnly);

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((currentEdges) => {
        const relationship: RelationshipType = 'association';
        const nextEdge = addEdge(
          {
            ...connection,
            data: { relationship, label: '' },
            ...getEdgeVisuals(relationship),
          },
          currentEdges
        );
        return nextEdge;
      });
    },
    [readOnly, setEdges]
  );

  const handleSelectionChange = useCallback((selection: { nodes: Node[]; edges: Edge[] }) => {
    setSelectedNodeId(selection.nodes[0]?.id ?? null);
    setSelectedEdgeId(selection.edges[0]?.id ?? null);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const selectedElementType: UmlElementType = selectedNode
    ? normalizeElementType(selectedNode.data.elementType)
    : 'class';
  const selectedIsEnum = selectedElementType === 'enum';

  const updateSelectedNode = (patch: Partial<ClassDiagramNodeData>) => {
    if (!selectedNode || readOnly) return;
    const nextNodes = nodes.map((node) =>
      node.id === selectedNode.id ? { ...node, data: { ...node.data, ...patch } } : node
    );
    setNodes(nextNodes);
  };

  const updateSelectedEdge = (patch: Partial<ClassDiagramEdgeData>) => {
    if (!selectedEdge || readOnly) return;
    const merged: ClassDiagramEdgeData = {
      relationship: patch.relationship ?? selectedEdge.data?.relationship ?? 'association',
      label: patch.label ?? selectedEdge.data?.label,
      sourceMultiplicity: patch.sourceMultiplicity ?? selectedEdge.data?.sourceMultiplicity,
      targetMultiplicity: patch.targetMultiplicity ?? selectedEdge.data?.targetMultiplicity,
    };
    const nextEdges = edges.map((edge) => {
      if (edge.id !== selectedEdge.id) return edge;
      return {
        ...edge,
        data: merged,
        label: formatEdgeLabel(merged),
        ...getEdgeVisuals(merged.relationship),
      };
    });
    setEdges(nextEdges);
  };

  const addElement = (elementType: UmlElementType) => {
    if (readOnly) return;
    const sameTypeCount =
      nodes.filter((node) => normalizeElementType(node.data.elementType) === elementType).length +
      1;

    const nextNodes = [
      ...nodes,
      {
        id: `${elementType}-${generateMemberId('class').slice('class-'.length)}`,
        position: { x: 80 + nodes.length * 40, y: 80 + nodes.length * 30 },
        data: buildNodeDefaults(elementType, sameTypeCount),
        type: 'classNode',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ];
    setNodes(nextNodes);
  };

  const deleteSelected = () => {
    if (readOnly) return;
    if (selectedNodeId) {
      const nextNodes = nodes.filter((node) => node.id !== selectedNodeId);
      const nextEdges = edges.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId
      );
      setSelectedNodeId(null);
      setNodes(nextNodes);
      setEdges(nextEdges);
      return;
    }

    if (selectedEdgeId) {
      const nextEdges = edges.filter((edge) => edge.id !== selectedEdgeId);
      setSelectedEdgeId(null);
      setEdges(nextEdges);
    }
  };

  const updateAttribute = (index: number, patch: Partial<ClassAttribute>) => {
    if (!selectedNode || readOnly) return;
    const attributes = (selectedNode.data.attributes ?? []).map((attr, i) =>
      i === index ? { ...attr, ...patch } : attr
    );
    updateSelectedNode({ attributes });
  };

  const removeAttribute = (index: number) => {
    if (!selectedNode || readOnly) return;
    const attributes = (selectedNode.data.attributes ?? []).filter((_, i) => i !== index);
    updateSelectedNode({ attributes });
  };

  const addAttribute = () => {
    if (!selectedNode || readOnly) return;
    const newAttr: ClassAttribute = selectedIsEnum
      ? { id: generateMemberId('attr'), visibility: '+', name: 'VALUE' }
      : { id: generateMemberId('attr'), visibility: '+', name: 'attribute', type: 'Type' };
    updateSelectedNode({
      attributes: [...(selectedNode.data.attributes ?? []), newAttr],
    });
  };

  const updateMethod = (index: number, patch: Partial<ClassMethod>) => {
    if (!selectedNode || readOnly) return;
    const methods = (selectedNode.data.methods ?? []).map((method, i) =>
      i === index ? { ...method, ...patch } : method
    );
    updateSelectedNode({ methods });
  };

  const removeMethod = (index: number) => {
    if (!selectedNode || readOnly) return;
    const methods = (selectedNode.data.methods ?? []).filter((_, i) => i !== index);
    updateSelectedNode({ methods });
  };

  const addMethod = () => {
    if (!selectedNode || readOnly) return;
    const newMethod: ClassMethod = {
      id: generateMemberId('method'),
      visibility: '+',
      name: 'method',
    };
    updateSelectedNode({
      methods: [...(selectedNode.data.methods ?? []), newMethod],
    });
  };

  const primaryListLabel = selectedIsEnum ? 'Values' : 'Attributes';
  const selectedItemLabel = selectedNode
    ? `${selectedNode.data.name || 'Unnamed element'} selected`
    : selectedEdge
      ? 'Relationship selected'
      : 'Nothing selected';
  const deleteButtonLabel = selectedNode
    ? 'Delete selected element'
    : selectedEdge
      ? 'Delete selected relationship'
      : 'Delete selected';

  return (
    <div ref={containerRef} tabIndex={-1} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm focus:outline-none">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Canvas</h3>
          <p className="mt-1 text-xs text-slate-500">
            {readOnly
              ? 'Preview the diagram structure and inspect the selected element details.'
              : 'Add elements from the toolbar, drag them into place, then connect node handles to define relationships.'}
          </p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-white">
              <button
                type="button"
                onClick={history.undo}
                disabled={!history.canUndo}
                title="Undo (Cmd/Ctrl+Z)"
                className="rounded-l-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                onClick={history.redo}
                disabled={!history.canRedo}
                title="Redo (Cmd/Ctrl+Shift+Z)"
                className="rounded-r-full border-l border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                ↷ Redo
              </button>
            </div>
            <button
              type="button"
              onClick={() => addElement('class')}
              disabled={readOnly}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
            >
              + Class
            </button>
            <button
              type="button"
              onClick={() => addElement('interface')}
              disabled={readOnly}
              className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 disabled:opacity-50"
            >
              + Interface
            </button>
            <button
              type="button"
              onClick={() => addElement('abstractClass')}
              disabled={readOnly}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              + Abstract
            </button>
            <button
              type="button"
              onClick={() => addElement('enum')}
              disabled={readOnly}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              + Enum
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={readOnly || (!selectedNodeId && !selectedEdgeId)}
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
            >
              {deleteButtonLabel}
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div
          className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_45%),linear-gradient(180deg,_rgba(248,250,252,0.95),_rgba(255,255,255,1))] lg:border-b-0 lg:border-r"
          style={{ minHeight: height, height }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            nodesConnectable={!readOnly}
            nodesDraggable={!readOnly}
            elementsSelectable={!readOnly}
            fitView
            attributionPosition="bottom-right"
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} color="#dbe4f0" />
            <Controls showInteractive={!readOnly} />
          </ReactFlow>
        </div>

        <aside className="space-y-4 bg-slate-50/70 p-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Diagram summary
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Elements</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{nodes.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Relationships</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{edges.length}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{selectedItemLabel}</p>
          </div>

          {selectedNode && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Element details</h3>

              <label className="mt-4 block text-xs font-medium text-slate-500">Element type</label>
              <select
                value={selectedElementType}
                onChange={(event) =>
                  updateSelectedNode({ elementType: event.target.value as UmlElementType })
                }
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
              >
                {ELEMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-xs font-medium text-slate-500">Name</label>
              <input
                type="text"
                value={selectedNode.data.name}
                onChange={(event) => updateSelectedNode({ name: event.target.value })}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
              />

              {!selectedIsEnum ? (
                <>
                  <label className="mt-4 block text-xs font-medium text-slate-500">
                    Generics (optional)
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.generics ?? ''}
                    onChange={(event) =>
                      updateSelectedNode({ generics: event.target.value || undefined })
                    }
                    placeholder="T, U extends Comparable"
                    disabled={readOnly}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
                  />
                </>
              ) : null}

              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-500">{primaryListLabel}</label>
                <div className="mt-2 space-y-2">
                  {(selectedNode.data.attributes ?? []).map((attr, index) => (
                    <AttributeRow
                      key={attr.id}
                      attribute={attr}
                      isEnum={selectedIsEnum}
                      readOnly={readOnly}
                      onChange={(patch) => updateAttribute(index, patch)}
                      onRemove={() => removeAttribute(index)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addAttribute}
                    disabled={readOnly}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    + Add {selectedIsEnum ? 'value' : 'attribute'}
                  </button>
                </div>
              </div>

              {!selectedIsEnum ? (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500">Methods</label>
                  <div className="mt-2 space-y-2">
                    {(selectedNode.data.methods ?? []).map((method, index) => (
                      <MethodRow
                        key={method.id}
                        method={method}
                        readOnly={readOnly}
                        onChange={(patch) => updateMethod(index, patch)}
                        onRemove={() => removeMethod(index)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={addMethod}
                      disabled={readOnly}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      + Add method
                    </button>
                  </div>
                </div>
              ) : null}

              <label className="mt-4 block text-xs font-medium text-slate-500">
                Note (optional)
              </label>
              <textarea
                value={selectedNode.data.note ?? ''}
                onChange={(event) =>
                  updateSelectedNode({ note: event.target.value || undefined })
                }
                placeholder="Anchored note shown beneath the element"
                rows={2}
                disabled={readOnly}
                className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>
          )}

          {selectedEdge && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Relationship</h3>
              <label className="mt-4 block text-xs font-medium text-slate-500">Type</label>
              <select
                value={selectedEdge.data?.relationship ?? 'association'}
                onChange={(event) =>
                  updateSelectedEdge({ relationship: event.target.value as RelationshipType })
                }
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
              >
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500">Source mult.</label>
                  <input
                    type="text"
                    value={selectedEdge.data?.sourceMultiplicity ?? ''}
                    onChange={(event) =>
                      updateSelectedEdge({ sourceMultiplicity: event.target.value || undefined })
                    }
                    placeholder="1"
                    disabled={readOnly}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Target mult.</label>
                  <input
                    type="text"
                    value={selectedEdge.data?.targetMultiplicity ?? ''}
                    onChange={(event) =>
                      updateSelectedEdge({ targetMultiplicity: event.target.value || undefined })
                    }
                    placeholder="*"
                    disabled={readOnly}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <label className="mt-4 block text-xs font-medium text-slate-500">
                Label (optional)
              </label>
              <input
                type="text"
                value={selectedEdge.data?.label ?? ''}
                onChange={(event) =>
                  updateSelectedEdge({ label: event.target.value || undefined })
                }
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>
          )}

          {!selectedNode && !selectedEdge && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {readOnly ? 'No item selected' : 'Select or add an element'}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {readOnly
                  ? 'Click a class or relationship in the canvas to inspect its details.'
                  : 'Use the toolbar to add a class, interface, abstract class, or enum. Drag from a node handle to create a relationship.'}
              </p>
              <div className="mt-4 space-y-3 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-700">Quick guide</p>
                  <p className="mt-1">
                    Add elements first, arrange them on the canvas, then connect the side handles to
                    define how they relate.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Common arrows</p>
                  <p className="mt-1">
                    Association uses A --&gt; B, inheritance uses Parent &lt;|-- Child, and
                    dependency uses A ..&gt; B.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
