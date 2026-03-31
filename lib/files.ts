// File handling utilities for uploads and processing

export const SUPPORTED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  content?: string; // For text-based files
}

export function isFileTypeSupported(type: string): boolean {
  return type in SUPPORTED_FILE_TYPES;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      resolve(content);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      resolve(content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function processUploadedFile(file: File): Promise<FileInfo> {
  if (!isFileTypeSupported(file.type)) {
    throw new Error(`File type ${file.type} is not supported`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}`
    );
  }

  let content: string | undefined;

  // For text-based files, read content
  if (
    file.type === 'text/plain' ||
    file.type === 'text/csv' ||
    file.type.includes('text/')
  ) {
    content = await readFileAsText(file);
  }

  return {
    id: generateFileId(),
    name: file.name,
    type: file.type,
    size: file.size,
    uploadedAt: new Date(),
    content,
  };
}

export function getFileIcon(
  type: string
): 'pdf' | 'doc' | 'sheet' | 'text' | 'image' | 'file' {
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('word') || type.includes('document')) return 'doc';
  if (type.includes('sheet') || type.includes('excel')) return 'sheet';
  if (type.includes('text') || type.includes('csv')) return 'text';
  if (type.includes('image')) return 'image';
  return 'file';
}
