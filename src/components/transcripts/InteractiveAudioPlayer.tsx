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

interface InteractiveAudioPlayerProps {
  audioUrl: string
  words: Word[]
  piiMatches: PiiMatch[]
  originalFilename: string
  hideDownload?: boolean
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2]

function formatTime(seconds: number) {
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
}: InteractiveAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const activeWordRef = useRef<HTMLSpanElement>(null)

  // Determine first speaker for consistent color coding
  const firstSpeaker = words.find(w => w.speaker)?.speaker || 'A'

  // Check if a word overlaps with PII
  const hasOverlap = (wordStart: number, wordEnd: number) =>
    piiMatches?.some((m) => wordStart < (m.end ?? 0) && wordEnd > (m.start ?? 0))

  // Update current time and find active word
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      const time = audio.currentTime
      setCurrentTime(time)

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
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [words])

  // Auto-scroll to active word
  useEffect(() => {
    if (activeWordRef.current && isPlaying) {
      activeWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [currentWordIndex, isPlaying])

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
    if (!audio) return
    audio.currentTime = time
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

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    handleSeek(percent * duration)
  }

  return (
    <div className="space-y-4">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

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
      <Card variant="elevated" padding="lg">
        <div className="space-y-4">
          {/* Progress Bar */}
          <div
            className="relative h-2 bg-gray-200 rounded-full cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div
              className="absolute h-2 bg-midnight-blue rounded-full transition-all group-hover:bg-steel-gray"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-midnight-blue rounded-full shadow-md"
              style={{ left: `${(currentTime / duration) * 100}%`, marginLeft: '-8px' }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-sm text-steel-gray font-mono">
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

          {/* Download Link */}
          {!hideDownload && (
            <div className="pt-4 border-t border-gray-200">
              <a
                href={audioUrl}
                download={originalFilename}
                className="block w-full text-center rounded-md bg-gray-100 px-4 py-2 text-midnight-blue hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Download Audio
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Interactive Transcript */}
      <Card variant="elevated" padding="lg">
        <div className="mb-4">
          <Text variant="emphasis" className="text-lg font-semibold">
            Interactive Transcript
          </Text>
          <Text variant="muted" size="sm" className="mt-1">
            Click on any word to jump to that moment in the audio
          </Text>
        </div>

        {/* Legend */}
        <div className="mb-4 flex gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-charcoal"></div>
            <span className="text-steel-gray">Speaker 1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f39c12]"></div>
            <span className="text-steel-gray">Speaker 2</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-success-gold bg-opacity-30"></div>
            <span className="text-steel-gray">Currently playing</span>
          </div>
        </div>

        {/* Scrollable Transcript */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 max-h-[600px] overflow-y-auto pb-24 md:pb-6">
          <div className="leading-relaxed select-text">
            {words.map((word, idx) => {
              const isRedacted = hasOverlap(word.start, word.end)
              const text = isRedacted ? '[REDACTED]' : word.word
              const speaker = word.speaker || ''
              const isFirstSpeaker = speaker === firstSpeaker || speaker === ''
              const color = isFirstSpeaker ? 'text-charcoal' : 'text-[#f39c12]'
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
          <Text variant="muted" size="sm">
            <strong>Tip:</strong> Use the speed controls to slow down or speed up playback. Click any word to jump to that moment.
          </Text>
        </div>
      </Card>
    </div>
  )
}
