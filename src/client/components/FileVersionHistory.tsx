import { useState } from 'react';

type FileVersion = {
  url: string;
  uploadedAt: Date;
  fileName: string;
};

type FileVersionHistoryProps = {
  versions: FileVersion[];
  currentFileUrl?: string | null;
};

export function FileVersionHistory({ versions, currentFileUrl }: FileVersionHistoryProps) {
  const [showHistory, setShowHistory] = useState(false);

  if (versions.length <= 1 && !currentFileUrl) {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShowHistory(!showHistory)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        {showHistory ? '▼' : '▶'} Version History ({versions.length} upload{versions.length !== 1 ? 's' : ''})
      </button>

      {showHistory && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {currentFileUrl && (
              <div className="p-3 bg-green-50 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Current Version</p>
                    <p className="text-xs text-gray-500 mt-1">Active submission</p>
                  </div>
                  <a
                    href={currentFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    View →
                  </a>
                </div>
              </div>
            )}

            {versions.map((version, index) => {
              const isCurrent = version.url === currentFileUrl;
              
              return (
                <div
                  key={`${version.url}-${index}`}
                  className={`p-3 ${isCurrent ? 'bg-green-50' : 'bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {version.fileName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {version.uploadedAt.toLocaleString()}
                        {isCurrent && <span className="ml-2 text-green-600">(Current)</span>}
                      </p>
                    </div>
                    <a
                      href={version.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      View →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
