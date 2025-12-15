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

      const maxSizeMB = 400;
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

      setUploadProgress('Preparing audio for transcription...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setUploadProgress('Starting transcription with PII redaction...');
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: filePath,
          originalFilename: file.name,
          salespersonId: salespersonId,
        }),
      });

      // Get response as text first, then try to parse as JSON
      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // If JSON parsing fails, show the raw text
        throw new Error(`Server error (non-JSON response): ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process audio');
      }

      const transcriptId = data.transcriptId;

      // Poll for completion
      setUploadProgress('Transcribing audio (this may take several minutes)...');

      let isComplete = false;
      let pollCount = 0;
      const maxPolls = 180; // 15 minutes max (5 second intervals)

      while (!isComplete && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between polls

        const statusResponse = await fetch(`/api/transcripts/${transcriptId}/status`);
        const statusData = await statusResponse.json();

        if (statusData.status === 'completed') {
          isComplete = true;
          setUploadProgress('Finalizing transcript...');
          await new Promise(resolve => setTimeout(resolve, 500));

          const successMessage = {
            type: 'success' as const,
            text: 'Audio processed successfully! Your transcript has been saved with speaker labels and PII redaction applied.',
          };

          setMessage(successMessage);
          setUploadProgress('');

          if (options?.onSuccess) {
            options.onSuccess();
          }

          return { success: true };
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error || 'Transcription failed');
        }

        // Update progress message based on file size
        pollCount++;
        const elapsed = pollCount * 5;
        if (elapsed % 30 === 0) {
          setUploadProgress(`Still transcribing... (${Math.floor(elapsed / 60)} min ${elapsed % 60} sec)`);
        }
      }

      if (pollCount >= maxPolls) {
        throw new Error('Transcription timeout - please check back later');
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
