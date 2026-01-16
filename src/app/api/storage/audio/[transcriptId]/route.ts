import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { checkRateLimit } from '@/utils/rateLimit'
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

    // Apply rate limiting only for initial loads (not range requests)
    // Range requests are normal during seeking/playback and shouldn't count against limit
    const isRangeRequest = request.headers.has('range')

    if (!isRangeRequest) {
      // Rate limit initial audio loads (100 per hour per user)
      const rateLimitKey = `audio-load:${user.id}`
      const rateLimitResult = checkRateLimit(rateLimitKey, 100, 60 * 60 * 1000)

      if (!rateLimitResult.allowed) {
        const minutes = Math.ceil(rateLimitResult.retryAfter! / 60)
        return NextResponse.json(
          {
            error: `Too many audio streams started. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter!.toString(),
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            },
          }
        )
      }
    }

    // Fetch the transcript to check access and get file path
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('file_storage_path, salesperson_name, transcript_redacted')
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

    // Determine which audio file to serve
    const redactedPath = transcript.transcript_redacted?.redacted_file_storage_path
    let audioPath = redactedPath

    // Fallback to original audio if redacted path not available
    if (!audioPath) {
      console.warn(`No redacted path for transcript ${transcriptId}, using original`)
      audioPath = transcript.file_storage_path
    }

    // Generate a signed URL for streaming
    // Supabase Storage natively supports HTTP range requests
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('call-recordings')
      .createSignedUrl(audioPath, 3600) // 1 hour

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate audio URL', details: signedUrlError?.message },
        { status: 500 }
      )
    }

    // Proxy the request to Supabase, forwarding range headers
    // This maintains access control while allowing range requests
    const range = request.headers.get('range')
    const headers: HeadersInit = {}

    if (range) {
      headers['Range'] = range
    }

    const audioResponse = await fetch(signedUrlData.signedUrl, { headers })

    if (!audioResponse.ok) {
      console.error('Failed to fetch audio from Supabase:', audioResponse.status)
      return NextResponse.json(
        { error: 'Failed to load audio' },
        { status: audioResponse.status }
      )
    }

    // Forward the response from Supabase with all headers intact
    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', audioResponse.headers.get('Content-Type') || 'audio/mpeg')
    responseHeaders.set('Accept-Ranges', 'bytes')
    responseHeaders.set('Cache-Control', 'private, max-age=3600')

    // Forward range-related headers if present
    if (audioResponse.headers.get('Content-Range')) {
      responseHeaders.set('Content-Range', audioResponse.headers.get('Content-Range')!)
    }
    if (audioResponse.headers.get('Content-Length')) {
      responseHeaders.set('Content-Length', audioResponse.headers.get('Content-Length')!)
    }

    // Stream the response body
    return new NextResponse(audioResponse.body, {
      status: audioResponse.status,
      headers: responseHeaders,
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
