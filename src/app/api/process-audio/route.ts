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
  redacted_audio_url?: string
  error?: string
}

const DEFAULT_FETCH_TIMEOUT_MS = 600_000 // 10 minutes
const POLLING_INTERVAL_MS = 3000 // 3 seconds

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
  apiKey: string,
  piiFields: string
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
        redact_pii: true, // Enable PII redaction in transcript
        redact_pii_audio: true, // Enable PII redaction in audio (beep sound applied automatically)
        redact_pii_policies: piiFields === 'all'
          ? ['person_name', 'phone_number', 'email_address', 'credit_card_number', 'credit_card_cvv', 'date_of_birth', 'us_social_security_number', 'location', 'banking_information', 'drivers_license', 'ip_address']
          : piiFields.split(',').map((f: string) => f.trim()),
        redact_pii_sub: 'hash', // Replace PII in transcript with hashtags (####)
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

    // 3) Get salesperson name
    const { data: salespersonData } = await supabase
      .from('salespeople')
      .select('name')
      .eq('id', salespersonId)
      .single()

    const salespersonName = salespersonData?.name || 'Unknown'

    // 4) Start AssemblyAI transcription (async)
    console.log('Uploading to AssemblyAI...')
    const uploadUrl = await uploadToAssemblyAI(signedUrl, assemblyaiKey)

    console.log('Creating transcript with PII redaction...')
    const assemblyaiTranscriptId = await createTranscript(uploadUrl, assemblyaiKey, piiFields)

    // 5) Create database record with "processing" status
    const { data: transcriptData, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        salesperson_id: salespersonId,
        salesperson_name: salespersonName,
        original_filename: originalFilename,
        file_storage_path: filePath,
        status: 'processing',
        assemblyai_transcript_id: assemblyaiTranscriptId,
        redaction_config_used: piiFields,
        uploaded_by: user.id,
        processing_started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (transcriptError) {
      console.error('Database insert error:', transcriptError)
      return NextResponse.json({ error: 'Failed to create transcript record' }, { status: 500 })
    }

    // 6) Return immediately - processing will continue asynchronously
    return NextResponse.json({
      success: true,
      transcriptId: transcriptData.id,
      status: 'processing',
      message: 'Transcription started. Check status for completion.',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
