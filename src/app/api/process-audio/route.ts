import { detectPiiMatches, PiiMatch } from '@/utils/pii'
import { createClient } from '@/utils/supabase/server'
import { checkRateLimit } from '@/utils/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import {
  segmentConversationsHybrid,
  getConversationText,
  countPiiInConversation,
  findTextTimestamp
} from '@/utils/conversationSegmentation'
import { analyzeConversation } from '@/utils/conversationAnalysis'

// Route segment config to allow large file uploads
export const maxDuration = 300 // 5 minutes max execution time
export const dynamic = 'force-dynamic'
export const bodyParser = {
  sizeLimit: '400mb',
}

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
  error?: string
}

const DEFAULT_FETCH_TIMEOUT_MS = 600_000 // 10 minutes
const POLLING_INTERVAL_MS = 3000 // 3 seconds
const FFMPEG_SERVICE_URL = process.env.FFMPEG_SERVICE_URL || 'http://localhost:3001'

// Call external FFmpeg microservice to redact audio
async function redactAudioViaService(
  audioSignedUrl: string,
  redactedFilePath: string,
  piiRanges: PiiMatch[],
  supabase: any,
  contentType: string
) {
  if (!piiRanges || piiRanges.length === 0) {
    // No PII to redact - service will just copy the file
    console.log('No PII ranges to redact, using service to copy file')
  }

  // Create a signed upload URL for the microservice to upload the redacted audio
  const { data: uploadUrlData, error: uploadUrlError } = await supabase.storage
    .from('call-recordings')
    .createSignedUploadUrl(redactedFilePath)

  if (uploadUrlError || !uploadUrlData) {
    throw new Error(`Failed to create upload URL: ${uploadUrlError?.message}`)
  }

  // Call the FFmpeg microservice
  console.log(`Calling FFmpeg service at ${FFMPEG_SERVICE_URL}`)
  const serviceResponse = await fetch(`${FFMPEG_SERVICE_URL}/redact-audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audioUrl: audioSignedUrl,
      piiRanges: piiRanges,
      uploadUrl: uploadUrlData.signedUrl,
      uploadHeaders: {
        'Content-Type': contentType,
      },
    }),
  })

  if (!serviceResponse.ok) {
    const errorData = await serviceResponse.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`FFmpeg service failed: ${errorData.error || serviceResponse.statusText}`)
  }

  const result = await serviceResponse.json()
  console.log(`FFmpeg service completed: ${result.piiRangesProcessed} ranges processed`)
}

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

async function uploadToAssemblyAI(audioUrl: string, apiKey: string): Promise<string> {
  // Upload audio file to AssemblyAI
  const uploadResponse = await fetchWithTimeout(
    'https://api.assemblyai.com/v2/upload',
    {
      method: 'POST',
      headers: {
        authorization: apiKey,
      },
      body: await (await fetch(audioUrl)).arrayBuffer(),
    },
    60_000
  )

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text()
    throw new Error(`AssemblyAI upload failed: ${error}`)
  }

  const { upload_url } = await uploadResponse.json()
  return upload_url
}

async function createTranscript(
  audioUrl: string,
  apiKey: string
): Promise<string> {
  const response = await fetchWithTimeout(
    'https://api.assemblyai.com/v2/transcript',
    {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true, // Enable speaker diarization
      }),
    },
    30_000
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AssemblyAI transcript creation failed: ${error}`)
  }

  const { id } = await response.json()
  return id
}

