'use client'

import { Heading, Text, Card } from '@/components'
import { useState } from 'react'

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

interface TranscriptDisplayProps {
  transcriptText: string
  redactionConfigUsed: string
  transcriptData: any
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function buildColorCodedTranscript(
  words: Word[],
  piiMatches: PiiMatch[],
  firstSpeaker: string
) {
  if (!words || words.length === 0) return null

  const hasOverlap = (wordStart: number, wordEnd: number) =>
    piiMatches?.some((m) => wordStart < (m.end ?? 0) && wordEnd > (m.start ?? 0))

  const elements: JSX.Element[] = []
  let lastMinute = -1

  words.forEach((word, idx) => {
    const currentMinute = Math.floor(word.start / 60)

    // Insert timestamp marker at the start of each new minute
    if (currentMinute > lastMinute) {
      if (lastMinute >= 0) {
        elements.push(<br key={`br-${currentMinute}-${idx}`} />)
      }
      elements.push(
        <span
          key={`ts-${currentMinute}-${idx}`}
          className="inline-block bg-midnight-blue text-white text-xs px-2 py-1 rounded mr-2 my-1 font-mono"
        >
          {formatTimestamp(currentMinute * 60)}
        </span>
      )
      lastMinute = currentMinute
    }

    const isRedacted = hasOverlap(word.start, word.end)
    const text = isRedacted ? '[REDACTED]' : word.word

    const speaker = word.speaker || ''
    const isFirstSpeaker = speaker === firstSpeaker || speaker === ''
    const color = isFirstSpeaker ? 'text-charcoal' : 'text-[#f39c12]'

    elements.push(
      <span key={`word-${idx}`} className={color}>
        {text}{' '}
      </span>
    )
  })

  return elements
}

export function TranscriptDisplay({
  transcriptText,
  redactionConfigUsed,
  transcriptData,
}: TranscriptDisplayProps) {
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(transcriptText)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  // Extract words and PII matches from transcript data
  const words = (transcriptData?.words as Word[]) || []
  const piiMatches = (transcriptData?.pii_matches as PiiMatch[]) || []

  // Determine first speaker for color coding
  const firstSpeaker = words.find(w => w.speaker)?.speaker || 'A'

  const colorCodedTranscript = buildColorCodedTranscript(words, piiMatches, firstSpeaker)

  return (
    <Card variant="light" padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <Heading level={3} size="md">
          Redacted Transcript
        </Heading>
        <button
          onClick={handleCopy}
          className="text-sm text-midnight-blue hover:text-steel-gray transition-colors font-medium"
        >
          {copySuccess ? '✓ Copied!' : 'Copy Text'}
        </button>
      </div>

      {/* Legend */}
      <div className="mb-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-charcoal"></div>
          <span className="text-steel-gray">Speaker 1</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f39c12]"></div>
          <span className="text-steel-gray">Speaker 2</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 rounded bg-midnight-blue"></div>
          <span className="text-steel-gray">Timestamp</span>
        </div>
      </div>

      {/* Continuous transcript with speaker color coding and timestamps */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-4">
        <div className="leading-relaxed">
          {colorCodedTranscript || transcriptText}
        </div>
      </div>

      <div className="mt-6 p-4 bg-success-gold bg-opacity-5 rounded-md border border-success-gold border-opacity-20">
        <Text variant="muted" size="sm">
          <strong>Note:</strong> This transcript has been processed with PII redaction
          settings: <span className="font-medium text-success-gold">{redactionConfigUsed}</span>.
          Sensitive information has been masked with [REDACTED].
        </Text>
      </div>

      {/* Raw JSON Toggle (for debugging/advanced use) */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-steel-gray hover:text-midnight-blue font-medium">
          View Raw AssemblyAI Response
        </summary>
        <pre className="mt-2 p-4 bg-charcoal text-pure-white rounded-lg text-xs overflow-x-auto">
          {JSON.stringify(transcriptData, null, 2)}
        </pre>
      </details>
    </Card>
  )
}
