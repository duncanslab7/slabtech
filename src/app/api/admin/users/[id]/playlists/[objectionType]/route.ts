import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextRequest, NextResponse } from 'next/server'

// Helper to verify admin access
async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET conversations for a user filtered by objection type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; objectionType: string }> }
) {
  try {
    const { id: userId, objectionType } = await params
    const supabase = await createClient()

    const adminCheck = await verifyAdmin(supabase)
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createServiceRoleClient()

    // Verify user exists
    const { data: targetUser } = await serviceSupabase
      .from('user_profiles')
      .select('id, name')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get transcript IDs from both assignments AND subscriptions

    // 1. Get assigned transcript IDs
    const { data: assignments, error: assignmentsError } = await serviceSupabase
      .from('transcript_assignments')
      .select('transcript_id')
      .eq('user_id', userId)

    if (assignmentsError) {
      throw assignmentsError
    }

    const assignedIds = assignments?.map(a => a.transcript_id) || []

    // 2. Get subscribed salespeople
    const { data: subscriptions, error: subscriptionsError } = await serviceSupabase
      .from('salesperson_subscriptions')
      .select('salesperson_name')
      .eq('user_id', userId)

    if (subscriptionsError) {
      throw subscriptionsError
    }

    const salespersonNames = subscriptions?.map(s => s.salesperson_name) || []

    // 3. Get transcript IDs for subscribed salespeople
    let subscribedIds: string[] = []
    if (salespersonNames.length > 0) {
      const { data: subscribedTranscripts, error: subscribedError } = await serviceSupabase
        .from('transcripts')
        .select('id')
        .in('salesperson_name', salespersonNames)

      if (subscribedError) {
        throw subscribedError
      }

      subscribedIds = subscribedTranscripts?.map(t => t.id) || []
    }

    // 4. Combine both sets of transcript IDs (remove duplicates)
    const transcriptIds = Array.from(new Set([...assignedIds, ...subscribedIds]))

    if (transcriptIds.length === 0) {
      return NextResponse.json({
        user: {
          id: targetUser.id,
          name: targetUser.name
        },
        objectionType,
        totalConversations: 0,
        conversations: []
      })
    }

    // Fetch all conversations for this user that have the specified objection
    // Join with transcripts to get file paths and metadata
    const { data: conversations, error } = await serviceSupabase
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
      throw error
    }

    // Transform data to include audio URLs at top level
    // Generate signed URLs for each conversation
    const playlistItems = await Promise.all((conversations || []).map(async (conv) => {
      const transcript = Array.isArray(conv.transcripts) ? conv.transcripts[0] : conv.transcripts

      // Generate signed URL for audio (prefer redacted, fallback to original)
      let audioUrl = null
      if (transcript?.file_storage_path) {
        const basePath = transcript.file_storage_path.replace(/\.[^/.]+$/, '')
        const redactedPath = `redacted/${basePath}_redacted.mp3`

        let { data: signedUrlData } = await serviceSupabase.storage
          .from('call-recordings')
          .createSignedUrl(redactedPath, 3600)

        if (!signedUrlData?.signedUrl) {
          const fallback = await serviceSupabase.storage
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

    return NextResponse.json({
      user: {
        id: targetUser.id,
        name: targetUser.name
      },
      objectionType,
      totalConversations: playlistItems.length,
      conversations: playlistItems
    })
  } catch (error: any) {
    console.error('Error fetching playlist:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
