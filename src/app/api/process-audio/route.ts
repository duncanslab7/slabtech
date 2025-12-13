import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

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

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path || 'ffmpeg'

const DEFAULT_FETCH_TIMEOUT_MS = 600_000 // 10 minutes
const POLLING_INTERVAL_MS = 3000 // 3 seconds

// Speech detection feature (currently disabled by default - see SPEECH_DETECTION_NOTES.md)
// Set ENABLE_SPEECH_DETECTION=true in .env.local to enable
const SPEECH_DETECTION_ENABLED = process.env.ENABLE_SPEECH_DETECTION === 'true'
const VAD_FILE_SIZE_THRESHOLD = 100 * 1024 * 1024 // 100MB - use speech detection for files larger than this

// Speech detection parameters - tune these based on your audio
// Can be overridden via environment variables
const SILENCE_THRESHOLD_DB = parseInt(process.env.SILENCE_THRESHOLD_DB || '-60') // dB threshold (-60 = more sensitive)
const MIN_SILENCE_DURATION = parseInt(process.env.MIN_SILENCE_DURATION || '60') // seconds (1 minute minimum)

function mergeRanges(ranges: PiiMatch[]): PiiMatch[] {
  if (!ranges.length) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: PiiMatch[] = []
  for (const r of sorted) {
    const last = merged[merged.length - 1]
    if (!last) {
      merged.push({ ...r })
      continue
    }
    // Merge only overlapping ranges (no gap tolerance)
    if (r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else {
      merged.push({ ...r })
    }
  }
  // If still too many ranges, lightly coalesce adjacent pairs until manageable to avoid OS arg limits
  let coalesced = merged
  while (coalesced.length > 180) {
    const next: PiiMatch[] = []
    for (let i = 0; i < coalesced.length; i += 2) {
      const first = coalesced[i]
      const second = coalesced[i + 1]
      if (!second) {
        next.push(first)
      } else {
        next.push({
          start: Math.min(first.start, second.start),
          end: Math.max(first.end, second.end),
          label: 'pii',
        })
      }
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

  // Build filter to mute audio during PII ranges (silence instead of beep)
  const volumeFilter = mergedRanges
    .map(
      (range) =>
        `volume=enable='between(t,${range.start.toFixed(2)},${range.end.toFixed(2)})':volume=0`
    )
    .join(',')

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

interface SpeechSegment {
  start: number // seconds
  end: number // seconds
  duration: number // seconds
}

/**
 * Detect speech segments using FFmpeg's silence detection with sensitive parameters
 * This detects long periods of no speech (like driving) vs actual conversations
 * @param inputPath Path to audio file
 * @param silenceThresholdDb Silence threshold in dB (e.g., -60 for sensitive detection)
 * @param minSilenceDuration Minimum non-speech duration in seconds
 * @returns Array of speech segments
 */
async function detectSpeechWithFFmpeg(
  inputPath: string,
  silenceThresholdDb: number = SILENCE_THRESHOLD_DB,
  minSilenceDuration: number = MIN_SILENCE_DURATION
): Promise<SpeechSegment[]> {
  return new Promise((resolve, reject) => {
    console.log(`[Speech Detection] Using silence threshold: ${silenceThresholdDb}dB, min duration: ${minSilenceDuration}s`)

    // Use sensitive silence detection to catch background noise vs speech
    const args = [
      '-i', inputPath,
      '-af', `silencedetect=noise=${silenceThresholdDb}dB:d=${minSilenceDuration}`,
      '-f', 'null',
      '-'
    ]

    const ff = spawn(ffmpegPath, args, { stdio: 'pipe' })
    let stderr = ''

    ff.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`FFmpeg silencedetect failed with code ${code}`))
        return
      }

      try {
        // Parse silence periods from FFmpeg output
        const silenceStarts: number[] = []
        const silenceEnds: number[] = []
        let totalDuration = 0

        // Extract silence_start and silence_end timestamps
        const silenceStartRegex = /silence_start: ([\d.]+)/g
        const silenceEndRegex = /silence_end: ([\d.]+)/g
        const durationRegex = /Duration: (\d{2}):(\d{2}):([\d.]+)/

        let match
        while ((match = silenceStartRegex.exec(stderr)) !== null) {
          silenceStarts.push(parseFloat(match[1]))
        }
        while ((match = silenceEndRegex.exec(stderr)) !== null) {
          silenceEnds.push(parseFloat(match[1]))
        }

        // Get total duration
        const durationMatch = durationRegex.exec(stderr)
        if (durationMatch) {
          const hours = parseInt(durationMatch[1])
          const minutes = parseInt(durationMatch[2])
          const seconds = parseFloat(durationMatch[3])
          totalDuration = hours * 3600 + minutes * 60 + seconds
        }

        console.log(`[Speech Detection] Found ${silenceStarts.length} silence periods in ${(totalDuration / 60).toFixed(1)} min audio`)

        // Build speech segments from silence gaps
        const segments: SpeechSegment[] = []
        let lastEnd = 0

        for (let i = 0; i < silenceStarts.length; i++) {
          const silenceStart = silenceStarts[i]

          // Add speech segment before this silence
          if (silenceStart > lastEnd + 1) { // At least 1 second of speech
            segments.push({
              start: lastEnd,
              end: silenceStart,
              duration: silenceStart - lastEnd
            })
          }

          // Update lastEnd to after this silence
          if (i < silenceEnds.length) {
            lastEnd = silenceEnds[i]
          }
        }

        // Add final segment if there's speech after last silence
        if (totalDuration > lastEnd + 1) {
          segments.push({
            start: lastEnd,
            end: totalDuration,
            duration: totalDuration - lastEnd
          })
        }

        console.log(`[Speech Detection] Created ${segments.length} speech segments`)
        resolve(segments)
      } catch (parseError) {
        reject(new Error(`Failed to parse FFmpeg output: ${parseError}`))
      }
    })
  })
}

