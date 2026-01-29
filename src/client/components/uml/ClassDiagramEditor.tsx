import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
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
} from './classDiagram';

const RELATIONSHIP_OPTIONS: Array<{ value: RelationshipType; label: string }> = [
  { value: 'association', label: 'Association (A --> B)' },
  { value: 'inheritance', label: 'Inheritance (Parent <|-- Child)' },
  { value: 'aggregation', label: 'Aggregation (Whole o-- Part)' },
  { value: 'composition', label: 'Composition (Whole *-- Part)' },
  { value: 'dependency', label: 'Dependency (A ..> B)' },
];

const mapStateToNodes = (state: ClassDiagramState): Node<ClassDiagramNodeData>[] =>
  state.nodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: node.data,
    type: 'classNode',
  }));

const mapStateToEdges = (state: ClassDiagramState): Edge<ClassDiagramEdgeData>[] =>
  state.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: edge.data,
    label: edge.data.label,
    markerEnd: { type: 'arrowclosed' },
  }));

const mapNodesToState = (nodes: Node<ClassDiagramNodeData>[]): ClassDiagramNode[] =>
  nodes.map((node) => ({
    id: node.id,
    position: node.position,
    data: node.data,
  }));

const mapEdgesToState = (edges: Edge<ClassDiagramEdgeData>[]): ClassDiagramEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: edge.data ?? { relationship: 'association' },
  }));

type ClassNodeProps = {
  data: ClassDiagramNodeData;
  selected: boolean;
};

function ClassNode({ data, selected }: ClassNodeProps) {
  return (
    <div
      className={`rounded-md border bg-white shadow-sm min-w-45 text-sm ${
        selected ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300'
      }`}
    >
      <div className="border-b border-gray-200 px-3 py-1.5 font-semibold text-gray-900">
        {data.name || 'Class'}
      </div>
      <div className="px-3 py-2">
        <div className="text-xs uppercase text-gray-400">Attributes</div>
        <ul className="mt-1 space-y-1">
          {(data.attributes ?? []).map((attr, index) => (
            <li key={`${attr}-${index}`} className="text-gray-700">
              {attr}
            </li>
          ))}
        </ul>
        <div className="mt-2 text-xs uppercase text-gray-400">Methods</div>
        <ul className="mt-1 space-y-1">
          {(data.methods ?? []).map((method, index) => (
            <li key={`${method}-${index}`} className="text-gray-700">
              {method}
            </li>
          ))}
        </ul>
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

  // Removed resetting nodes and edges on mount
  // useEffect(() => {
  //   setNodes(mapStateToNodes(initialDiagram));
  //   setEdges(mapStateToEdges(initialDiagram));
  // }, [initialDiagram, setEdges, setNodes]);

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
    propagateChange(nodes, edges);
  }, [edges, nodes, propagateChange]);

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            data: { relationship: 'association' },
            markerEnd: { type: 'arrowclosed' },
          },
          eds
        );
        return next;
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
    const relationship =
      patch.relationship ?? selectedEdge.data?.relationship ?? 'association';
    const label = patch.label ?? selectedEdge.data?.label ?? '';
    const nextEdges = edges.map((edge) =>
      edge.id === selectedEdge.id
        ? { ...edge, data: { relationship, label }, label }
        : edge
    );
    setEdges(nextEdges);
  };

  const addClass = () => {
    if (readOnly) return;
    const nextNodes = [...nodes, {
      id: `class-${crypto.randomUUID()}`,
      position: { x: 80 + nodes.length * 40, y: 80 + nodes.length * 30 },
      data: {
        name: `Class${nodes.length + 1}`,
        attributes: [],
        methods: [],
      },
      type: 'classNode',
    }];
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

  return (
    <div className="space-y-4" style={{ minHeight: height }}>
      <div className="h-full rounded-md border border-gray-200" style={{ height }}>
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
          <Background gap={16} color="#f3f4f6" />
          <MiniMap nodeStrokeWidth={2} style={{ height: 90, width: 130 }} />
          <Controls showInteractive={!readOnly} />
        </ReactFlow>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Diagram Controls</h3>
          <p className="text-xs text-gray-500 mt-1">
            Drag classes to reposition. Connect classes by dragging a handle from one class to another.
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={addClass}
              disabled={readOnly}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              + Add class
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={readOnly || (!selectedNodeId && !selectedEdgeId)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {selectedNode && (
            <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Class Details</h3>
              <label className="mt-3 block text-xs font-medium text-gray-500">Class name</label>
              <input
                type="text"
                value={selectedNode.data.name}
                onChange={(event) => updateSelectedNode({ name: event.target.value })}
                disabled={readOnly}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
              />

              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500">Attributes</label>
                <div className="mt-2 space-y-2">
                  {(selectedNode.data.attributes ?? []).map((attr, index) => (
                    <div key={`${attr}-${index}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={attr}
                        onChange={(event) => updateListItem('attributes', index, event.target.value)}
                        disabled={readOnly}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeListItem('attributes', index)}
                        disabled={readOnly}
                        className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addAttribute('+ attribute: Type')}
                    disabled={readOnly}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    + Add attribute
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-500">Methods</label>
                <div className="mt-2 space-y-2">
                  {(selectedNode.data.methods ?? []).map((method, index) => (
                    <div key={`${method}-${index}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={method}
                        onChange={(event) => updateListItem('methods', index, event.target.value)}
                        disabled={readOnly}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeListItem('methods', index)}
                        disabled={readOnly}
                        className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addMethod('+ method()')}
                    disabled={readOnly}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    + Add method
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedEdge && (
            <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Relationship</h3>
              <label className="mt-3 block text-xs font-medium text-gray-500">Type</label>
              <select
                value={selectedEdge.data?.relationship ?? 'association'}
                onChange={(event) => updateSelectedEdge({ relationship: event.target.value as RelationshipType })}
                disabled={readOnly}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="mt-3 block text-xs font-medium text-gray-500">Label (optional)</label>
              <input
                type="text"
                value={selectedEdge.data?.label ?? ''}
                onChange={(event) => updateSelectedEdge({ label: event.target.value })}
                disabled={readOnly}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
