import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

import { detectPiiMatches, PiiMatch } from '@/utils/pii'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Route segment config to allow large file uploads
export const maxDuration = 300 // 5 minutes max execution time
export const dynamic = 'force-dynamic'

type AssemblyAIWord = {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string
}

type AssemblyAITranscript = {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text: string
  words: AssemblyAIWord[]
  error?: string
}

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path || 'ffmpeg'

const DEFAULT_FETCH_TIMEOUT_MS = 600_000 // 10 minutes
const POLLING_INTERVAL_MS = 3000 // 3 seconds

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
    } else if (transcript.status === 'error') {
      throw new Error(`AssemblyAI transcription error: ${transcript.error}`)
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

    // 6) Redact audio locally with ffmpeg (mute PII ranges)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-redact-'))
    const inputPath = path.join(tmpDir, 'input.mp3')
    const outputPath = path.join(tmpDir, 'redacted.mp3')
    await fs.writeFile(inputPath, audioBuffer)

    try {
      await runFfmpegBleep(inputPath, outputPath, piiMatches)
    } catch (e) {
      console.error('ffmpeg redaction error:', e)
      return NextResponse.json({ error: 'Audio redaction failed' }, { status: 500 })
    }

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

    return NextResponse.json({
      success: true,
      transcriptId: transcriptData.id,
      message: 'Audio processed and redacted successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
