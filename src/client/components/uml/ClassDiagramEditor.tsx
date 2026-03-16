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
  type ClassDiagramEdge,
  type ClassDiagramEdgeData,
  type ClassDiagramNode,
  type ClassDiagramNodeData,
  type ClassDiagramState,
  type RelationshipType,
  type UmlElementType,
} from './classDiagram';

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

const normalizeElementType = (value?: UmlElementType): UmlElementType => value ?? 'class';

const buildNodeDefaults = (elementType: UmlElementType, count: number): ClassDiagramNodeData => {
  switch (elementType) {
    case 'interface':
      return {
        name: `Interface${count}`,
        attributes: [],
        methods: ['+ operation()'],
        elementType,
      };
    case 'abstractClass':
      return {
        name: `AbstractClass${count}`,
        attributes: ['# sharedField: Type'],
        methods: ['+ abstractOperation()'],
        elementType,
      };
    case 'enum':
      return {
        name: `Enum${count}`,
        attributes: ['VALUE_ONE', 'VALUE_TWO'],
        methods: [],
        elementType,
      };
    default:
      return {
        name: `Class${count}`,
        attributes: ['+ attribute: Type'],
        methods: ['+ method()'],
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
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: { relationship, label: edge.data?.label ?? '' },
      label: edge.data?.label ?? '',
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
      label: edge.data?.label ?? '',
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
  interface: '\u00abinterface\u00bb',
  abstractClass: '\u00ababstract\u00bb',
  enum: '\u00abenum\u00bb',
};

function ClassNode({ data, selected }: ClassNodeProps) {
  const elementType = normalizeElementType(data.elementType);
  const attributes = data.attributes ?? [];
  const methods = data.methods ?? [];
  const primaryLabel = elementType === 'enum' ? 'Values' : 'Attributes';
  const stereotype = STEREOTYPE_LABEL[elementType];

  return (
    <div
      className={`rounded-md border bg-white shadow-sm min-w-[200px] text-sm ${
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
        {stereotype && <div className="text-[10px] uppercase tracking-wide text-gray-500">{stereotype}</div>}
        <div className={`font-semibold ${elementType === 'abstractClass' ? 'italic' : ''}`}>
          {data.name || 'Element'}
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-xs uppercase text-gray-400">{primaryLabel}</div>
        {attributes.length === 0 ? (
          <p className="mt-1 text-xs italic text-gray-400">None</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {attributes.map((attr, index) => (
              <li key={`${attr}-${index}`} className="text-gray-700">
                {attr}
              </li>
            ))}
          </ul>
        )}
        {elementType !== 'enum' && (
          <>
            <div className="mt-2 text-xs uppercase text-gray-400">Methods</div>
            {methods.length === 0 ? (
              <p className="mt-1 text-xs italic text-gray-400">None</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {methods.map((method, index) => (
                  <li key={`${method}-${index}`} className="text-gray-700">
                    {method}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { classNode: ClassNode };

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
  const initialDiagram = initialState ?? DEFAULT_CLASS_DIAGRAM_STATE;
  const [nodes, setNodes, onNodesChange] = useNodesState(mapStateToNodes(initialDiagram));
  const [edges, setEdges, onEdgesChange] = useEdgesState(mapStateToEdges(initialDiagram));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const hasMountedRef = useRef(false);

  const propagateChange = useCallback(
    (nextNodes: Node<ClassDiagramNodeData>[], nextEdges: Edge<ClassDiagramEdgeData>[]) => {
      const state: ClassDiagramState = {
        nodes: mapNodesToState(nextNodes),
        edges: mapEdgesToState(nextEdges),
      };
      const uml = generateClassDiagramPlantUml(state);
      onChange?.(state, uml);
    },
    [onChange]
  );

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    propagateChange(nodes, edges);
  }, [edges, nodes, propagateChange]);

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

  const updateSelectedNode = (patch: Partial<ClassDiagramNodeData>) => {
    if (!selectedNode || readOnly) return;
    const nextNodes = nodes.map((node) =>
      node.id === selectedNode.id
        ? { ...node, data: { ...node.data, ...patch } }
        : node
    );
    setNodes(nextNodes);
  };

  const updateSelectedEdge = (patch: Partial<ClassDiagramEdgeData>) => {
    if (!selectedEdge || readOnly) return;
    const relationship = patch.relationship ?? selectedEdge.data?.relationship ?? 'association';
    const label = patch.label ?? selectedEdge.data?.label ?? '';
    const nextEdges = edges.map((edge) => {
      if (edge.id !== selectedEdge.id) return edge;
      return {
        ...edge,
        data: { relationship, label },
        label,
        ...getEdgeVisuals(relationship),
      };
    });
    setEdges(nextEdges);
  };

  const addElement = (elementType: UmlElementType) => {
    if (readOnly) return;
    const sameTypeCount =
      nodes.filter((node) => normalizeElementType(node.data.elementType) === elementType).length + 1;

    const nextNodes = [
      ...nodes,
      {
        id: `${elementType}-${crypto.randomUUID()}`,
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

  const addAttribute = (value: string) => {
    if (!selectedNode || readOnly) return;
    const attributes = [...(selectedNode.data.attributes ?? []), value];
    updateSelectedNode({ attributes });
  };

  const addMethod = (value: string) => {
    if (!selectedNode || readOnly) return;
    const methods = [...(selectedNode.data.methods ?? []), value];
    updateSelectedNode({ methods });
  };

  const updateListItem = (
    type: 'attributes' | 'methods',
    index: number,
    value: string
  ) => {
    if (!selectedNode || readOnly) return;
    const list = [...(selectedNode.data[type] ?? [])];
    list[index] = value;
    updateSelectedNode({ [type]: list } as Partial<ClassDiagramNodeData>);
  };

  const removeListItem = (type: 'attributes' | 'methods', index: number) => {
    if (!selectedNode || readOnly) return;
    const list = [...(selectedNode.data[type] ?? [])];
    list.splice(index, 1);
    updateSelectedNode({ [type]: list } as Partial<ClassDiagramNodeData>);
  };

  const primaryListLabel = selectedElementType === 'enum' ? 'Values' : 'Attributes';
  const primaryAddTemplate = selectedElementType === 'enum' ? 'VALUE' : '+ attribute: Type';
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
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

              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-500">{primaryListLabel}</label>
                <div className="mt-2 space-y-2">
                  {(selectedNode.data.attributes ?? []).map((attr, index) => (
                    <div key={`${attr}-${index}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={attr}
                        onChange={(event) => updateListItem('attributes', index, event.target.value)}
                        disabled={readOnly}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeListItem('attributes', index)}
                        disabled={readOnly}
                        className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addAttribute(primaryAddTemplate)}
                    disabled={readOnly}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    + Add {selectedElementType === 'enum' ? 'value' : 'attribute'}
                  </button>
                </div>
              </div>

              {selectedElementType !== 'enum' && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500">Methods</label>
                  <div className="mt-2 space-y-2">
                    {(selectedNode.data.methods ?? []).map((method, index) => (
                      <div key={`${method}-${index}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={method}
                          onChange={(event) => updateListItem('methods', index, event.target.value)}
                          disabled={readOnly}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-blue-500 disabled:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => removeListItem('methods', index)}
                          disabled={readOnly}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addMethod('+ method()')}
                      disabled={readOnly}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      + Add method
                    </button>
                  </div>
                </div>
              )}
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

              <label className="mt-4 block text-xs font-medium text-slate-500">Label (optional)</label>
              <input
                type="text"
                value={selectedEdge.data?.label ?? ''}
                onChange={(event) => updateSelectedEdge({ label: event.target.value })}
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
                    Add elements first, arrange them on the canvas, then connect the side handles to define how they relate.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Common arrows</p>
                  <p className="mt-1">
                    Association uses A --&gt; B, inheritance uses Parent &lt;|-- Child, and dependency uses A ..&gt; B.
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
