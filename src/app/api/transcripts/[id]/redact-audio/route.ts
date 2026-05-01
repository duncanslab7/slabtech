import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import os from 'os'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { processAudioInChunks } from '@/utils/ffmpegRedaction'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const authHeader = request.headers.get('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const { data: { user } } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: transcript, error: fetchError } = await supabase
      .from('transcripts')
      .select('id, file_storage_path, transcript_redacted, status')
      .eq('id', id)
      .single()

    if (fetchError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    const redacted = transcript.transcript_redacted as any
    const piiMatches: Array<{ start: number; end: number; label: string }> = redacted?.pii_matches ?? []
    const filePath: string = transcript.file_storage_path

    if (!filePath) {
      return NextResponse.json({ error: 'No source audio file on this transcript' }, { status: 400 })
    }

    // Already redacted — nothing to do
    if (redacted?.redacted_file_storage_path) {
      return NextResponse.json({ status: 'already_done', redactedPath: redacted.redacted_file_storage_path })
    }

    const sr = createServiceRoleClient()

    const { data: signedUrlData, error: signedUrlError } = await sr.storage
      .from('call-recordings')
      .createSignedUrl(filePath, 3600)

    if (signedUrlError || !signedUrlData) {
      return NextResponse.json({ error: 'Failed to generate signed URL for source audio' }, { status: 500 })
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-audio-'))
    try {
      const inputPath  = path.join(tmpDir, 'input.mp3')
      const outputPath = path.join(tmpDir, 'redacted.mp3')

      // Stream-download source audio to temp file
      const t0 = Date.now()
      const audioResp = await fetch(signedUrlData.signedUrl)
      if (!audioResp.ok || !audioResp.body) {
        throw new Error(`Failed to download source audio: HTTP ${audioResp.status}`)
      }
      await pipeline(Readable.fromWeb(audioResp.body as any), createWriteStream(inputPath))
      const inputStat = await fs.stat(inputPath)
      console.log(`[redact-audio] downloaded ${(inputStat.size / 1024 / 1024).toFixed(1)}MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

      // Run chunked FFmpeg (handles files of any size within the 5-min budget)
      const ffStart = Date.now()
      const totalDuration = piiMatches.length > 0
        ? Math.max(...piiMatches.map(r => r.end)) + 60 // generous upper bound
        : 10800 // default 3h if no PII
      await processAudioInChunks(inputPath, outputPath, piiMatches, totalDuration)
      console.log(`[redact-audio] FFmpeg done in ${((Date.now() - ffStart) / 1000).toFixed(1)}s`)

      // Upload redacted audio
      const destPath = `redacted/${filePath}`
      const redactedBuffer = await fs.readFile(outputPath)
      console.log(`[redact-audio] redacted size: ${(redactedBuffer.length / 1024 / 1024).toFixed(1)}MB`)

      const { error: uploadError } = await sr.storage
        .from('call-recordings')
        .upload(destPath, redactedBuffer, { contentType: 'audio/mpeg', upsert: true })

      if (uploadError) {
        throw new Error(`Failed to upload redacted audio: ${uploadError.message}`)
      }
      console.log(`[redact-audio] uploaded to ${destPath}`)

      // Patch just the redacted_file_storage_path inside the existing JSONB
      const { error: updateError } = await sr
        .from('transcripts')
        .update({
          transcript_redacted: {
            ...redacted,
            redacted_file_storage_path: destPath,
          },
        })
        .eq('id', id)

      if (updateError) {
        throw new Error(`Failed to save redacted path: ${updateError.message}`)
      }

      return NextResponse.json({ status: 'completed', redactedPath: destPath })
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error: any) {
    console.error('redact-audio error:', error)
    return NextResponse.json({ error: error.message || 'Audio redaction failed' }, { status: 500 })
  }
}
