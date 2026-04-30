import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface UseAudioUploadOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UploadMetadata {
  actualSalesCount?: number;
  expectedCustomerCount?: number;
  areaType?: string;
  estimatedDurationHours?: number;
  uploadNotes?: string;
}

const POLL_INTERVAL_MS = 15_000;
const MAX_POLL_ATTEMPTS = 360; // 90 minutes max — covers AssemblyAI processing for ~3-hour recordings

export function useAudioUpload(options?: UseAudioUploadOptions) {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const uploadAudio = async (file: File, salespersonId: string, metadata?: UploadMetadata) => {
    setLoading(true);
    setMessage(null);
    setUploadProgress('');

    try {
      if (!file)          throw new Error('Please select a file');
      if (!salespersonId) throw new Error('Please select a salesperson');

      const maxSizeBytes = 400 * 1024 * 1024;
      if (file.size > maxSizeBytes) throw new Error('File size too large. Must be less than 400MB.');

      // ── Step 1: upload file to Supabase storage ──────────────────────────
      setUploadProgress('Uploading file to storage...');
      const supabase = createClient();

      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(`Failed to upload file: ${uploadError.message}`);

      // ── Step 2: submit to AssemblyAI and get transcript ID ───────────────
      setUploadProgress('Submitting to transcription service...');

      const { data: { session } } = await supabase.auth.getSession();

      const submitResp = await fetch('/api/process-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          filePath: fileName,
          originalFilename: file.name,
          salespersonId,
          metadata,
        }),
      });

      const submitText = await submitResp.text();
      let submitData: any;
      try { submitData = JSON.parse(submitText); }
      catch { throw new Error(`Server error: ${submitText.substring(0, 200)}`); }

      if (!submitResp.ok) throw new Error(submitData.error || 'Failed to submit audio');

      const { transcriptId } = submitData;
      if (!transcriptId) throw new Error('No transcript ID returned from server');

      // ── Step 3: poll /api/transcripts/:id/status ─────────────────────────
      setUploadProgress('Transcribing audio (5–25 min depending on file size)...');

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        // Refresh session token before each poll so it never expires mid-wait
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        const statusResp = await fetch(`/api/transcripts/${transcriptId}/status`, {
          headers: currentSession?.access_token
            ? { 'Authorization': `Bearer ${currentSession.access_token}` }
            : {},
        });

        const statusData = await statusResp.json();

        if (statusData.status === 'completed') {
          const piiInfo = statusData.piiMatchCount !== undefined
            ? ` (${statusData.piiMatchCount} PII items redacted)`
            : '';
          setMessage({
            type: 'success',
            text: `Audio processed successfully${piiInfo}! Your transcript has been saved with speaker labels and PII redaction applied.`,
          });
          setUploadProgress('');
          options?.onSuccess?.();
          return { success: true };
        }

        if (statusData.status === 'error') {
          throw new Error(statusData.error || 'Processing failed');
        }

        // Update progress message based on what the server reports
        if (statusData.message?.includes('Applying') || statusData.message?.includes('redaction')) {
          setUploadProgress('Applying PII redaction and analyzing conversations...');
        } else if (statusData.message?.includes('Transcrib')) {
          setUploadProgress('Transcribing audio (5–25 min depending on file size)...');
        }
      }

      throw new Error('Polling timed out after 90 minutes. Open the transcript from the dashboard and click "Check Status / Retry" to resume processing.');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' });
      setUploadProgress('');
      options?.onError?.(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = () => setMessage(null);

  return { loading, uploadProgress, message, uploadAudio, clearMessage };
}
