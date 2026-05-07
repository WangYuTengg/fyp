import { useMemo, useState } from 'react';
import plantumlEncoder from 'plantuml-encoder';
import { ClassDiagramEditor } from './uml/ClassDiagramEditor';
import {
  generateClassDiagramPlantUml,
  normalizeClassDiagramState,
  type ClassDiagramState,
} from './uml/classDiagram';
import { SequenceDiagramEditor } from './uml/SequenceDiagramEditor';
import {
  generateSequenceDiagramPlantUml,
  normalizeSequenceDiagramState,
  type SequenceDiagramState,
} from './uml/sequenceDiagram';
import { validatePlantUml } from './uml/plantUmlValidation';
import {
  parseClassDiagramPlantUml,
  parseSequenceDiagramPlantUml,
} from './uml/plantUmlParser';

export type UmlDiagramType = 'class' | 'sequence';

export type UmlEditorState = ClassDiagramState | SequenceDiagramState;

type UMLEditorProps = {
  diagramType?: UmlDiagramType;
  initialValue?: string;
  initialDiagramState?: UmlEditorState;
  onChange?: (value: string, editorState?: UmlEditorState) => void;
  readOnly?: boolean;
  height?: string;
};

type UMLEditorInnerProps = {
  diagramType: UmlDiagramType;
  initialValue: string;
  initialDiagramState?: UmlEditorState;
  onChange?: (value: string, editorState?: UmlEditorState) => void;
  readOnly: boolean;
  height: string;
};

type EditorMode = 'visual' | 'text' | 'preview';

const EMPTY_CLASS_DIAGRAM_STATE: ClassDiagramState = { nodes: [], edges: [] };
const EMPTY_SEQUENCE_DIAGRAM_STATE: SequenceDiagramState = { lifelines: [], messages: [] };

const CLASS_PLANTUML_EXAMPLE = `@startuml
class Student {
  + matricNo: String
  + submitDiagram()
}

Student --> "1" Assignment : completes
@enduml`;

const SEQUENCE_PLANTUML_EXAMPLE = `@startuml
actor User
participant Browser
database Database

User -> Browser : Enter credentials
Browser -> Database : query
Database --> Browser : result
Browser --> User : display
@enduml`;

const SYNTAX_REFERENCE_URL: Record<UmlDiagramType, string> = {
  class: 'https://plantuml.com/class-diagram',
  sequence: 'https://plantuml.com/sequence-diagram',
};

const SYNTAX_REFERENCE_LABEL: Record<UmlDiagramType, string> = {
  class: 'Class diagram syntax reference',
  sequence: 'Sequence diagram syntax reference',
};

const isNonEmptyText = (value?: string) => Boolean(value?.trim().length);

const normaliseInitialState = (
  diagramType: UmlDiagramType,
  initial: UmlEditorState | undefined
): UmlEditorState => {
  if (!initial) {
    return diagramType === 'sequence' ? EMPTY_SEQUENCE_DIAGRAM_STATE : EMPTY_CLASS_DIAGRAM_STATE;
  }
  return diagramType === 'sequence'
    ? normalizeSequenceDiagramState(initial)
    : normalizeClassDiagramState(initial);
};

const generateVisualPlantUml = (diagramType: UmlDiagramType, state: UmlEditorState): string => {
  return diagramType === 'sequence'
    ? generateSequenceDiagramPlantUml(state as SequenceDiagramState)
    : generateClassDiagramPlantUml(state as ClassDiagramState);
};