/**
 * Concatenate audio segments using FFmpeg
 * Creates a trimmed audio file containing only the specified segments
 */
async function concatenateAudioSegments(
  inputPath: string,
  outputPath: string,
  segments: SpeechSegment[]
): Promise<void> {
  if (segments.length === 0) {
    throw new Error('No segments to concatenate')
  }

  // Create a temporary directory for segment files
  const segmentDir = path.join(path.dirname(inputPath), 'segments')
  await fs.mkdir(segmentDir, { recursive: true })

  try {
    // Extract each segment to a separate file
    const segmentFiles: string[] = []
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const segmentPath = path.join(segmentDir, `segment_${i}.mp3`)

      // Use FFmpeg to extract segment
      const args = [
        '-y',
        '-i', inputPath,
        '-ss', segment.start.toFixed(3),
        '-to', segment.end.toFixed(3),
        '-c', 'copy',
        segmentPath
      ]

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
            reject(new Error(`ffmpeg segment extraction failed: ${stderr.slice(-500)}`))
          }
        })
      })

      segmentFiles.push(segmentPath)
    }

    // Create concat file list
    const concatListPath = path.join(segmentDir, 'concat.txt')
    const concatContent = segmentFiles.map(f => `file '${f}'`).join('\n')
    await fs.writeFile(concatListPath, concatContent)

    // Concatenate all segments
    const concatArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      outputPath
    ]

    await new Promise<void>((resolve, reject) => {
      const ff = spawn(ffmpegPath, concatArgs, { stdio: 'pipe' })
      let stderr = ''

      ff.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      ff.on('error', reject)
      ff.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`ffmpeg concatenation failed: ${stderr.slice(-500)}`))
        }
      })
    })
  } finally {
    // Clean up segment directory
    await fs.rm(segmentDir, { recursive: true, force: true }).catch(err => {
      console.error('Failed to clean up segment directory:', err)
    })
  }
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

    // 3.5) VAD preprocessing for large files to save on transcription costs
    let vadMetadata: {
      used: boolean
      originalDuration?: number
      trimmedDuration?: number
      silenceRemoved?: number
      segmentCount?: number
      costSavingsPercent?: number
    } = { used: false }

    let audioToTranscribe = signedUrl
    const vadTmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-vad-'))
    let vadTrimmedPath: string | null = null

    try {
      // Only use speech detection for large files (>100MB) to save costs
      // Feature is disabled by default - see SPEECH_DETECTION_NOTES.md
      if (SPEECH_DETECTION_ENABLED && audioBuffer.length > VAD_FILE_SIZE_THRESHOLD) {
        console.log(`[Speech Detection] Large file detected (${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB), detecting speech segments...`)

        const originalPath = path.join(vadTmpDir, 'original.mp3')
        await fs.writeFile(originalPath, audioBuffer)

        // Detect speech segments using FFmpeg (using 3-minute non-speech threshold)
        const segments = await detectSpeechWithFFmpeg(originalPath, 180)

        if (segments.length > 0) {
          const totalSpeechDuration = segments.reduce((sum, seg) => sum + seg.duration, 0)

          // Get original duration from audioBuffer
          // Approximate: file size to duration (rough estimate for MP3)
          // Get actual duration from speech detection
          const estimatedOriginalDuration = segments.length > 0
            ? segments[segments.length - 1].end
            : audioBuffer.length / (128000 / 8) // Fallback to file size estimate
          const silenceRemoved = estimatedOriginalDuration - totalSpeechDuration
          const savingsPercent = (silenceRemoved / estimatedOriginalDuration) * 100

          console.log(`[Speech Detection] Detected ${segments.length} speech segments`)
          console.log(`[Speech Detection] Original: ${(estimatedOriginalDuration / 60).toFixed(1)} min | Speech: ${(totalSpeechDuration / 60).toFixed(1)} min | Non-speech removed: ${(silenceRemoved / 60).toFixed(1)} min (${savingsPercent.toFixed(1)}%)`)

          // Only trim if we're saving > 10% (otherwise not worth the processing time)
          if (savingsPercent > 10) {
            vadTrimmedPath = path.join(vadTmpDir, 'trimmed.mp3')
            await concatenateAudioSegments(originalPath, vadTrimmedPath, segments)

            // Upload trimmed audio to temporary location for AssemblyAI
            const trimmedBuffer = await fs.readFile(vadTrimmedPath)
            const trimmedFilePath = `temp/speech-trimmed-${Date.now()}-${filePath}`

            const { error: uploadError } = await supabase.storage
              .from('call-recordings')
              .upload(trimmedFilePath, trimmedBuffer, {
                contentType,
                upsert: true,
              })

            if (!uploadError) {
              const { data: trimmedSignedUrlData } = await supabase.storage
                .from('call-recordings')
                .createSignedUrl(trimmedFilePath, 3600)

              if (trimmedSignedUrlData) {
                audioToTranscribe = trimmedSignedUrlData.signedUrl
                vadMetadata = {
                  used: true,
                  originalDuration: estimatedOriginalDuration,
                  trimmedDuration: totalSpeechDuration,
                  silenceRemoved,
                  segmentCount: segments.length,
                  costSavingsPercent: savingsPercent,
                }
                console.log(`[Speech Detection] Using trimmed audio for transcription (${savingsPercent.toFixed(1)}% cost savings)`)

                // Clean up temp file after processing (schedule for later deletion)
                setTimeout(async () => {
                  await supabase.storage.from('call-recordings').remove([trimmedFilePath])
                }, 3600000) // Delete after 1 hour
              }
            }
          } else {
            console.log(`[Speech Detection] Savings too small (${savingsPercent.toFixed(1)}%), using original audio`)
          }
        }
      }
    } catch (speechDetectionError) {
      console.error('[Speech Detection] Error during processing (non-fatal):', speechDetectionError)
      // Continue with original audio if speech detection fails
    } finally {
      // Clean up temporary directory
      await fs.rm(vadTmpDir, { recursive: true, force: true }).catch(err => {
        console.error('Failed to clean up temp directory:', err)
      })
    }

    // 4) Transcribe with AssemblyAI (using trimmed audio if speech detection was successful)
    console.log('Uploading to AssemblyAI...')
    const uploadUrl = await uploadToAssemblyAI(audioToTranscribe, assemblyaiKey)

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

    // 6) Redact audio locally with ffmpeg (mute PII ranges)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-redact-'))
    const inputPath = path.join(tmpDir, 'input.mp3')
    const outputPath = path.join(tmpDir, 'redacted.mp3')

    try {
      await fs.writeFile(inputPath, audioBuffer)
      await runFfmpegBleep(inputPath, outputPath, piiMatches)
      const redactedBuffer = await fs.readFile(outputPath)

      // 7) Upload redacted audio to Supabase storage
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

      // 8) Get salesperson name for backwards compatibility
      const { data: salespersonData } = await supabase
        .from('salespeople')
        .select('name')
        .eq('id', salespersonId)
        .single()

      const salespersonName = salespersonData?.name || 'Unknown'

      // 9) Save transcript + redaction metadata + VAD metadata
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
            vad_metadata: vadMetadata,
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
        vadMetadata,
      })
    } finally {
      // Always clean up temporary files
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
