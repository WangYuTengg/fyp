import { useState, useMemo } from 'react';
import plantumlEncoder from 'plantuml-encoder';

type UMLViewerProps = {
  umlText: string;
  title?: string;
  className?: string;
};

export function UMLViewer({ umlText, title, className = '' }: UMLViewerProps) {
  const [imageError, setImageError] = useState(false);

  const encodedUml = useMemo(() => {
    try {
      return plantumlEncoder.encode(umlText);
    } catch (error) {
      console.error('Failed to encode UML:', error);
      return '';
    }
  }, [umlText]);

  const imageUrl = `https://www.plantuml.com/plantuml/svg/${encodedUml}`;

  return (
    <div className={`border border-gray-300 rounded-md bg-white p-4 ${className}`}>
      {title && (
        <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      )}
      {imageError ? (
        <div className="flex items-center justify-center py-8 text-red-600">
          <p>Error rendering diagram</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <img
            src={imageUrl}
            alt={title || 'UML Diagram'}
            className="max-w-full h-auto"
            onError={() => setImageError(true)}
          />
        </div>
      )}
    </div>
  );
}
