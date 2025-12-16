import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

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

// Get FFmpeg path - handle Windows vs Unix
function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH
  }

  try {
    // @ts-ignore
    const ffmpegStatic = require('ffmpeg-static')
    let ffmpegPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.path
    console.log('FFmpeg static path (raw):', ffmpegPath)

    if (!ffmpegPath) {
      throw new Error('ffmpeg-static did not return a path')
    }

    // Handle placeholder path (e.g., \ROOT\node_modules\...)
    if (ffmpegPath.includes('\\ROOT\\') || ffmpegPath.includes('/ROOT/')) {
      // Extract the relative part after ROOT
      const parts = ffmpegPath.split(/[\\\/]ROOT[\\\/]/)
      if (parts.length > 1) {
        // Resolve from project root
        const resolved = path.resolve(process.cwd(), parts[1])
        console.log('Resolved from ROOT placeholder:', resolved)
        return resolved
      }
    }

    // If already absolute, use it
    if (path.isAbsolute(ffmpegPath)) {
      return ffmpegPath
    }

    // Otherwise resolve from cwd
    const resolved = path.resolve(process.cwd(), ffmpegPath)
    console.log('Resolved FFmpeg path:', resolved)
    return resolved
  } catch (error) {
    console.error('Failed to load ffmpeg-static:', error)
  }

  // Fallback to system ffmpeg
  return 'ffmpeg'
}

const ffmpegPath = getFfmpegPath()
const DEFAULT_FETCH_TIMEOUT_MS = 600_000 // 10 minutes
const POLLING_INTERVAL_MS = 3000 // 3 seconds

function mergeRanges(ranges: PiiMatch[]): PiiMatch[] {
  if (!ranges.length) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: PiiMatch[] = []

  // First pass: merge overlapping ranges
  for (const r of sorted) {
    const last = merged[merged.length - 1]
    if (!last) {
      merged.push({ ...r })
      continue
    }
    if (r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else {
      merged.push({ ...r })
    }
  }

  // Second pass: if still too many ranges, only combine ranges that are very close together (within 2 seconds)
  let coalesced = merged
  const MAX_GAP_SECONDS = 2.0 // Only merge if ranges are within 2 seconds of each other

  while (coalesced.length > 180) {
    const next: PiiMatch[] = []
    let i = 0

    while (i < coalesced.length) {
      const first = coalesced[i]
      const second = coalesced[i + 1]

      if (!second) {
        next.push(first)
        i++
      } else {
        // Only merge if the gap between ranges is small
        const gap = second.start - first.end
        if (gap <= MAX_GAP_SECONDS) {
          next.push({
            start: first.start,
            end: second.end,
            label: 'pii',
          })
          i += 2
        } else {
          // Gap too large, don't merge
          next.push(first)
          i++
        }
      }
    }

    // If we didn't reduce the count, break to avoid infinite loop
    if (next.length === coalesced.length) {
      break
    }

    coalesced = next
  }

  return coalesced
}

async function runFfmpegBleep(inputPath: string, outputPath: string, ranges: PiiMatch[]) {
  if (!ranges.length) {
    await fs.copyFile(inputPath, outputPath)
    return
  }

  const mergedRanges = mergeRanges(ranges)

  console.log('PII ranges before merge:', ranges.length)
  console.log('PII ranges after merge:', mergedRanges.length)
  console.log('Merged ranges:', mergedRanges.map(r => `${r.start.toFixed(2)}-${r.end.toFixed(2)}`).join(', '))

  // Build a single volume filter with all PII ranges combined using logical OR
  // This ensures audio is only muted during PII timestamps, not between them
  const enableExpression = mergedRanges
    .map((range) => `between(t,${range.start.toFixed(2)},${range.end.toFixed(2)})`)
    .join('+')

  const volumeFilter = `volume=enable='${enableExpression}':volume=0`

  console.log('FFmpeg volume filter:', volumeFilter)

  const args = ['-y', '-i', inputPath, '-af', volumeFilter, '-c:a', 'mp3', outputPath]

  await new Promise<void>((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: 'pipe' })
    let stderr = ''

    ff.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        console.error('FFmpeg stderr:', stderr)
        console.error('FFmpeg args:', args)
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
      }
    })
  })
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
        speaker_labels: true, // Enable speaker diarization only
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

    // 3) Download audio for local processing
    const audioResp = await fetch(signedUrl)
    if (!audioResp.ok) {
      const text = await audioResp.text()
      console.error('Audio download error:', text)
      return NextResponse.json({ error: 'Failed to download audio for processing' }, { status: 500 })
    }
    const audioBuffer = Buffer.from(await audioResp.arrayBuffer())
    const contentType = audioResp.headers.get('content-type') || 'audio/mpeg'

    // 4) Transcribe with AssemblyAI (synchronous polling)
    console.log('Uploading to AssemblyAI...')
    const uploadUrl = await uploadToAssemblyAI(signedUrl, assemblyaiKey)

    console.log('Creating transcript...')
    const transcriptId = await createTranscript(uploadUrl, assemblyaiKey)

    console.log('Polling for transcript completion...')
    const transcript = await pollTranscript(transcriptId, assemblyaiKey)

    // Convert AssemblyAI words to our format
    const words = transcript.words.map((w) => ({
      word: w.text,
      start: w.start / 1000,
      end: w.end / 1000,
      speaker: w.speaker,
    }))

    // 5) PII detection using regex
    const piiMatches = detectPiiMatches(words, piiFields)

    // 6) Redact audio locally with FFmpeg (silence)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-redact-'))
    const inputPath = path.join(tmpDir, 'input.mp3')
    const outputPath = path.join(tmpDir, 'redacted.mp3')

    try {
      await fs.writeFile(inputPath, audioBuffer)
      await runFfmpegBleep(inputPath, outputPath, piiMatches)
      const redactedBuffer = await fs.readFile(outputPath)

      // 7) Upload redacted audio to Supabase
      const redactedFilePath = `redacted/${filePath}`
      const { error: redactedUploadError } = await supabase.storage
        .from('call-recordings')
        .upload(redactedFilePath, redactedBuffer, {
          contentType,
          upsert: true,
        })

      if (redactedUploadError) {
        console.error('Redacted audio upload error:', redactedUploadError)
      }

      // 8) Get salesperson name
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
          uploaded_by: user.id,
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
            console.log(`Skipping conversation ${conversation.conversationNumber}: no objections and not a sale`)
            continue
          }

          await supabase.from('conversations').insert({
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
        }

        console.log('Conversation processing completed')
      } catch (error) {
        console.error('Conversation processing error (non-fatal):', error)
      }

      return NextResponse.json({
        success: true,
        transcriptId: transcriptData.id,
        message: 'Audio processed and redacted successfully',
      })
    } finally {
      // Clean up temp files
      await fs.rm(tmpDir, { recursive: true, force: true }).catch((err) => {
        console.error('Failed to clean up temp directory:', err)
      })
    }
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
