import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { detectPiiMatches, PiiMatch } from '@/utils/pii'
import {
  segmentConversationsHybrid,
  getConversationText,
  countPiiInConversation,
  findTextTimestamp
} from '@/utils/conversationSegmentation'
import { analyzeConversation } from '@/utils/conversationAnalysis'

type AssemblyAIWord = {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string
}

type AssemblyAITranscript = {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error' | 'terminated'
  text: string
  words: AssemblyAIWord[]
  redacted_audio_url?: string
  error?: string
}

const DEFAULT_FETCH_TIMEOUT_MS = 30_000

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get transcript record
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('id', id)
      .single()

    if (transcriptError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // If already completed or error, return current status
    if (transcript.status === 'completed') {
      return NextResponse.json({
        status: 'completed',
        transcriptId: transcript.id,
        message: 'Transcription completed successfully',
      })
    }

    if (transcript.status === 'error') {
      return NextResponse.json({
        status: 'error',
        error: transcript.processing_error || 'Processing failed',
      })
    }

    // Check AssemblyAI status
    const assemblyaiKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyaiKey) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not configured' }, { status: 500 })
    }

    const response = await fetchWithTimeout(
      `https://api.assemblyai.com/v2/transcript/${transcript.assemblyai_transcript_id}`,
      {
        method: 'GET',
        headers: {
          authorization: assemblyaiKey,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to check AssemblyAI status')
    }

    const assemblyaiTranscript: AssemblyAITranscript = await response.json()

    // If still processing, return processing status
    if (assemblyaiTranscript.status === 'queued' || assemblyaiTranscript.status === 'processing') {
      return NextResponse.json({
        status: 'processing',
        message: 'Transcription in progress...',
      })
    }

    // If error, update database and return error
    if (assemblyaiTranscript.status === 'error' || assemblyaiTranscript.status === 'terminated') {
      const errorMsg = assemblyaiTranscript.error || 'Transcription failed'

      await supabase
        .from('transcripts')
        .update({
          status: 'error',
          processing_error: errorMsg,
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json({
        status: 'error',
        error: errorMsg,
      })
    }

    // If completed, process the results
    if (assemblyaiTranscript.status === 'completed') {
      console.log('AssemblyAI transcription completed, processing results...')

      // Convert words
      const words = assemblyaiTranscript.words.map((w) => ({
        word: w.text,
        start: w.start / 1000,
        end: w.end / 1000,
        speaker: w.speaker,
      }))

      // PII detection
      const piiFields = transcript.redaction_config_used || 'all'
      const piiMatches = detectPiiMatches(words, piiFields)

      // Download redacted audio
      let redactedFilePath = ''
      console.log('Checking for redacted audio URL:', !!assemblyaiTranscript.redacted_audio_url)
      console.log('AssemblyAI response keys:', Object.keys(assemblyaiTranscript))

      if (assemblyaiTranscript.redacted_audio_url) {
        console.log('Downloading redacted audio from:', assemblyaiTranscript.redacted_audio_url)
        const redactedAudioResp = await fetch(assemblyaiTranscript.redacted_audio_url)
        console.log('Redacted audio fetch status:', redactedAudioResp.status)

        if (redactedAudioResp.ok) {
          const redactedBuffer = Buffer.from(await redactedAudioResp.arrayBuffer())
          console.log('Redacted audio buffer size:', redactedBuffer.length)

          redactedFilePath = `redacted/${transcript.file_storage_path}`
          const { error: redactedUploadError } = await supabase.storage
            .from('call-recordings')
            .upload(redactedFilePath, redactedBuffer, {
              contentType: 'audio/mpeg',
              upsert: true,
            })

          if (redactedUploadError) {
            console.error('Redacted audio upload error:', redactedUploadError)
          } else {
            console.log('Redacted audio uploaded successfully to:', redactedFilePath)
          }
        } else {
          console.error('Failed to download redacted audio, status:', redactedAudioResp.status)
        }
      } else {
        console.warn('No redacted_audio_url in AssemblyAI response - audio redaction may not be enabled or available')
      }

      // Update transcript with results
      const { error: updateError } = await supabase
        .from('transcripts')
        .update({
          status: 'completed',
          transcript_redacted: {
            text: assemblyaiTranscript.text,
            words,
            pii_matches: piiMatches,
            redacted_file_storage_path: redactedFilePath,
          },
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        console.error('Failed to update transcript:', updateError)
      }

      // Process conversations and wait for completion
      try {
        await processConversations(id, words, piiMatches)
        console.log('Conversation processing completed successfully')
      } catch (error) {
        console.error('Conversation processing error:', error)
        // Continue anyway - transcript is still valid
      }

      return NextResponse.json({
        status: 'completed',
        transcriptId: transcript.id,
        message: 'Transcription completed successfully',
      })
    }

    return NextResponse.json({
      status: 'processing',
      message: 'Status unknown',
    })
  } catch (error: any) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    )
  }
}

// Process conversations asynchronously
async function processConversations(
  transcriptId: string,
  words: any[],
  piiMatches: PiiMatch[]
) {
  const supabase = await createClient()

  try {
    console.log('Segmenting conversations...')
    const conversations = segmentConversationsHybrid(words, 'A', 30)
    console.log(`Found ${conversations.length} conversations`)

    const anthropicKey = process.env.ANTHROPIC_API_KEY

    for (const conversation of conversations) {
      const conversationText = getConversationText(conversation)
      const piiCount = countPiiInConversation(piiMatches, conversation)

      const analysis = await analyzeConversation(
        conversationText,
        piiCount,
        anthropicKey
      )

      const objectionTimestamps = analysis.objectionsWithText.map(objection => {
        const timestamp = findTextTimestamp(objection.text, conversation.words)
        return {
          type: objection.type,
          text: objection.text,
          timestamp: timestamp !== null ? timestamp : conversation.startTime
        }
      })

      const hasMeaningfulContent = analysis.objections.length > 0 || analysis.category === 'sale'

      if (!hasMeaningfulContent) {
        console.log(`Skipping conversation ${conversation.conversationNumber}`)
        continue
      }

      await supabase.from('conversations').insert({
        transcript_id: transcriptId,
        conversation_number: conversation.conversationNumber,
        start_time: conversation.startTime,
        end_time: conversation.endTime,
        speakers: conversation.speakers,
        sales_rep_speaker: 'A',
        word_count: conversation.wordCount,
        duration_seconds: conversation.durationSeconds,
        category: analysis.category,
        objections: analysis.objections,
        objections_with_text: analysis.objectionsWithText,
        objection_timestamps: objectionTimestamps,
        has_price_mention: analysis.hasPriceMention,
        pii_redaction_count: analysis.piiRedactionCount,
        analysis_completed: analysis.analysisCompleted,
        analysis_error: analysis.analysisError
      })
    }

    console.log('Conversation processing completed')
  } catch (error) {
    console.error('Conversation processing error:', error)
  }
}
