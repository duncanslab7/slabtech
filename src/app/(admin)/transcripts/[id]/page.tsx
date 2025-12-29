import { createClient } from '@/utils/supabase/server'
import { Heading, Text, Card, Container } from '@/components'
import { TranscriptWithConversations } from '@/components/transcripts/TranscriptWithConversations'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface TranscriptDetailsProps {
  params: Promise<{
    id: string
  }>
}

export default async function TranscriptDetailsPage({ params }: TranscriptDetailsProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch transcript details
  const { data: transcript, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !transcript) {
    notFound()
  }

  // Fetch conversations for this transcript
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('transcript_id', id)
    .order('conversation_number', { ascending: true })

  // Prefer redacted audio when available
  const redactedFilePath = (transcript.transcript_redacted as any)?.redacted_file_storage_path
  const audioPath = redactedFilePath || transcript.file_storage_path

  // Generate signed URL for audio file download
  const { data: signedUrlData } = await supabase.storage
    .from('call-recordings')
    .createSignedUrl(audioPath, 3600) // Valid for 1 hour

  const downloadUrl = signedUrlData?.signedUrl

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Extract transcript text from AssemblyAI response
  const buildRedactedText = () => {
    if (!transcript.transcript_redacted) return 'No transcript available'
    const payload = transcript.transcript_redacted as any
    const words = (payload.words as any[]) || []
    const piiMatches = (payload.pii_matches as any[]) || []
    if (!words.length || !piiMatches.length) return payload.text || 'No transcript available'

    const hasOverlap = (wordStart: number, wordEnd: number) =>
      piiMatches.some((m) => wordStart < (m.end ?? 0) && wordEnd > (m.start ?? 0))

    return words
      .map((w) => {
        if (hasOverlap(w.start, w.end)) return '[REDACTED]'
        return w.word || ''
      })
      .join(' ')
  }

  const getTranscriptText = () => {
    if (!transcript.transcript_redacted) return 'No transcript available'

    try {
      const assemblyResult = transcript.transcript_redacted as any
      if (assemblyResult.redacted_text) return assemblyResult.redacted_text
      const redacted = buildRedactedText()
      if (redacted) return redacted
      if (assemblyResult.text) return assemblyResult.text
      return 'Transcript format not recognized'
    } catch (e) {
      return 'Error parsing transcript'
    }
  }

  const transcriptText = getTranscriptText()

  // Extract words and PII matches for interactive player
  const words = (transcript.transcript_redacted as any)?.words || []
  const piiMatches = (transcript.transcript_redacted as any)?.pii_matches || []

  return (
    <Container maxWidth="xl" padding="lg">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-midnight-blue hover:text-steel-gray transition-colors text-sm font-medium mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <Heading level={1} size="xl" className="text-gray-900">
          Transcript Details
        </Heading>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metadata Column */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <Heading level={3} size="md" className="mb-4 text-gray-900">
              Recording Information
            </Heading>

            <div className="space-y-4">
              <div>
                <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
                  Date & Time
                </Text>
                <Text variant="emphasis" className="text-gray-900">{formatDate(transcript.created_at)}</Text>
              </div>

              <div>
                <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
                  Salesperson
                </Text>
                <Text variant="emphasis" className="text-gray-900">{transcript.salesperson_name}</Text>
              </div>

              <div>
                <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
                  Original Filename
                </Text>
                <Text className="break-all text-gray-900">{transcript.original_filename}</Text>
              </div>

              <div>
                <Text variant="muted" size="sm" className="uppercase tracking-wide mb-1 text-gray-600">
                  PII Redaction Config
                </Text>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-gold bg-opacity-10 text-success-gold">
                  {transcript.redaction_config_used}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Audio Player & Transcript Column */}
        <div className="lg:col-span-2">
          <TranscriptWithConversations
            conversations={conversations}
            downloadUrl={downloadUrl}
            words={words}
            piiMatches={piiMatches}
            originalFilename={transcript.original_filename}
            transcriptText={transcriptText}
            redactionConfigUsed={transcript.redaction_config_used}
            transcriptData={transcript.transcript_redacted}
            transcriptId={id}
          />
        </div>
      </div>
    </Container>
  )
}
