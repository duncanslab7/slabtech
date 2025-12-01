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

type WhisperWord = {
  word: string
  start: number
  end: number
}

type WhisperResponse = {
  text: string
  words?: WhisperWord[]
}

type AiInteractionSegment = {
  start: number
  end: number
  label: string
  text: string
}

type InteractionSegment = {
  start: number
  end: number
  text: string
  summary?: string | null
}

const OPENAI_MAX_BYTES = 25 * 1024 * 1024

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path || 'ffmpeg'

const DEFAULT_FETCH_TIMEOUT_MS = 600_000 // 10 minutes
const SEGMENT_GAP_SECONDS = 3 // pause threshold to split interactions
const MIN_SEGMENT_WORDS = 3

function buildInteractionSegments(words: WhisperWord[]): InteractionSegment[] {
  if (!words.length) return []

  const sorted = [...words].sort((a, b) => a.start - b.start)
  const segments: InteractionSegment[] = []

  let current: WhisperWord[] = []

  const pushCurrent = () => {
    if (!current.length) return
    const text = current.map((w) => w.word).join(' ').trim()
    if (!text) {
      current = []
      return
    }
    segments.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text,
    })
    current = []
  }

  for (let i = 0; i < sorted.length; i++) {
    const word = sorted[i]
    if (!current.length) {
      current.push(word)
      continue
    }

    const gap = word.start - current[current.length - 1].end
    if (gap > SEGMENT_GAP_SECONDS) {
      pushCurrent()
    }
    current.push(word)
  }

  pushCurrent()

  return segments.filter((seg) => seg.text.split(/\s+/).length >= MIN_SEGMENT_WORDS)
}

async function summarizeInteraction(text: string, apiKey: string): Promise<string | null> {
  if (!text.trim()) return null

  try {
    const resp = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You summarize sales calls. Return one brief paragraph (max 3 sentences) describing how the interaction went and whether the sale progressed.',
            },
            {
              role: 'user',
              content: text.slice(0, 6000), // guard token cost
            },
          ],
          max_tokens: 120,
          temperature: 0.3,
        }),
      },
      60_000
    )

    if (!resp.ok) {
      console.error('Summary request failed', await resp.text())
      return null
    }

    const data = await resp.json()
    const summary = data?.choices?.[0]?.message?.content?.trim()
    return summary || null
  } catch (e) {
    console.error('Summary generation error', e)
    return null
  }
}

async function summarizeSegments(segments: InteractionSegment[], apiKey: string): Promise<InteractionSegment[]> {
  const summarized: InteractionSegment[] = []

  for (const seg of segments) {
    if (!seg.text.trim()) {
      summarized.push(seg)
      continue
    }

    try {
      const resp = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content:
                  'You summarize individual sales call interactions. Return exactly two concise sentences describing what happened and how the sale progressed in that segment.',
              },
              {
                role: 'user',
                content: seg.text.slice(0, 2000),
              },
            ],
            max_tokens: 120,
            temperature: 0.3,
          }),
        },
        30_000
      )

      if (!resp.ok) {
        console.error('Segment summary request failed', await resp.text())
        summarized.push(seg)
        continue
      }

      const data = await resp.json()
      const summary = data?.choices?.[0]?.message?.content?.trim() || null
      summarized.push({ ...seg, summary })
    } catch (e) {
      console.error('Segment summary generation error', e)
      summarized.push(seg)
    }
  }

  return summarized
}

