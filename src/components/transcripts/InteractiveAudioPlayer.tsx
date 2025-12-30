'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, Text } from '@/components'

interface Word {
  word: string
  start: number
  end: number
  speaker?: string
}

interface PiiMatch {
  start: number
  end: number
  label: string
}

interface Conversation {
  id: string
  conversation_number: number
  start_time: number
  end_time: number
}

interface InteractiveAudioPlayerProps {
  audioUrl: string
  words: Word[]
  piiMatches: PiiMatch[]
  originalFilename: string
  hideDownload?: boolean
  seekToTime?: number // External control to seek to a specific time
  onPlayerReady?: (seekFunction: (time: number) => void) => void // Callback to expose seek function
  conversations?: Conversation[] | null
  currentConversationIndex?: number
  onNextConversation?: () => void
  onPreviousConversation?: () => void
  transcriptId?: string // For logging streak activities
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2]

function formatTime(seconds: number) {
  // Handle invalid values
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0:00'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function InteractiveAudioPlayer({
  audioUrl,
  words,
  piiMatches,
  originalFilename,
  hideDownload = false,
  seekToTime,
  onPlayerReady,
  conversations,
  currentConversationIndex = 0,
  onNextConversation,
  onPreviousConversation,
  transcriptId,
}: InteractiveAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const [swapSpeakerColors, setSwapSpeakerColors] = useState(false)
  const [forceScroll, setForceScroll] = useState(0) // Increment to force scroll after seek
  const activeWordRef = useRef<HTMLSpanElement>(null)
  const hasLoggedStreak = useRef(false) // Track if we've logged a streak for this session

  // Calculate estimated duration from words if audio duration unavailable (mobile Safari large files)
  const estimatedDuration = words.length > 0 ? words[words.length - 1].end : 0

  // Expose seek function to parent component
  useEffect(() => {
    if (onPlayerReady) {
      onPlayerReady(handleSeek)
    }
  }, [onPlayerReady])

  // Handle external seek requests
  useEffect(() => {
    if (seekToTime !== undefined && seekToTime >= 0) {
      handleSeek(seekToTime)
      // Auto-play when seeking from conversation click (always try to play)
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          setIsPlaying(true)
        }).catch((err) => {
          // Autoplay blocked by browser - user needs to manually start
          console.log('Autoplay prevented, user must click play:', err)
        })
      }
    }
  }, [seekToTime])

  // Check if speaker diarization is enabled
  const hasSpeakerLabels = words.some(w => w.speaker)
  const firstSpeaker = words.find(w => w.speaker)?.speaker || 'A'

  // Check if a word overlaps with PII
  const hasOverlap = (wordStart: number, wordEnd: number) =>
    piiMatches?.some((m) => wordStart < (m.end ?? 0) && wordEnd > (m.start ?? 0))

  // Determine speaker color with smart fallback
  const getSpeakerColor = (word: Word, previousSpeaker: string | null): { speaker: string; color: string } => {
    // If no speaker diarization at all, everything is the same color
    if (!hasSpeakerLabels) {
      return { speaker: 'none', color: 'text-charcoal' }
    }

    // Determine colors based on swap toggle
    const firstColor = swapSpeakerColors ? 'text-[#f39c12]' : 'text-charcoal'
    const secondColor = swapSpeakerColors ? 'text-charcoal' : 'text-[#f39c12]'

    // If this word has a speaker label, use it
    if (word.speaker) {
      const isFirstSpeaker = word.speaker === firstSpeaker
      return {
        speaker: word.speaker,
        color: isFirstSpeaker ? firstColor : secondColor
      }
    }

    // If no label, inherit from previous word
    if (previousSpeaker && previousSpeaker !== 'none') {
      const isFirstSpeaker = previousSpeaker === firstSpeaker
      return {
        speaker: previousSpeaker,
        color: isFirstSpeaker ? firstColor : secondColor
      }
    }

    // Default fallback
    return { speaker: firstSpeaker, color: firstColor }
  }

  // Update current time and find active word
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      const time = audio.currentTime
      setCurrentTime(time)

      // Update duration if not set yet (mobile browsers sometimes need this)
      if (audio.duration && audio.duration !== duration) {
        setDuration(audio.duration)
      }

      // Find the word that corresponds to current time
      const wordIdx = words.findIndex(
        (w, idx) => {
          const nextWord = words[idx + 1]
          return time >= w.start && (!nextWord || time < nextWord.start)
        }
      )
      setCurrentWordIndex(wordIdx)
    }

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      } else if (estimatedDuration > 0) {
        // Fallback: use estimated duration from transcript words
        console.log('Using estimated duration from transcript:', estimatedDuration)
        setDuration(estimatedDuration)
      }
    }

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      } else if (estimatedDuration > 0 && duration === 0) {
        // Fallback for mobile Safari with large files
        console.log('Using estimated duration (durationchange):', estimatedDuration)
        setDuration(estimatedDuration)
      }
    }

    const handleCanPlay = () => {
      // Ensure duration is set when audio can play
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      } else if (estimatedDuration > 0 && duration === 0) {
        // Fallback for mobile Safari with large files
        console.log('Using estimated duration (canplay):', estimatedDuration)
        setDuration(estimatedDuration)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handleError = (e: Event) => {
      console.error('Audio error:', e)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // Try to get duration immediately if already loaded
    if (audio.duration && isFinite(audio.duration)) {
      setDuration(audio.duration)
    } else if (estimatedDuration > 0 && duration === 0) {
      // Set estimated duration immediately for large files (mobile Safari)
      console.log('Setting estimated duration on mount:', estimatedDuration)
      setDuration(estimatedDuration)
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [words, duration, estimatedDuration])

  // Auto-scroll to active word
  useEffect(() => {
    if (activeWordRef.current) {
      // Scroll when playing, when word changes, or when force scroll is triggered
      const shouldScroll = isPlaying || currentWordIndex >= 0 || forceScroll > 0
      if (shouldScroll) {
        activeWordRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }
  }, [currentWordIndex, isPlaying, forceScroll])

  // Log streak activity when user starts playing audio
  useEffect(() => {
    if (isPlaying && !hasLoggedStreak.current && transcriptId) {
      hasLoggedStreak.current = true

      // Log the activity asynchronously (don't block playback)
      fetch('/api/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_id: transcriptId,
          activity_type: 'audio_listen',
          user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }).catch(err => {
        // Silently fail - don't interrupt user experience
        console.error('Failed to log streak:', err)
      })
    }
  }, [isPlaying, transcriptId])

  // Keyboard shortcut: Spacebar to play/pause (desktop only)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger if spacebar is pressed
      if (event.code === 'Space' || event.key === ' ') {
        // Don't trigger if user is typing in an input/textarea
        const target = event.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }

        // Prevent default spacebar behavior (scrolling)
        event.preventDefault()

        // Toggle play/pause
        const audio = audioRef.current
        if (!audio) return

        if (isPlaying) {
          audio.pause()
          setIsPlaying(false)
        } else {
          audio.play()
          setIsPlaying(true)
        }
      }
    }

    // Add event listener
    window.addEventListener('keydown', handleKeyPress)

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [isPlaying]) // Re-bind when isPlaying changes to capture latest state

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (time: number) => {
    const audio = audioRef.current
    if (!audio) {
      console.error('Audio ref not available for seeking')
      return
    }

    // Ensure time is valid
    if (!isFinite(time) || time < 0) {
      console.error('Invalid seek time:', time)
      return
    }

    console.log('Attempting to seek to:', time, 'readyState:', audio.readyState)

    // For mobile Safari with large files, we need to be more aggressive
    const performSeek = () => {
      try {
        const wasPlaying = !audio.paused
        console.log('Performing seek to:', time, 'Current time:', audio.currentTime, 'Was playing:', wasPlaying)

        // Listen for when seek completes
        const onSeeked = () => {
          console.log('Seek completed, actual time:', audio.currentTime)
          setCurrentTime(audio.currentTime)
          setForceScroll(prev => prev + 1)
          audio.removeEventListener('seeked', onSeeked)
        }

        audio.addEventListener('seeked', onSeeked, { once: true })

        // Pause first if playing - Safari seeks better when paused
        const shouldResume = wasPlaying
        if (wasPlaying) {
          audio.pause()
        }

        // Perform the seek
        audio.currentTime = time

        // Force Safari to actually perform the seek by playing briefly
        // This is critical for large files where Safari doesn't buffer unbuffered regions
        const forceSafariSeek = async () => {
          try {
            // Play to force Safari to seek and buffer
            await audio.play()

            // Wait for seek to complete
            await new Promise(resolve => setTimeout(resolve, 150))

            // Resume or pause based on previous state
            if (!shouldResume) {
              audio.pause()
            }
          } catch (err) {
            console.log('Play-to-force-seek blocked:', err)
            // If play is blocked, just update state
            setCurrentTime(time)
            setForceScroll(prev => prev + 1)
          }
        }

        forceSafariSeek()

        // Fallback: verify seek worked after timeout
        setTimeout(() => {
          const actualTime = audio.currentTime
          const timeDiff = Math.abs(actualTime - time)
          if (timeDiff > 1) {
            console.warn(`Seek verification failed. Target: ${time}, Actual: ${actualTime}`)
            // Last resort: try one more time
            audio.currentTime = time
            setCurrentTime(time)
          }
        }, 500)
      } catch (error) {
        console.error('Error during seek:', error)
        // Ensure state is updated even if seek fails
        setCurrentTime(time)
        setForceScroll(prev => prev + 1)
      }
    }

    // Mobile Safari strategy: Only reload if truly uninitialized
    if (audio.readyState === 0) {
      // HAVE_NOTHING - audio hasn't loaded at all, need to load first
      console.log('Audio completely unloaded, loading before seek...')

      const onCanPlay = () => {
        console.log('Audio loaded, seeking now')
        performSeek()
        audio.removeEventListener('loadedmetadata', onCanPlay)
      }

      audio.addEventListener('loadedmetadata', onCanPlay, { once: true })
      audio.load()

      // Fallback timeout
      setTimeout(() => {
        audio.removeEventListener('loadedmetadata', onCanPlay)
        if (audio.readyState > 0) {
          performSeek()
        }
      }, 3000)
    } else if (audio.readyState === 1) {
      // HAVE_METADATA - wait for some data before seeking
      console.log('Waiting for audio data before seek...')

      const onCanSeek = () => {
        console.log('Audio ready, seeking now')
        performSeek()
      }

      audio.addEventListener('loadeddata', onCanSeek, { once: true })

      // Also try immediately in case data comes quickly
      setTimeout(() => {
        audio.removeEventListener('loadeddata', onCanSeek)
        performSeek()
      }, 1000)
    } else {
      // readyState >= 2 - Audio has enough data, seek immediately
      performSeek()
    }
  }

  const skipBackward = () => {
    handleSeek(Math.max(0, currentTime - 10))
  }

  const skipForward = () => {
    handleSeek(Math.min(duration, currentTime + 10))
  }

  const changePlaybackRate = (rate: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = rate
    setPlaybackRate(rate)
  }

  const handleWordClick = (word: Word) => {
    handleSeek(word.start)
    if (!isPlaying && audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))

    // Only seek if duration is valid
    if (duration && isFinite(duration) && duration > 0) {
      handleSeek(percent * duration)
    }
  }

  return (
    <div className="space-y-4">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        crossOrigin="anonymous"
        playsInline
        controlsList="nodownload"
      />

      {/* Sticky Floating Audio Controls (Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-midnight-blue shadow-2xl border-t-2 border-success-gold md:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            {/* Skip Backward */}
            <button
              onClick={skipBackward}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Skip backward 10s"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="p-4 rounded-full bg-success-gold hover:bg-success-gold/90 transition-colors shadow-lg"
            >
              {isPlaying ? (
                <svg className="w-7 h-7 text-midnight-blue" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-midnight-blue" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip Forward */}
            <button
              onClick={skipForward}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Skip forward 10s"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-xs text-success-gold font-mono mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Progress Bar */}
          <div
            className="relative h-2 bg-gray-200 rounded-full cursor-pointer group"
            onClick={handleProgressClick}
            onTouchEnd={handleProgressClick}
          >
            <div
              className="absolute h-2 bg-success-gold rounded-full transition-all group-hover:bg-amber-500"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-success-gold rounded-full shadow-md"
              style={{ left: `${(currentTime / duration) * 100}%`, marginLeft: '-8px' }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-sm text-gray-600 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-4">
            {/* Skip Backward */}
            <button
              onClick={skipBackward}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Skip backward 10s"
            >
              <svg className="w-6 h-6 text-midnight-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="p-4 rounded-full bg-midnight-blue hover:bg-steel-gray transition-colors"
            >
              {isPlaying ? (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip Forward */}
            <button
              onClick={skipForward}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Skip forward 10s"
            >
              <svg className="w-6 h-6 text-midnight-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
          </div>

          {/* Playback Speed Controls */}
          <div className="flex items-center justify-center gap-2">
            <Text variant="muted" size="sm" className="mr-2">
              Speed:
            </Text>
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                onClick={() => changePlaybackRate(rate)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  playbackRate === rate
                    ? 'bg-midnight-blue text-white'
                    : 'bg-gray-100 text-steel-gray hover:bg-gray-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Conversation Navigation */}
          {conversations && conversations.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-200">
              <Text variant="muted" size="sm" className="mr-2 text-gray-600">
                Conversation:
              </Text>
              <button
                onClick={onPreviousConversation}
                disabled={currentConversationIndex === 0}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  currentConversationIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Previous conversation"
              >
                ← Previous
              </button>
              <span className="text-sm font-medium text-gray-700">
                {currentConversationIndex + 1} / {conversations.length}
              </span>
              <button
                onClick={onNextConversation}
                disabled={currentConversationIndex === conversations.length - 1}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  currentConversationIndex === conversations.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Next conversation"
              >
                Next →
              </button>
            </div>
          )}

          {/* Download Link */}
          {!hideDownload && (
            <div className="pt-4 border-t border-gray-200">
              <a
                href={audioUrl}
                download={originalFilename}
                className="block w-full text-center rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Download Audio
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Transcript */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <Text variant="emphasis" className="text-lg font-semibold text-gray-900">
            Interactive Transcript
          </Text>
          <Text variant="muted" size="sm" className="mt-1 text-gray-600">
            Click on any word to jump to that moment in the audio
          </Text>
        </div>

        {/* Legend */}
        <div className="mb-4">
          <div className="flex gap-4 text-xs flex-wrap mb-2 items-center">
            {hasSpeakerLabels && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-charcoal"></div>
                  <span className="text-gray-700">Speaker 1</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f39c12]"></div>
                  <span className="text-gray-700">Speaker 2</span>
                </div>
                <button
                  onClick={() => setSwapSpeakerColors(!swapSpeakerColors)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    swapSpeakerColors
                      ? 'bg-success-gold text-black'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Swap speaker colors for easier reading"
                >
                  Swap Colors
                </button>
              </>
            )}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success-gold bg-opacity-30"></div>
              <span className="text-gray-700">Currently playing</span>
            </div>
          </div>
          {hasSpeakerLabels && (
            <div className="text-xs text-gray-500 italic">
              Note: Speaker detection is automated and may not be 100% accurate, especially with background noise or overlapping speech.
            </div>
          )}
        </div>

        {/* Scrollable Transcript */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 max-h-[600px] overflow-y-auto pb-24 md:pb-6">
          <div className="leading-relaxed select-text">
            {words.map((word, idx) => {
              const isRedacted = hasOverlap(word.start, word.end)
              const text = isRedacted ? '[REDACTED]' : word.word

              // Get speaker and color with smart fallback
              const previousWord = idx > 0 ? words[idx - 1] : null
              const previousSpeaker = previousWord?.speaker || null
              const { color } = getSpeakerColor(word, previousSpeaker)

              const isActive = idx === currentWordIndex

              return (
                <span
                  key={idx}
                  ref={isActive ? activeWordRef : null}
                  onClick={() => !isRedacted && handleWordClick(word)}
                  className={`
                    ${color}
                    ${isActive ? 'bg-success-gold bg-opacity-30 font-semibold' : ''}
                    ${!isRedacted ? 'cursor-pointer hover:bg-gray-200 hover:bg-opacity-50' : ''}
                    inline-block px-0.5 rounded transition-colors
                  `}
                  title={!isRedacted ? `${formatTime(word.start)} - Click to play from here` : undefined}
                >
                  {text}{' '}
                </span>
              )
            })}
          </div>
        </div>

        <div className="mt-4 p-4 bg-success-gold bg-opacity-5 rounded-md border border-success-gold border-opacity-20">
          <Text variant="muted" size="sm" className="text-gray-700">
            <strong>Tip:</strong> Use the speed controls to slow down or speed up playback. Click any word to jump to that moment.
          </Text>
        </div>
      </div>
    </div>
  )
}
