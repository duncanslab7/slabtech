import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  try {
    const { transcriptId } = await params
    const supabase = await createClient()
    const supabaseAdmin = createServiceRoleClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the transcript to check access and get file path
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('file_storage_path, salesperson_name')
      .eq('id', transcriptId)
      .single()

    if (transcriptError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // Check if user has access (assignment or subscription)
    const { data: assignment } = await supabase
      .from('transcript_assignments')
      .select('id')
      .eq('transcript_id', transcriptId)
      .eq('user_id', user.id)
      .single()

    let hasAccess = !!assignment

    // Check subscription if not assigned
    if (!hasAccess) {
      const { data: subscription } = await supabase
        .from('salesperson_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('salesperson_name', transcript.salesperson_name)
        .single()

      hasAccess = !!subscription
    }

    // Check if user is admin
    if (!hasAccess) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      hasAccess = profile?.role === 'admin'
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Try to download the redacted audio file first (using service role to bypass RLS)
    const audioPath = transcript.file_storage_path.replace(/\.[^/.]+$/, '') + '_redacted.mp3'
    let { data: audioData, error: audioError } = await supabaseAdmin.storage
      .from('call-recordings')
      .download(`redacted/${audioPath}`)

    // Fallback to original audio if redacted not available
    if (audioError || !audioData) {
      const result = await supabaseAdmin.storage
        .from('call-recordings')
        .download(transcript.file_storage_path)

      audioData = result.data
      audioError = result.error
    }

    if (audioError || !audioData) {
      return NextResponse.json(
        { error: 'Audio file not found', details: audioError },
        { status: 404 }
      )
    }

    // Stream the audio file to the client
    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    })

  } catch (error) {
    console.error('Error streaming audio:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
