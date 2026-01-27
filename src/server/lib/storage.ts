import { supabase } from './supabase.js';

const STORAGE_BUCKET = 'submissions';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'text/plain', // for .puml files
];

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.puml'];

export type UploadResult = {
  path: string;
  signedUrl: string;
};

/**
 * Validate file type and size
 */
export function validateFile(file: {
  size: number;
  type: string;
  name: string;
}): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // Check file extension
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check MIME type (if available)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `MIME type not allowed. File type: ${file.type}`,
    };
  }

  return { valid: true };
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  userId: string,
  submissionId: string,
  questionId: string,
  file: Buffer,
  fileName: string
): Promise<UploadResult> {
  // Create unique file path: submissions/{userId}/{submissionId}/{questionId}/{timestamp}-{filename}
  const timestamp = Date.now();
  const filePath = `${userId}/${submissionId}/${questionId}/${timestamp}-${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      contentType: getContentType(fileName),
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get signed URL (valid for 1 hour)
  const signedUrl = await getSignedUrl(filePath);

  return {
    path: filePath,
    signedUrl,
  };
}

/**
 * Get signed URL for file (valid for 1 hour)
 */
export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 3600); // 1 hour

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete file from storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get content type from file extension
 */
function getContentType(fileName: string): string {
  const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.puml':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}