async function pollTranscript(transcriptId: string, apiKey: string): Promise<AssemblyAITranscript> {
  while (true) {
    const response = await fetchWithTimeout(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        method: 'GET',
        headers: {
          authorization: apiKey,
        },
      },
      30_000
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AssemblyAI polling failed: ${error}`)
    }

    const transcript: AssemblyAITranscript = await response.json()

    if (transcript.status === 'completed') {
      return transcript
    } else if (transcript.status === 'error' || transcript.status === 'terminated') {
      const errorMsg = transcript.error || 'Transcription was terminated by AssemblyAI'
      throw new Error(`AssemblyAI transcription failed: ${errorMsg}. This may happen if the audio format is unsupported or corrupted.`)
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS))
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filePath, originalFilename, salespersonId } = body

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }
    if (!originalFilename) {
      return NextResponse.json({ error: 'Original filename is required' }, { status: 400 })
    }
    if (!salespersonId) {
      return NextResponse.json({ error: 'Salesperson is required' }, { status: 400 })
    }

    const assemblyaiKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyaiKey) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not configured' }, { status: 500 })
    }

    const supabase = await createClient()

    // Check authentication and get user role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check if admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Apply rate limiting for non-admin users (10 uploads per hour)
    if (!isAdmin) {
      const rateLimitResult = checkRateLimit(user.id, 10, 60 * 60 * 1000) // 10 requests per hour

      if (!rateLimitResult.allowed) {
        const minutes = Math.ceil(rateLimitResult.retryAfter! / 60)
        return NextResponse.json(
          {
            error: `Upload limit reached. You can upload again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter!.toString(),
              'X-RateLimit-Limit': '10',
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            },
          }
        )
      }
    }

    // 1) Signed URL for the uploaded audio
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(filePath, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError)
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
    }

    const signedUrl = signedUrlData.signedUrl

    // 2) Load redaction config
    const { data: configData, error: configError } = await supabase
      .from('redaction_config')
      .select('pii_fields')
      .eq('id', 1)
      .single()

    if (configError) {
      console.error('Config fetch error:', configError)
      return NextResponse.json({ error: 'Failed to fetch redaction configuration' }, { status: 500 })
    }

    const piiFields = (configData?.pii_fields || 'all').toLowerCase()

    // 3) Download audio buffer for FFmpeg processing
    const audioResp = await fetch(signedUrl)
    if (!audioResp.ok) {
      const text = await audioResp.text()
      console.error('Audio download error:', text)
      return NextResponse.json({ error: 'Failed to download audio for processing' }, { status: 500 })
    }
    const audioArrayBuffer = await audioResp.arrayBuffer()
    const audioBuffer = Buffer.from(audioArrayBuffer)
    const contentType = audioResp.headers.get('content-type') || 'audio/mpeg'

    // 4) Transcribe with AssemblyAI
    console.log('Uploading to AssemblyAI...')
    const uploadUrl = await uploadToAssemblyAI(signedUrl, assemblyaiKey)

    console.log('Creating transcript...')
    const transcriptId = await createTranscript(uploadUrl, assemblyaiKey)

    console.log('Polling for transcript completion...')
    const transcript = await pollTranscript(transcriptId, assemblyaiKey)

    // Convert AssemblyAI words to our format (convert ms to seconds)
    const words = transcript.words.map((w) => ({
      word: w.text,
      start: w.start / 1000,
      end: w.end / 1000,
      speaker: w.speaker,
    }))

    // 5) PII detection using regex (email, phone, ssn, credit card, address-ish, name-ish)
    const piiMatches = detectPiiMatches(words, piiFields)

    // 6) Redact audio via external FFmpeg microservice
    const redactedFilePath = `redacted/${filePath}`

    try {
      await redactAudioViaService(
        signedUrl,
        redactedFilePath,
        piiMatches,
        supabase,
        contentType
      )

      // 8) Get salesperson name for backwards compatibility
      const { data: salespersonData } = await supabase
        .from('salespeople')
        .select('name')
        .eq('id', salespersonId)
        .single()

      const salespersonName = salespersonData?.name || 'Unknown'

      // 9) Save transcript + redaction metadata
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .insert({
          salesperson_id: salespersonId,
          salesperson_name: salespersonName,
          original_filename: originalFilename,
          file_storage_path: filePath,
          transcript_redacted: {
            text: transcript.text,
            words,
            pii_matches: piiMatches,
            redacted_file_storage_path: redactedFilePath,
          },
          redaction_config_used: piiFields,
        })
        .select()
        .single()

      if (transcriptError) {
        console.error('Database insert error:', transcriptError)
        return NextResponse.json({ error: 'Failed to save transcript to database' }, { status: 500 })
      }

      // 10) Segment conversations and analyze them
      try {
        console.log('Segmenting conversations...')
        const conversations = segmentConversationsHybrid(words, 'A', 30)
        console.log(`Found ${conversations.length} conversations`)

        // Get Anthropic API key for objection detection
        const anthropicKey = process.env.ANTHROPIC_API_KEY

        // Process each conversation
        for (const conversation of conversations) {
          const conversationText = getConversationText(conversation)
          const piiCount = countPiiInConversation(piiMatches, conversation)

          // Analyze conversation
          const analysis = await analyzeConversation(
            conversationText,
            piiCount,
            anthropicKey
          )

          // Calculate timestamps for each objection
          const objectionTimestamps = analysis.objectionsWithText.map(objection => {
            const timestamp = findTextTimestamp(objection.text, conversation.words)
            return {
              type: objection.type,
              text: objection.text,
              timestamp: timestamp !== null ? timestamp : conversation.startTime // Fallback to conversation start
            }
          })

          // Only save if it has meaningful content:
          // - Has at least one objection (including "no soliciting"), OR
          // - Is categorized as a sale
          // This filters out false positives (talking to self, other salespeople, etc.)
          const hasMeaningfulContent = analysis.objections.length > 0 || analysis.category === 'sale'

          if (!hasMeaningfulContent) {
            console.log(`Skipping conversation ${conversation.conversationNumber}: no objections and not a sale`)
            continue
          }

          // Save conversation to database
          const { error: conversationError } = await supabase
            .from('conversations')
            .insert({
              transcript_id: transcriptData.id,
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

          if (conversationError) {
            console.error('Failed to save conversation:', conversationError)
            // Continue with other conversations even if one fails
          }
        }

        console.log('Conversation segmentation and analysis completed')
      } catch (error) {
        console.error('Conversation processing error (non-fatal):', error)
        // Don't fail the entire request if conversation processing fails
      }

      return NextResponse.json({
        success: true,
        transcriptId: transcriptData.id,
        message: 'Audio processed and redacted successfully',
      })
    } catch (audioProcessingError: any) {
      console.error('Audio processing error:', audioProcessingError)
      throw audioProcessingError
    }
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
