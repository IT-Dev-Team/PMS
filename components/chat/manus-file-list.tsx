'use client';

import { useState } from 'react';
import ManusDownloadButton from './ManusDownloadButton';

interface ManusFile {
  id: string;
  path: string;
  name: string;
  type: 'word' | 'powerpoint' | 'pdf';
  size?: string;
  createdAt?: string;
}

interface ManusFileListProps {
  files: ManusFile[];
  title?: string;
  onDownloadSuccess?: (file: ManusFile) => void;
}

export default function ManusFileList({ 
  files, 
  title = 'Generated Files', 
  onDownloadSuccess 
}: ManusFileListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const getFileIcon = (type: ManusFile['type']) => {
    switch (type) {
      case 'word':
        return (
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'powerpoint':
        return (
          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'pdf':
        return (
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No files available for download
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      
      <ul className="divide-y divide-gray-200">
        {files.map((file) => (
          <li key={file.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {getFileIcon(file.type)}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  {file.size && (
                    <p className="text-xs text-gray-500">{file.size}</p>
                  )}
                  {file.createdAt && (
                    <p className="text-xs text-gray-400">{file.createdAt}</p>
                  )}
                </div>
              </div>
              
              <ManusDownloadButton
                filePath={file.path}
                fileName={file.name}
                buttonText="Download"
                variant="primary"
                size="small"
                showProgress={downloadingId === file.id}
                onSuccess={() => {
                  setDownloadingId(null);
                  if (onDownloadSuccess) onDownloadSuccess(file);
                }}
                onError={() => setDownloadingId(null)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}