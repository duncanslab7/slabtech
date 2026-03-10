import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'
import { mergeRanges, runFfmpegBleep } from '@/utils/ffmpegRedaction'
import type { PiiMatch } from '@/utils/pii'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function verifySuperAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden', status: 403 }

  return { user, profile }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const authCheck = await verifySuperAdmin(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const body = await request.json()
    const ranges: { start: number; end: number; label: string }[] = body.ranges || []

    // Fetch transcript
    const { data: transcript, error: fetchError } = await supabase
      .from('transcripts')
      .select('id, file_storage_path, transcript_redacted')
      .eq('id', id)
      .single()

    if (fetchError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    const transcriptRedacted = transcript.transcript_redacted as any
    const existingMatches: PiiMatch[] = transcriptRedacted?.pii_matches || []
    const redactedFilePath = transcriptRedacted?.redacted_file_storage_path

    if (!redactedFilePath) {
      return NextResponse.json({ error: 'No redacted file path found' }, { status: 400 })
    }

    const mergedMatches = mergeRanges([...existingMatches, ...ranges])

    // Download original audio
    const { data: signedUrlData } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(transcript.file_storage_path, 300)

    if (!signedUrlData?.signedUrl) {
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
    }

    const audioResp = await fetch(signedUrlData.signedUrl)
    if (!audioResp.ok) {
      return NextResponse.json({ error: 'Failed to download audio' }, { status: 500 })
    }

    const audioBuffer = Buffer.from(await audioResp.arrayBuffer())

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slab-redact-manual-'))
    try {
      const inputPath = path.join(tmpDir, 'input.mp3')
      const outputPath = path.join(tmpDir, 'redacted.mp3')

      await fs.writeFile(inputPath, audioBuffer)
      await runFfmpegBleep(inputPath, outputPath, mergedMatches)
      const redactedBuffer = await fs.readFile(outputPath)

      // Upload redacted audio
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(redactedFilePath, redactedBuffer, { contentType: 'audio/mpeg', upsert: true })

      if (uploadError) {
        return NextResponse.json({ error: 'Failed to upload redacted audio' }, { status: 500 })
      }

      // Update DB
      const { error: updateError } = await supabase
        .from('transcripts')
        .update({
          transcript_redacted: {
            ...transcriptRedacted,
            pii_matches: mergedMatches,
          },
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update transcript' }, { status: 500 })
      }

      return NextResponse.json({ success: true, totalRedactions: mergedMatches.length })
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error: any) {
    console.error('Manual redact error:', error)
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