async function buildAiInteractionSegments(words: WhisperWord[], apiKey: string): Promise<AiInteractionSegment[]> {
  if (!words.length) return []

  const serialized = words
    .slice(0, 2400) // guard prompt size
    .map((w) => `${w.start.toFixed(2)}|${w.end.toFixed(2)}|${w.word}`)
    .join(' ')

  const systemPrompt =
    'Identify speaker turns or interaction shifts in a sales call transcript. Use the provided word timings. Return 3-15 segments covering the full call. Each segment must have start, end (seconds), label (short speaker/phase), and text (concise summary). Output ONLY JSON array.'

  const userPrompt = `Words (start|end|word): ${serialized}`

  try {
    const resp = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 320,
        }),
      },
      45_000
    )

    if (!resp.ok) {
      console.error('AI segment request failed', await resp.text())
      return []
    }

    const data = await resp.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((seg) => ({
        start: Number(seg.start) || 0,
        end: Number(seg.end) || 0,
        label: (seg.label || '').toString().slice(0, 60),
        text: (seg.text || '').toString().slice(0, 280),
      }))
      .filter((seg) => seg.end > seg.start)
  } catch (e) {
    console.error('AI segment parse error', e)
    return []
  }
}

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

  // Build filter graph: mute base audio during PII ranges and mix in sine beeps at those times.
  const volumeFilters = mergedRanges
    .map(
      (range) =>
        `volume=enable='between(t,${range.start.toFixed(2)},${range.end.toFixed(2)})':volume=0`
    )
    .join(',')

  const beepFilters = mergedRanges
    .map((range, idx) => {
      const duration = Math.max(range.end - range.start, 0.01)
      const delayMs = Math.max(range.start, 0) * 1000
      return `sine=frequency=1000:duration=${duration.toFixed(
        2
      )}:sample_rate=44100,adelay=${delayMs}|${delayMs},volume=0.35[beep${idx}]`
    })
    .join(';')

  const inputs = ['[base]', ...mergedRanges.map((_, idx) => `[beep${idx}]`)].join('')
  const amix = `${inputs}amix=inputs=${mergedRanges.length + 1}:normalize=0[out]`
  const baseChain = `[0:a]${volumeFilters ? `${volumeFilters}` : ''}[base]`

  const filterComplex = [baseChain, beepFilters, amix].filter(Boolean).join(';')

  const args = ['-y', '-i', inputPath, '-filter_complex', filterComplex, '-map', '[out]', '-c:a', 'mp3', outputPath]

  await new Promise<void>((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: 'ignore' })
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`))
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

async function transcodeForWhisper(inputBuffer: Buffer, originalContentType: string) {
  if (inputBuffer.byteLength <= OPENAI_MAX_BYTES) {
    return { buffer: inputBuffer, contentType: originalContentType }
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-whisper-'))
  const inputPath = path.join(tmpDir, 'input')
  const outputPath = path.join(tmpDir, 'compressed.mp3')
  await fs.writeFile(inputPath, inputBuffer)

  const args = [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ar',
    '16000',
    '-ac',
    '1',
    '-b:a',
    '24k',
    outputPath,
  ]

  await new Promise<void>((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: 'ignore' })
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg compression exited with code ${code}`))
    })
  })

  const compressed = await fs.readFile(outputPath)
  if (compressed.byteLength > OPENAI_MAX_BYTES) {
    throw new Error('Audio too large after compression (25MB Whisper limit)')
  }

  return { buffer: compressed, contentType: 'audio/mpeg' }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filePath, originalFilename, salespersonName, customerName } = body

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }
    if (!originalFilename) {
      return NextResponse.json({ error: 'Original filename is required' }, { status: 400 })
    }
    if (!salespersonName) {
      return NextResponse.json({ error: 'Salesperson name is required' }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
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

    // 3) Download audio buffer
    const audioResp = await fetch(signedUrl)
    if (!audioResp.ok) {
      const text = await audioResp.text()
      console.error('Audio download error:', text)
      return NextResponse.json({ error: 'Failed to download audio for processing' }, { status: 500 })
    }
    const audioArrayBuffer = await audioResp.arrayBuffer()
    const audioBuffer = Buffer.from(audioArrayBuffer)
    const contentType = audioResp.headers.get('content-type') || 'audio/mpeg'

    // Compress if needed to satisfy Whisper 25MB limit
    let whisperBuffer: Buffer
    let whisperContentType: string
    try {
      const prepared = await transcodeForWhisper(audioBuffer, contentType)
      whisperBuffer = prepared.buffer
      whisperContentType = prepared.contentType
    } catch (e: any) {
      console.error('Whisper compression error:', e)
      return NextResponse.json({ error: e.message || 'Audio too large after compression' }, { status: 400 })
    }

    // 4) Transcribe with Whisper (word timestamps enabled)
    const form = new FormData()
    const file = new File([new Uint8Array(whisperBuffer)], originalFilename || 'audio.mp3', {
      type: whisperContentType,
    })
    form.append('file', file)
    form.append('model', 'whisper-1')
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')

    const transcriptionResp = await fetchWithTimeout(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: form as any,
      }
    )

    if (!transcriptionResp.ok) {
      const err = await transcriptionResp.text()
      console.error('Whisper error:', err)
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
    }

    const transcription = (await transcriptionResp.json()) as WhisperResponse
    const words = transcription.words || []

    let interactionSegments = buildInteractionSegments(words)
    const aiInteractionSegments = await buildAiInteractionSegments(words, openaiKey)
    const interactionSummary = await summarizeInteraction(transcription.text || '', openaiKey)
    interactionSegments = await summarizeSegments(interactionSegments, openaiKey)

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

    // 8) Save transcript + redaction metadata
    const { data: transcriptData, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        salesperson_name: salespersonName,
        customer_name: customerName || null,
        original_filename: originalFilename,
        file_storage_path: filePath,
        transcript_redacted: {
          text: transcription.text,
          words,
          interaction_segments: interactionSegments,
          interaction_summary: interactionSummary,
          interaction_segments_ai: aiInteractionSegments,
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
