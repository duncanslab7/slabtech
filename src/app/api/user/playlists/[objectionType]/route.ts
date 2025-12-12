import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET conversations for current user filtered by objection type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ objectionType: string }> }
) {
  try {
    const { objectionType } = await params
    console.log('[User Playlist API] Fetching playlist for objection type:', objectionType)

    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('[User Playlist API] No user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[User Playlist API] User ID:', user.id)

    // Get transcript IDs from both assignments AND subscriptions

    // 1. Get assigned transcript IDs
    const { data: assignments, error: assignmentsError } = await supabase
      .from('transcript_assignments')
      .select('transcript_id')
      .eq('user_id', user.id)

    if (assignmentsError) {
      throw assignmentsError
    }

    const assignedIds = assignments?.map(a => a.transcript_id) || []
    console.log('[User Playlist API] Assigned transcript IDs:', assignedIds)

    // 2. Get subscribed salespeople
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('salesperson_subscriptions')
      .select('salesperson_name')
      .eq('user_id', user.id)

    if (subscriptionsError) {
      throw subscriptionsError
    }

    const salespersonNames = subscriptions?.map(s => s.salesperson_name) || []
    console.log('[User Playlist API] Subscribed salespeople:', salespersonNames)

    // 3. Get transcript IDs for subscribed salespeople
    let subscribedIds: string[] = []
    if (salespersonNames.length > 0) {
      const { data: subscribedTranscripts, error: subscribedError } = await supabase
        .from('transcripts')
        .select('id')
        .in('salesperson_name', salespersonNames)

      if (subscribedError) {
        throw subscribedError
      }

      subscribedIds = subscribedTranscripts?.map(t => t.id) || []
      console.log('[User Playlist API] Subscribed transcript IDs:', subscribedIds)
    }

    // 4. Combine both sets of transcript IDs (remove duplicates)
    const transcriptIds = Array.from(new Set([...assignedIds, ...subscribedIds]))
    console.log('[User Playlist API] Combined transcript IDs:', transcriptIds)

    if (transcriptIds.length === 0) {
      console.log('[User Playlist API] No transcript IDs found, returning empty')
      return NextResponse.json({
        objectionType,
        totalConversations: 0,
        conversations: []
      })
    }

    // Fetch all conversations for this user that have the specified objection
    // Join with transcripts to get file paths and metadata
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        conversation_number,
        start_time,
        end_time,
        duration_seconds,
        word_count,
        category,
        objections,
        objection_timestamps,
        transcript_id,
        transcripts (
          id,
          original_filename,
          file_storage_path,
          created_at,
          salesperson_name
        )
      `)
      .in('transcript_id', transcriptIds)
      .filter('objections', 'cs', `["${objectionType}"]`)
      .order('transcript_id', { ascending: false })
      .order('conversation_number', { ascending: true })

    if (error) {
      console.error('[User Playlist API] Error fetching conversations:', error)
      throw error
    }

    console.log('[User Playlist API] Found conversations:', conversations?.length || 0)

    // Transform data to include audio URLs at top level
    // Generate signed URLs for each conversation
    const playlistItems = await Promise.all((conversations || []).map(async (conv) => {
      // Supabase returns transcripts as an array, but there's only one per conversation
      const transcript = Array.isArray(conv.transcripts) ? conv.transcripts[0] : conv.transcripts

      // Generate signed URL for audio
      let audioUrl = null
      if (transcript?.file_storage_path) {
        // Try redacted audio first (in redacted/ subfolder with _redacted.mp3 suffix)
        const basePath = transcript.file_storage_path.replace(/\.[^/.]+$/, '')
        const redactedPath = `redacted/${basePath}_redacted.mp3`

        let { data: signedUrlData } = await supabase.storage
          .from('call-recordings')
          .createSignedUrl(redactedPath, 3600)

        // If redacted audio doesn't exist, fallback to original
        if (!signedUrlData?.signedUrl) {
          const fallback = await supabase.storage
            .from('call-recordings')
            .createSignedUrl(transcript.file_storage_path, 3600)
          signedUrlData = fallback.data
        }

        audioUrl = signedUrlData?.signedUrl || null
      }

      return {
        ...conv,
        audioUrl,
        originalFilename: transcript?.original_filename,
        salespersonName: transcript?.salesperson_name,
        transcriptCreatedAt: transcript?.created_at
      }
    }))

    console.log('[User Playlist API] Returning playlist items:', playlistItems.length)

    return NextResponse.json({
      objectionType,
      totalConversations: playlistItems.length,
      conversations: playlistItems
    })
  } catch (error: any) {
    console.error('[User Playlist API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
