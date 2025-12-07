'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';

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

export default function UserTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
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

      // Check if user has access to this transcript
      const { data: assignment } = await supabase
        .from('transcript_assignments')
        .select('id')
        .eq('transcript_id', id)
        .eq('user_id', user?.id)
        .single();

      if (!assignment) {
        setError('You do not have access to this transcript');
        setLoading(false);
        return;
      }

      // Fetch transcript
      const { data, error: fetchError } = await supabase
        .from('transcripts')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        setError('Transcript not found');
        setLoading(false);
        return;
      }

      setTranscript(data);

      // Get signed URL for audio playback (not download)
      // Note: Users cannot download, only listen via the audio player
      const audioPath = data.file_storage_path.replace(/\.[^/.]+$/, '') + '_redacted.mp3';
      const { data: signedUrlData } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(`redacted/${audioPath}`, 3600);

      if (signedUrlData?.signedUrl) {
        setAudioUrl(signedUrlData.signedUrl);
      } else {
        // Fallback to original audio if redacted not available
        const { data: originalUrlData } = await supabase.storage
          .from('call-recordings')
          .createSignedUrl(data.file_storage_path, 3600);
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

  const formatTranscript = () => {
    if (!transcript?.transcript_redacted) return null;

    const data = transcript.transcript_redacted;

    // If we have utterances (speaker diarization), use those
    if (data.utterances && data.utterances.length > 0) {
      return data.utterances.map((utterance, index) => (
        <div key={index} className="mb-4">
          <span className="font-semibold text-success-gold">
            Speaker {utterance.speaker}:
          </span>
          <p className="text-charcoal ml-4">{utterance.text}</p>
        </div>
      ));
    }

    // Fallback to words
    if (data.words && data.words.length > 0) {
      const text = data.words.map(w => w.text).join(' ');
      return <p className="text-charcoal whitespace-pre-wrap">{text}</p>;
    }

    return <p className="text-gray-500 italic">No transcript content available</p>;
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
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/user/dashboard"
          className="inline-flex items-center text-steel-gray hover:text-success-gold mb-6"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Transcript Info */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-midnight-blue text-white px-6 py-4">
            <h1 className="text-xl font-bold">{transcript?.original_filename}</h1>
            <div className="flex gap-6 mt-2 text-sm text-gray-300">
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

          {/* Audio Player */}
          {audioUrl && (
            <div className="px-6 py-4 bg-gray-50 border-b">
              <p className="text-sm font-medium text-midnight-blue mb-2">Listen to Recording</p>
              <audio
                controls
                className="w-full"
                controlsList="nodownload"
                src={audioUrl}
              >
                Your browser does not support the audio element.
              </audio>
              <p className="text-xs text-gray-500 mt-1">
                Audio playback only. Downloads are disabled.
              </p>
            </div>
          )}

          {/* Transcript Content */}
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-midnight-blue mb-4">Transcript</h2>
            <div className="prose max-w-none">
              {formatTranscript()}
            </div>
          </div>

          {/* Metadata */}
          <div className="px-6 py-4 bg-gray-50 border-t text-sm text-gray-500">
            <p>Redaction config: {transcript?.redaction_config_used || 'N/A'}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
