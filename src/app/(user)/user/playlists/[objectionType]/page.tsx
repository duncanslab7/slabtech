'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlaylistAudioPlayer } from '@/components/playlists/PlaylistAudioPlayer';

interface Conversation {
  id: string;
  conversation_number: number;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  word_count: number;
  category: string;
  objections: string[];
  objections_with_text: Record<string, string[]>;
  objection_timestamps: Record<string, number[]>;
  audioUrl: string;
  originalFilename: string;
  salespersonName: string;
  transcriptCreatedAt: string;
  transcript_id: string;
}

export default function UserPlaylistPage({ params }: { params: Promise<{ objectionType: string }> }) {
  const resolvedParams = use(params);
  const { objectionType } = resolvedParams;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        const response = await fetch(`/api/user/playlists/${objectionType}`);

        if (!response.ok) {
          console.error('API response not OK:', response.status, response.statusText);
        }

        const data = await response.json();
        console.log('Playlist API response:', data);

        if (data.error) {
          console.error('API returned error:', data.error);
        }

        if (data.conversations) {
          console.log(`Setting ${data.conversations.length} conversations`);
          setConversations(data.conversations);
        } else {
          console.warn('No conversations in response:', data);
        }
      } catch (error) {
        console.error('Error fetching playlist:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [objectionType]);

  const currentConversation = conversations[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < conversations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const objectionLabels: Record<string, string> = {
    diy: 'DIY Objections',
    spouse: 'Spouse Objections',
    price: 'Price Objections',
    competitor: 'Competitor Objections',
    delay: 'Delay/Timing Objections',
    not_interested: 'Not Interested',
    no_problem: 'No Problem Objections',
    no_soliciting: 'No Soliciting'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-success-gold"></div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/user/dashboard"
            className="inline-flex items-center text-success-gold hover:text-amber-600 mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>

          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h1 className="text-2xl font-bold text-midnight-blue mb-4">
              {objectionLabels[objectionType] || objectionType}
            </h1>
            <p className="text-steel-gray">No conversations found for this objection type.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Link
          href="/user/dashboard"
          className="inline-flex items-center text-success-gold hover:text-amber-600 mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-midnight-blue mb-2">
            {objectionLabels[objectionType] || objectionType}
          </h1>
          <p className="text-steel-gray">
            {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'} •
            Currently playing {currentIndex + 1} of {conversations.length}
          </p>
        </div>

        {/* Audio Player */}
        <PlaylistAudioPlayer
          conversation={currentConversation}
          currentIndex={currentIndex}
          totalCount={conversations.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />

        {/* Playlist */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-bold text-midnight-blue mb-4">Playlist</h2>
          <div className="space-y-2">
            {conversations.map((conv, index) => (
              <button
                key={conv.id}
                onClick={() => setCurrentIndex(index)}
                className={`w-full text-left p-4 rounded-lg transition-colors ${
                  index === currentIndex
                    ? 'bg-success-gold/10 border-2 border-success-gold'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-midnight-blue">
                        Conversation {conv.conversation_number}
                      </span>
                      {index === currentIndex && (
                        <span className="px-2 py-0.5 bg-success-gold text-white text-xs font-medium rounded">
                          Playing
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-steel-gray">
                      {conv.salespersonName} • {conv.originalFilename}
                    </div>
                    <div className="text-xs text-steel-gray mt-1">
                      {Math.floor(conv.duration_seconds / 60)}:{(conv.duration_seconds % 60).toString().padStart(2, '0')} •{' '}
                      {conv.word_count} words
                    </div>
                  </div>
                  <svg
                    className={`w-6 h-6 flex-shrink-0 ${
                      index === currentIndex ? 'text-success-gold' : 'text-gray-400'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
