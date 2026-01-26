import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

type FileUploadProps = {
  onFileSelect: (file: File) => void;
  currentFileUrl?: string | null;
  disabled?: boolean;
  accept?: string;
  maxSizeMB?: number;
};

export function FileUpload({
  onFileSelect,
  currentFileUrl,
  disabled = false,
  accept = '.png,.jpg,.jpeg,.svg,.puml',
  maxSizeMB = 5,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setError(null);

    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return false;
    }

    // Check file type
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const allowedExtensions = accept.split(',').map((ext) => ext.trim());
    if (!allowedExtensions.includes(extension)) {
      setError(`File type not allowed. Allowed: ${accept}`);
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    setFileName(file.name);
    onFileSelect(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {accept.split(',').join(', ')} (max {maxSizeMB}MB)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {fileName && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-2">
          <span className="font-medium">Selected:</span> {fileName}
        </div>
      )}

      {preview && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <img src={preview} alt="Preview" className="w-full h-auto max-h-96 object-contain" />
        </div>
      )}

      {currentFileUrl && !preview && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <img
            src={currentFileUrl}
            alt="Uploaded file"
            className="w-full h-auto max-h-96 object-contain"
          />
        </div>
      )}
    </div>
  );
}
