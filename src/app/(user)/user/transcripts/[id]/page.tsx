'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { TranscriptWithConversations } from '@/components/transcripts/TranscriptWithConversations';
import type { ObjectionType, ConversationCategory } from '@/utils/conversationAnalysis';

interface TranscriptData {
  id: string;
  created_at: string;
  salesperson_name: string;
  original_filename: string;
  redaction_config_used: string;
  transcript_redacted: {
    words?: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
      speaker?: string;
    }>;
    utterances?: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
      speaker: string;
      words: Array<{
        text: string;
        start: number;
        end: number;
        confidence: number;
        speaker?: string;
      }>;
    }>;
    audio_url?: string;
  };
  file_storage_path: string;
}

interface Conversation {
  id: string;
  conversation_number: number;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  word_count: number;
  category: ConversationCategory;
  objections: ObjectionType[];
}

export default function UserTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const fetchTranscript = async () => {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
      }

      // First, fetch the transcript to get salesperson_name
      const { data: transcriptData, error: fetchError } = await supabase
        .from('transcripts')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !transcriptData) {
        setError('Transcript not found');
        setLoading(false);
        return;
      }

      // Check if user has access to this transcript (via assignment OR subscription)
      // 1. Check for direct assignment
      const { data: assignment } = await supabase
        .from('transcript_assignments')
        .select('id')
        .eq('transcript_id', id)
        .eq('user_id', user?.id)
        .single();

      let hasAccess = !!assignment;

      // 2. If not directly assigned, check if subscribed to this salesperson
      if (!hasAccess) {
        const { data: subscription } = await supabase
          .from('salesperson_subscriptions')
          .select('id')
          .eq('user_id', user?.id)
          .eq('salesperson_name', transcriptData.salesperson_name)
          .single();

        hasAccess = !!subscription;
      }

      if (!hasAccess) {
        setError('You do not have access to this transcript');
        setLoading(false);
        return;
      }

      setTranscript(transcriptData);

      // Fetch conversations for this transcript
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('*')
        .eq('transcript_id', id)
        .order('conversation_number', { ascending: true });

      if (conversationsData) {
        setConversations(conversationsData);
      }

      // Get signed URL for audio playback (not download)
      // Note: Users cannot download, only listen via the audio player
      const audioPath = transcriptData.file_storage_path.replace(/\.[^/.]+$/, '') + '_redacted.mp3';
      const { data: signedUrlData } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(`redacted/${audioPath}`, 3600);

      if (signedUrlData?.signedUrl) {
        setAudioUrl(signedUrlData.signedUrl);
      } else {
        // Fallback to original audio if redacted not available
        const { data: originalUrlData } = await supabase.storage
          .from('call-recordings')
          .createSignedUrl(transcriptData.file_storage_path, 3600);
        if (originalUrlData?.signedUrl) {
          setAudioUrl(originalUrlData.signedUrl);
        }
      }

      setLoading(false);
    };

    fetchTranscript();
  }, [id]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const getTranscriptText = () => {
    if (!transcript?.transcript_redacted) {
      return 'No transcript available';
    }

    const data = transcript.transcript_redacted as any;

    // Try to get text from various possible fields
    if (data.text) {
      return data.text;
    }

    if (data.redacted_text) {
      return data.redacted_text;
    }

    // If we have utterances (speaker diarization), format as text
    if (data.utterances && Array.isArray(data.utterances) && data.utterances.length > 0) {
      return data.utterances
        .map((utterance: any) => `Speaker ${utterance.speaker}: ${utterance.text}`)
        .join('\n\n');
    }

    // Fallback to words
    if (data.words && Array.isArray(data.words) && data.words.length > 0) {
      return data.words.map((w: any) => w.text || w.word || '').join(' ');
    }

    return 'No transcript content available';
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-success-gold"></div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="bg-pure-white border-b-2 border-midnight-blue">
          <nav className="max-w-6xl mx-auto px-6 py-2">
            <div className="flex items-center justify-between">
              <Link href="/">
                <Image src="/slab-logo.png" alt="SLAB" width={60} height={60} className="h-[60px] w-auto" priority />
              </Link>
            </div>
          </nav>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
            <Link href="/user/dashboard" className="mt-4 inline-block text-success-gold hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-pure-white border-b-2 border-midnight-blue">
        <nav className="max-w-6xl mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image src="/slab-logo.png" alt="SLAB" width={60} height={60} className="h-[60px] w-auto" priority />
            </Link>

            <div className="flex items-center gap-6">
              <span className="text-sm text-steel-gray">{userEmail}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-steel-gray hover:text-success-gold transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Back Link */}
        <Link
          href="/user/dashboard"
          className="inline-flex items-center text-steel-gray hover:text-success-gold mb-4 sm:mb-6 text-sm sm:text-base"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Transcript Info */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-midnight-blue text-white px-4 sm:px-6 py-3 sm:py-4">
            <h1 className="text-base sm:text-xl font-bold break-words">{transcript?.original_filename}</h1>
            <div className="flex flex-col sm:flex-row sm:gap-6 mt-2 text-xs sm:text-sm text-gray-300 gap-1">
              <span>
                {transcript?.created_at
                  ? new Date(transcript.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : ''}
              </span>
              <span>Salesperson: {transcript?.salesperson_name}</span>
            </div>
          </div>

          {/* Conversations & Interactive Audio Player */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            {audioUrl && transcript?.transcript_redacted ? (
              <TranscriptWithConversations
                conversations={conversations}
                downloadUrl={audioUrl}
                words={(transcript.transcript_redacted as any)?.words || []}
                piiMatches={(transcript.transcript_redacted as any)?.pii_matches || []}
                originalFilename={transcript.original_filename}
                transcriptText={getTranscriptText()}
                redactionConfigUsed={transcript.redaction_config_used}
                transcriptData={transcript.transcript_redacted}
              />
            ) : (
              <div className="text-center text-gray-500 py-8">
                No audio or transcript available
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t text-xs sm:text-sm text-gray-500">
            <p>Redaction config: {transcript?.redaction_config_used || 'N/A'}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
