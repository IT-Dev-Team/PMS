'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { SUPPORTED_FILE_TYPES, processUploadedFile, FileInfo, formatFileSize } from '@/lib/files';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFilesSelected: (files: FileInfo[]) => void;
  disabled?: boolean;
}

export function FileUpload({ onFilesSelected, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    setLoading(true);
    setError(null);

    try {
      const processedFiles: FileInfo[] = [];

      for (const file of files) {
        const processed = await processUploadedFile(file);
        processedFiles.push(processed);
      }

      setUploadedFiles((prev) => [...prev, ...processedFiles]);
      onFilesSelected(processedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const acceptedTypes = Object.keys(SUPPORTED_FILE_TYPES).join(',');

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          disabled={disabled || loading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-accent/30 rounded-lg cursor-pointer transition-colors ${
            disabled || loading
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:border-accent hover:bg-accent/5'
          }`}
        >
          <Upload className="w-5 h-5 text-accent" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {loading ? 'Uploading...' : 'Drag files or click to upload'}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, Word, Excel, Images, CSV, Text
            </p>
          </div>
        </label>
      </div>

      {error && (
        <div className="p-3 rounded bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {uploadedFiles.length} File{uploadedFiles.length !== 1 ? 's' : ''}{' '}
            Uploaded
          </p>
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 rounded bg-card border border-border"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm truncate text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="ml-2 p-1 hover:bg-background rounded transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
