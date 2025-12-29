'use client';

import { useState, useRef, useEffect } from 'react';

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
}

interface PlaylistAudioPlayerProps {
  conversation: Conversation;
  currentIndex: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
  transcriptId?: string; // For logging streak activities
}

export function PlaylistAudioPlayer({
  conversation,
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
  transcriptId
}: PlaylistAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const hasLoggedStreak = useRef(false); // Track if we've logged a streak for this session

  // Reset audio when conversation changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = conversation.start_time;
      setCurrentTime(conversation.start_time);
      setIsPlaying(false);
    }
  }, [conversation.id, conversation.start_time]);

  // Set up audio metadata
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      const currentAbsoluteTime = audio.currentTime;
      setCurrentTime(currentAbsoluteTime);

      // Auto-advance to next conversation when this one ends
      if (currentAbsoluteTime >= conversation.end_time) {
        audio.pause();
        setIsPlaying(false);
        if (currentIndex < totalCount - 1) {
          onNext();
        }
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [conversation.end_time, currentIndex, totalCount, onNext]);

  // Spacebar keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') {
        const target = event.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  });

  // Log streak activity when user starts playing audio
  useEffect(() => {
    if (isPlaying && !hasLoggedStreak.current && transcriptId) {
      hasLoggedStreak.current = true;

      // Log the activity asynchronously (don't block playback)
      fetch('/api/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_id: transcriptId,
          activity_type: 'audio_listen',
        }),
      }).catch(err => {
        // Silently fail - don't interrupt user experience
        console.error('Failed to log streak:', err);
      });
    }
  }, [isPlaying, transcriptId]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Ensure we're within the conversation bounds
      if (audio.currentTime < conversation.start_time || audio.currentTime >= conversation.end_time) {
        audio.currentTime = conversation.start_time;
      }
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const seekTime = parseFloat(e.target.value);
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleSpeedChange = (speed: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(
      conversation.start_time,
      Math.min(conversation.end_time, audio.currentTime + seconds)
    );
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate relative time within conversation
  const relativeCurrentTime = currentTime - conversation.start_time;
  const relativeDuration = conversation.duration_seconds;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <audio ref={audioRef} src={conversation.audioUrl} preload="metadata" />

      {/* Conversation Info */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-midnight-blue mb-1">
          Conversation {conversation.conversation_number}
        </h3>
        <div className="text-sm text-steel-gray">
          {conversation.salespersonName} • {conversation.originalFilename}
        </div>
        <div className="flex gap-2 mt-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            conversation.category === 'sale'
              ? 'bg-green-100 text-green-800'
              : conversation.category === 'pitch'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {conversation.category}
          </span>
          {conversation.objections?.map((objection, idx) => (
            <span
              key={`${objection}-${idx}`}
              className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium"
            >
              {objection}
            </span>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <input
          type="range"
          min={conversation.start_time}
          max={conversation.end_time}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-success-gold"
        />
        <div className="flex justify-between text-sm text-steel-gray mt-1">
          <span>{formatTime(relativeCurrentTime)}</span>
          <span>{formatTime(relativeDuration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {/* Previous */}
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Previous conversation"
        >
          <svg className="w-6 h-6 text-midnight-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>

        {/* Skip -10s */}
        <button
          onClick={() => handleSkip(-10)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Rewind 10 seconds"
        >
          <svg className="w-6 h-6 text-midnight-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4z" transform="scale(-1 1) translate(-24 0)" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={togglePlayPause}
          className="p-4 bg-success-gold hover:bg-amber-500 rounded-full transition-colors"
        >
          {isPlaying ? (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 4a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm8 0a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2V4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          )}
        </button>

        {/* Skip +10s */}
        <button
          onClick={() => handleSkip(10)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Forward 10 seconds"
        >
          <svg className="w-6 h-6 text-midnight-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4z" />
          </svg>
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          disabled={currentIndex === totalCount - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next conversation"
        >
          <svg className="w-6 h-6 text-midnight-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
        </button>
      </div>

      {/* Playback Speed */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-steel-gray mr-2">Speed:</span>
        {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
          <button
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            className={`px-3 py-1 rounded transition-colors ${
              playbackSpeed === speed
                ? 'bg-success-gold text-white'
                : 'bg-gray-100 text-steel-gray hover:bg-gray-200'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
