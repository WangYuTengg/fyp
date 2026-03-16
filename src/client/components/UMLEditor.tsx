import { useEffect, useMemo, useState } from 'react';
import plantumlEncoder from 'plantuml-encoder';
import { ClassDiagramEditor } from './uml/ClassDiagramEditor';
import {
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

type EditorMode = 'visual' | 'text';

const EMPTY_CLASS_DIAGRAM_STATE: ClassDiagramState = {
  nodes: [],
  edges: [],
};

const PLANTUML_EXAMPLE = `@startuml
class Student {
  + matricNo: String
  + submitDiagram()
}

Student --> "1" Assignment : completes
@enduml`;

const isNonEmptyText = (value?: string) => Boolean(value?.trim().length);

export function UMLEditor({
  initialValue = '',
  initialDiagramState,
  onChange,
  readOnly = false,
  height = '400px',
}: UMLEditorProps) {
  const hasInitialText = isNonEmptyText(initialValue);
  const [umlText, setUmlText] = useState(() => (hasInitialText ? initialValue : ''));
  const [encodedUml, setEncodedUml] = useState('');
  const [imageError, setImageError] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorMode>(() =>
    initialDiagramState || !hasInitialText ? 'visual' : 'text'
  );
  const [showPreview, setShowPreview] = useState(() => !initialDiagramState && hasInitialText);
  const [diagramState, setDiagramState] = useState<ClassDiagramState>(
    () => initialDiagramState ?? EMPTY_CLASS_DIAGRAM_STATE
  );
  const [diagramSeedKey, setDiagramSeedKey] = useState(() =>
    initialDiagramState ? JSON.stringify(initialDiagramState) : 'empty-diagram'
  );

  useEffect(() => {
    setUmlText(isNonEmptyText(initialValue) ? initialValue : '');
  }, [initialValue]);

  useEffect(() => {
    if (!initialDiagramState) {
      return;
    }
    if (initialDiagramState === diagramState) {
      return;
    }

    setDiagramState(initialDiagramState);
    setDiagramSeedKey(JSON.stringify(initialDiagramState));
  }, [diagramState, initialDiagramState]);

  useEffect(() => {
    if (!umlText.trim()) {
      setEncodedUml('');
      setImageError(false);
      return;
    }

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

  const visualUml = useMemo(
    () => (diagramState ? generateClassDiagramPlantUml(diagramState) : ''),
    [diagramState]
  );

  const imageUrl = encodedUml ? `https://www.plantuml.com/plantuml/svg/${encodedUml}` : '';

  const previewPanel = (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
          <p className="mt-1 text-xs text-slate-500">Render the current PlantUML output before saving.</p>
        </div>
      </div>
      <div
        className="overflow-auto p-4"
        style={{ minHeight: activeTab === 'visual' ? '240px' : height }}
      >
        {!umlText.trim() ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
            Add a class, interface, or PlantUML block to generate a preview.
          </div>
        ) : imageError ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-6 text-center text-sm text-rose-700">
            Error rendering diagram. Check the PlantUML syntax and try again.
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="UML Diagram Preview"
            className="mx-auto max-w-full h-auto"
            onError={() => setImageError(true)}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {readOnly ? 'Diagram workspace' : 'Diagram builder'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {activeTab === 'visual'
                ? 'Use the canvas for structure, then open the preview only when you want to verify the exported diagram.'
                : 'Paste or refine PlantUML directly, with preview available beside the editor.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveTab('visual')}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === 'visual'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Visual builder
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === 'text'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                PlantUML
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPreview((current) => !current)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                showPreview
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
              }`}
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          </div>
        </div>

        <div className="p-4">
          {activeTab === 'visual' ? (
            <div className="space-y-4">
              <ClassDiagramEditor
                key={diagramSeedKey}
                initialState={diagramState}
                onChange={handleDiagramChange}
                readOnly={readOnly}
                height={height}
              />
              {showPreview && previewPanel}
            </div>
          ) : (
            <div className={`grid gap-4 ${showPreview ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">PlantUML source</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Use class-diagram syntax directly when you need finer control than the visual builder provides.
                  </p>
                </div>
                <textarea
                  value={umlText}
                  onChange={(e) => handleChange(e.target.value)}
                  readOnly={readOnly}
                  className="min-h-[240px] w-full resize-y rounded-b-xl border-0 p-4 font-mono text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                  style={{ minHeight: height }}
                  placeholder={PLANTUML_EXAMPLE}
                />
              </div>
              {showPreview && previewPanel}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {activeTab === 'visual'
            ? 'Visual mode keeps the canvas primary and exports PlantUML in the background.'
            : 'PlantUML changes update the preview, so syntax issues are visible immediately.'}
        </p>
        <a
          href="https://plantuml.com/class-diagram"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Class diagram syntax reference
        </a>
      </div>

      {activeTab === 'visual' && umlText.trim().length > 0 && umlText !== visualUml && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          The canvas is the source of truth in visual mode. Open the PlantUML tab when you want to inspect or refine the exported text.
        </div>
      )}
    </div>
  );
}
