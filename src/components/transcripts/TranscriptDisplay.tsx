'use client'

import { Heading, Text, Card } from '@/components'
import { useState } from 'react'

interface TranscriptDisplayProps {
  transcriptText: string
  redactionConfigUsed: string
  transcriptData: any
  interactionSummary?: string | null
  interactionSegments?: {
    start: number
    end: number
    text: string
    summary?: string | null
  }[]
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function TranscriptDisplay({
  transcriptText,
  redactionConfigUsed,
  transcriptData,
  interactionSummary,
  interactionSegments,
}: TranscriptDisplayProps) {
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(transcriptText)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  return (
    <Card variant="elevated" padding="lg">
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

      {(interactionSummary || (interactionSegments && interactionSegments.length)) && (
        <div className="mb-6 space-y-3">
          {interactionSummary && (
            <div className="p-4 rounded-md bg-midnight-blue bg-opacity-5 border border-midnight-blue border-opacity-10">
              <Text className="font-medium text-midnight-blue">Sale Summary</Text>
              <Text className="mt-1">{interactionSummary}</Text>
            </div>
          )}
          {interactionSegments && interactionSegments.length > 0 && (
            <div className="space-y-2">
              <Text variant="muted" size="sm" className="uppercase tracking-wide">
                Interactions
              </Text>
              <div className="space-y-3">
                {interactionSegments.map((seg, idx) => (
                  <div
                    key={`${seg.start}-${seg.end}-${idx}`}
                    className="p-3 rounded-md border border-gray-200 bg-gray-50"
                  >
                    <Text className="text-xs font-semibold text-midnight-blue uppercase tracking-wide">
                      {formatTimestamp(seg.start)} – {formatTimestamp(seg.end)}
                    </Text>
                    {seg.summary && (
                      <div className="mt-2 p-2 rounded-md bg-white border border-midnight-blue border-opacity-20">
                        <Text className="text-xs font-semibold text-midnight-blue">Summary</Text>
                        <Text className="leading-relaxed">{seg.summary}</Text>
                      </div>
                    )}
                    <div className="mt-2">
                      <Text className="text-xs font-semibold text-steel-gray">Transcript Snippet</Text>
                      <Text className="mt-1 leading-relaxed">{seg.text}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <Text className="whitespace-pre-wrap leading-relaxed">
          {transcriptText}
        </Text>
      </div>

      <div className="mt-6 p-4 bg-success-gold bg-opacity-5 rounded-md border border-success-gold border-opacity-20">
        <Text variant="muted" size="sm">
          <strong>Note:</strong> This transcript has been processed with PII redaction
          settings: <span className="font-medium text-success-gold">{redactionConfigUsed}</span>.
          Sensitive information may have been removed or masked.
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