function UMLEditorInner({
  diagramType,
  initialValue,
  initialDiagramState,
  onChange,
  readOnly,
  height,
}: UMLEditorInnerProps) {
  const hasInitialText = isNonEmptyText(initialValue);
  const [umlText, setUmlText] = useState(initialValue);
  const [activeTab, setActiveTab] = useState<EditorMode>(() =>
    initialDiagramState || !hasInitialText ? 'visual' : 'preview'
  );
  const [diagramState, setDiagramState] = useState<UmlEditorState>(() =>
    normaliseInitialState(diagramType, initialDiagramState)
  );
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const previewState = useMemo(() => {
    if (!umlText.trim()) {
      return { encodedUml: '', hasEncodingError: false };
    }
    try {
      return { encodedUml: plantumlEncoder.encode(umlText), hasEncodingError: false };
    } catch (error) {
      console.error('Failed to encode UML:', error);
      return { encodedUml: '', hasEncodingError: true };
    }
  }, [umlText]);

  const validationIssues = useMemo(
    () => validatePlantUml(umlText, diagramType),
    [umlText, diagramType]
  );
  const errorCount = validationIssues.filter((issue) => issue.severity === 'error').length;
  const warningCount = validationIssues.filter((issue) => issue.severity === 'warning').length;

  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);

  const handleChange = (value: string) => {
    setUmlText(value);
    onChange?.(value);
    setSyncWarnings([]);
  };

  const handleDiagramChange = (state: UmlEditorState, plantUml: string) => {
    setDiagramState(state);
    setUmlText(plantUml);
    onChange?.(plantUml, state);
    setSyncWarnings([]);
  };

  const syncFromText = () => {
    if (!umlText.trim()) return;
    const result =
      diagramType === 'sequence'
        ? parseSequenceDiagramPlantUml(umlText)
        : parseClassDiagramPlantUml(umlText);
    setDiagramState(result.state);
    setSyncWarnings(result.warnings);
    onChange?.(umlText, result.state);
  };

  const visualUml = useMemo(
    () => (diagramState ? generateVisualPlantUml(diagramType, diagramState) : ''),
    [diagramState, diagramType]
  );

  const imageUrl = previewState.encodedUml
    ? `https://www.plantuml.com/plantuml/svg/${previewState.encodedUml}`
    : '';
  const imageError = previewState.hasEncodingError || failedImageUrl === imageUrl;

  const placeholder =
    diagramType === 'sequence' ? SEQUENCE_PLANTUML_EXAMPLE : CLASS_PLANTUML_EXAMPLE;

  const previewPanel = (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
        <p className="mt-1 text-xs text-slate-500">Render the current PlantUML output before saving.</p>
      </div>
      <div className="overflow-auto p-4" style={{ minHeight: height }}>
        {!umlText.trim() ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
            {diagramType === 'sequence'
              ? 'Add a lifeline or PlantUML block to generate a preview.'
              : 'Add a class, interface, or PlantUML block to generate a preview.'}
          </div>
        ) : imageError ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-6 text-center text-sm text-rose-700">
            Error rendering diagram. Check the PlantUML syntax and try again.
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="UML Diagram Preview"
            className="mx-auto h-auto max-w-full"
            onError={() => setFailedImageUrl(imageUrl)}
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
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                {diagramType === 'sequence' ? 'Sequence' : 'Class'}
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {activeTab === 'visual'
                ? diagramType === 'sequence'
                  ? 'Define lifelines and order the messages between them.'
                  : 'Use the canvas for structure and relationships.'
                : activeTab === 'text'
                  ? 'Paste or refine PlantUML directly when you need precise syntax control.'
                  : 'Review the rendered diagram without compressing the editor layout.'}
            </p>
          </div>

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
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === 'preview'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        <div className="p-4">
          {activeTab === 'visual' ? (
            diagramType === 'sequence' ? (
              <SequenceDiagramEditor
                initialState={diagramState as SequenceDiagramState}
                onChange={handleDiagramChange}
                readOnly={readOnly}
                height={height}
              />
            ) : (
              <ClassDiagramEditor
                initialState={diagramState as ClassDiagramState}
                onChange={handleDiagramChange}
                readOnly={readOnly}
                height={height}
              />
            )
          ) : activeTab === 'text' ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">PlantUML source</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {diagramType === 'sequence'
                      ? 'Use sequence-diagram syntax directly when you need fine control.'
                      : 'Use class-diagram syntax directly when you need finer control than the visual builder provides.'}
                  </p>
                </div>
                {validationIssues.length > 0 ? (
                  <div className="flex items-center gap-2 text-xs">
                    {errorCount > 0 ? (
                      <span className="rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-700">
                        {errorCount} error{errorCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {warningCount > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">
                        {warningCount} warning{warningCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                ) : umlText.trim().length > 0 ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                    No issues detected
                  </span>
                ) : null}
              </div>
              <textarea
                value={umlText}
                onChange={(e) => handleChange(e.target.value)}
                readOnly={readOnly}
                className="min-h-[240px] w-full resize-y border-0 p-4 font-mono text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                style={{ minHeight: height }}
                placeholder={placeholder}
              />
              {validationIssues.length > 0 ? (
                <ul className="divide-y divide-slate-100 border-t border-slate-200 text-xs">
                  {validationIssues.map((issue, idx) => (
                    <li
                      key={`${issue.line}-${idx}`}
                      className={`flex items-start gap-2 px-4 py-2 ${
                        issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          issue.severity === 'error'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                        aria-hidden="true"
                      >
                        {issue.severity === 'error' ? '!' : '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] text-slate-500">line {issue.line}</span>{' '}
                        <span>{issue.message}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            previewPanel
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {activeTab === 'visual'
            ? 'Visual mode is the source of truth and exports PlantUML in the background.'
            : activeTab === 'text'
              ? 'PlantUML changes update the preview tab, so syntax issues are visible immediately.'
              : 'Preview mode lets you inspect the rendered diagram without compressing the editor layout.'}
        </p>
        <a
          href={SYNTAX_REFERENCE_URL[diagramType]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          {SYNTAX_REFERENCE_LABEL[diagramType]}
        </a>
      </div>

      {activeTab === 'visual' && umlText.trim().length > 0 && umlText !== visualUml && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p>
            PlantUML text differs from the visual builder. The visual builder is the source of truth on save —
            click <strong>Sync from text</strong> to import the latest text into the canvas.
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={syncFromText}
              className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Sync from text
            </button>
          )}
        </div>
      )}

      {syncWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="font-semibold">Imported from text with {syncWarnings.length} warning{syncWarnings.length === 1 ? '' : 's'}:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {syncWarnings.map((warning, idx) => (
              <li key={`${idx}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function UMLEditor({
  diagramType = 'class',
  initialValue = '',
  initialDiagramState,
  onChange,
  readOnly = false,
  height = '400px',
}: UMLEditorProps) {
  const normalizedInitialValue = isNonEmptyText(initialValue) ? initialValue : '';

  return (
    <UMLEditorInner
      diagramType={diagramType}
      initialValue={normalizedInitialValue}
      initialDiagramState={initialDiagramState}
      onChange={onChange}
      readOnly={readOnly}
      height={height}
    />
  );
}
