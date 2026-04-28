import { useState } from 'react';

interface DownloadOptions {
  fileId?: string;
  sandboxPath?: string;
  fileName: string;
  messageId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface DownloadState {
  isLoading: boolean;
  error: string | null;
  progress: number;
}

export function useManusDownload() {
  const [state, setState] = useState<DownloadState>({
    isLoading: false,
    error: null,
    progress: 0,
  });

  const downloadFile = async ({ fileId, sandboxPath, fileName, messageId, onSuccess, onError }: DownloadOptions) => {
    if (!fileId && !sandboxPath) {
      const error = 'Either fileId or sandboxPath is required';
      setState({ isLoading: false, error, progress: 0 });
      if (onError) onError(error);
      return;
    }

    setState({ isLoading: true, error: null, progress: 0 });

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 200);

      // Make API request to download from Manus
      const response = await fetch('/api/chats/messages?action=download-from-manus', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          sandboxPath,
          fileName,
          messageId,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Get blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Update state
      setState({ isLoading: false, error: null, progress: 100 });
      
      // Call success callback
      if (onSuccess) onSuccess();
      
      // Reset progress after delay
      setTimeout(() => {
        setState(prev => ({ ...prev, progress: 0 }));
      }, 1000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setState({ isLoading: false, error: errorMessage, progress: 0 });
      if (onError) onError(errorMessage);
    }
  };

  const resetError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return {
    downloadFile,
    isLoading: state.isLoading,
    error: state.error,
    progress: state.progress,
    resetError,
  };
}