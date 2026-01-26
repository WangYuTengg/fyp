import { useState, useEffect } from 'react';
import plantumlEncoder from 'plantuml-encoder';

type UMLEditorProps = {
  initialValue?: string;
  onChange?: (value: string) => void;
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
  onChange, 
  readOnly = false,
  height = '400px'
}: UMLEditorProps) {
  const [umlText, setUmlText] = useState(initialValue);
  const [encodedUml, setEncodedUml] = useState('');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setUmlText(initialValue);
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

  const imageUrl = `https://www.plantuml.com/plantuml/svg/${encodedUml}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Editor */}
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PlantUML Code
        </label>
        <textarea
          value={umlText}
          onChange={(e) => handleChange(e.target.value)}
          readOnly={readOnly}
          className="flex-1 font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          style={{ minHeight: height }}
          placeholder="Enter PlantUML code..."
        />
        <p className="mt-2 text-xs text-gray-500">
          Using PlantUML syntax.{' '}
          <a
            href="https://plantuml.com/class-diagram"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View documentation
          </a>
        </p>
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
