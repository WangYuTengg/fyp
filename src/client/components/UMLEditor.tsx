import { useEffect, useMemo, useState } from 'react';
import plantumlEncoder from 'plantuml-encoder';
import { ClassDiagramEditor } from './uml/ClassDiagramEditor';
import {
  DEFAULT_CLASS_DIAGRAM_STATE,
  generateClassDiagramPlantUml,
  type ClassDiagramState,
} from './uml/classDiagram';

type UMLEditorProps = {
  initialValue?: string;
  initialDiagramState?: ClassDiagramState;
  onChange?: (value: string, editorState?: ClassDiagramState) => void;
  readOnly?: boolean;
  height?: string;
};

const DEFAULT_UML = `@startuml
class Example {
  + attribute: String
  + method()
}
@enduml`;

export function UMLEditor({ 
  initialValue = DEFAULT_UML, 
  initialDiagramState,
  onChange, 
  readOnly = false,
  height = '400px'
}: UMLEditorProps) {
  const [umlText, setUmlText] = useState(() => {
    if (initialValue && initialValue.trim().length > 0) {
      return initialValue;
    }
    if (initialDiagramState) {
      return generateClassDiagramPlantUml(initialDiagramState);
    }
    return DEFAULT_UML;
  });
  const [encodedUml, setEncodedUml] = useState('');
  const [imageError, setImageError] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  const [diagramState, setDiagramState] = useState<ClassDiagramState>(
    initialDiagramState ?? DEFAULT_CLASS_DIAGRAM_STATE
  );
  const [visualSeed] = useState<ClassDiagramState>(
    () => initialDiagramState ?? DEFAULT_CLASS_DIAGRAM_STATE
  );

  useEffect(() => {
    setUmlText(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (initialValue && initialValue.trim().length > 0) {
      setUmlText(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    try {
      const encoded = plantumlEncoder.encode(umlText);
      setEncodedUml(encoded);
      setImageError(false);
    } catch (error) {
      console.error('Failed to encode UML:', error);
      setImageError(true);
    }
  }, [umlText]);

  const handleChange = (value: string) => {
    setUmlText(value);
    onChange?.(value);
  };

  const handleDiagramChange = (state: ClassDiagramState, plantUml: string) => {
    setDiagramState(state);
    setUmlText(plantUml);
    onChange?.(plantUml, state);
  };

  const visualUml = useMemo(() => generateClassDiagramPlantUml(diagramState), [diagramState]);

  const imageUrl = `https://www.plantuml.com/plantuml/svg/${encodedUml}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Editor */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-gray-700">
            UML Editor
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                activeTab === 'visual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-gray-300 text-gray-500 hover:text-gray-700'
              }`}
            >
              Visual (Class)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                activeTab === 'text'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-gray-300 text-gray-500 hover:text-gray-700'
              }`}
            >
              PlantUML
            </button>
          </div>
        </div>

        <div className="mt-2" style={{ minHeight: height }}>
          {activeTab === 'visual' ? (
            <ClassDiagramEditor
              key={visualSeed.nodes.length ? visualSeed.nodes[0].id : 'uml-visual-seed'}
              initialState={visualSeed}
              onChange={handleDiagramChange}
              readOnly={readOnly}
              height={height}
            />
          ) : (
            <textarea
              value={umlText}
              onChange={(e) => handleChange(e.target.value)}
              readOnly={readOnly}
              className="flex-1 font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{ minHeight: height }}
              placeholder="Enter PlantUML code..."
            />
          )}
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {activeTab === 'visual'
            ? 'Drag and drop classes. Connections export to PlantUML on save.'
            : 'Using PlantUML syntax.'}{' '}
          <a
            href="https://plantuml.com/class-diagram"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View documentation
          </a>
        </p>
        {activeTab === 'visual' && umlText !== visualUml && (
          <p className="mt-1 text-xs text-amber-600">
            The visual editor generates PlantUML. Switch to PlantUML tab to view the latest export.
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Diagram Preview
        </label>
        <div 
          className="flex-1 border border-gray-300 rounded-md bg-white p-4 overflow-auto"
          style={{ minHeight: height }}
        >
          {imageError ? (
            <div className="flex items-center justify-center h-full text-red-600">
              <p>Error rendering diagram. Check your PlantUML syntax.</p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="UML Diagram Preview"
              className="max-w-full h-auto"
              onError={() => setImageError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
