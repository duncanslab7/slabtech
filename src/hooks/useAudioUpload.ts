import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface UseAudioUploadOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UploadState {
  loading: boolean;
  uploadProgress: string;
  message: { type: 'success' | 'error'; text: string } | null;
}

export function useAudioUpload(options?: UseAudioUploadOptions) {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const uploadAudio = async (file: File, salespersonId: string) => {
    setLoading(true);
    setMessage(null);
    setUploadProgress('');

    try {
      if (!file) {
        throw new Error('Please select a file');
      }

      if (!salespersonId) {
        throw new Error('Please select a salesperson');
      }

      const maxSizeMB = 200;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error(`File size too large. Must be less than ${maxSizeMB}MB.`);
      }

      setUploadProgress('Uploading file to storage...');
      const supabase = createClient();

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      setUploadProgress('Processing audio...');
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: filePath,
          originalFilename: file.name,
          salespersonId: salespersonId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process audio');
      }

      const successMessage = {
        type: 'success' as const,
        text: 'Audio processed successfully! Your transcript has been saved.',
      };

      setMessage(successMessage);
      setUploadProgress('');

      if (options?.onSuccess) {
        options.onSuccess();
      }

      return { success: true };
    } catch (error: any) {
      const errorMessage = {
        type: 'error' as const,
        text: error.message || 'An error occurred',
      };

      setMessage(errorMessage);
      setUploadProgress('');

      if (options?.onError) {
        options.onError(error.message);
      }

      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = () => setMessage(null);

  return {
    loading,
    uploadProgress,
    message,
    uploadAudio,
    clearMessage,
  };
}
