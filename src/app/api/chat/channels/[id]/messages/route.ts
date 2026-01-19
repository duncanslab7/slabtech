import { createClient } from '@/utils/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

// Helper to verify user authentication
async function verifyAuth(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: 'Profile not found', status: 404 }
  }

  return { user, profile }
}

// GET /api/chat/channels/[id]/messages - Get messages with pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user } = authCheck

    // Verify user is a member of this channel (RLS will handle this, but explicit check for better error)
    const { data: membership, error: membershipError } = await supabase
      .from('channel_members')
      .select('is_active')
      .eq('channel_id', id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership || !membership.is_active) {
      return NextResponse.json({ error: 'Channel not found or access denied' }, { status: 404 })
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const before = searchParams.get('before') // ISO timestamp
    const after = searchParams.get('after') // ISO timestamp

    // Build query
    let messagesQuery = supabase
      .from('chat_messages')
      .select(`
        id,
        message_text,
        created_at,
        updated_at,
        user_id,
        transcript_id,
        timestamp_start,
        timestamp_end,
        user_profiles!chat_messages_user_id_fkey(id, display_name, profile_picture_url, email),
        message_reactions(id, emoji, user_id, user_profiles!message_reactions_user_id_fkey(display_name))
      `)
      .eq('channel_id', id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      messagesQuery = messagesQuery.lt('created_at', before)
    }

    if (after) {
      messagesQuery = messagesQuery.gt('created_at', after)
    }

    const { data: messages, error: messagesError } = await messagesQuery

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // If fetching after a timestamp (for real-time updates), reverse to chronological order
    if (after && messages) {
      messages.reverse()
    }

    // Group reactions by emoji for easier display
    const enrichedMessages = (messages || []).map((msg: any) => ({
      ...msg,
      reactions_grouped: groupReactionsByEmoji(msg.message_reactions || []),
    }))

    return NextResponse.json({
      messages: enrichedMessages,
      has_more: messages?.length === limit,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST /api/chat/channels/[id]/messages - Send message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Verify authentication
    const authCheck = await verifyAuth(supabase)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { user } = authCheck

    // Verify user is an active member
    const { data: membership, error: membershipError } = await supabase
      .from('channel_members')
      .select('is_active')
      .eq('channel_id', id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership || !membership.is_active) {
      return NextResponse.json({ error: 'Channel not found or access denied' }, { status: 404 })
    }

    const body = await request.json()
    const { text, transcriptId, timestampStart, timestampEnd } = body

    // Validate message text
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Message text too long (max 5000 characters)' }, { status: 400 })
    }

    // If sharing transcript, validate
    if (transcriptId) {
      if (!timestampStart || !timestampEnd) {
        return NextResponse.json({ error: 'Timestamp range required when sharing transcript' }, { status: 400 })
      }

      if (timestampEnd <= timestampStart) {
        return NextResponse.json({ error: 'Invalid timestamp range' }, { status: 400 })
      }

      // Verify user can access this transcript (RLS will handle this)
      const { data: transcript, error: transcriptError } = await supabase
        .from('transcripts')
        .select('id')
        .eq('id', transcriptId)
        .single()

      if (transcriptError || !transcript) {
        return NextResponse.json({ error: 'Transcript not found or access denied' }, { status: 404 })
      }
    }

    // Create message
    const messageData: any = {
      channel_id: id,
      user_id: user.id,
      message_text: text.trim(),
    }

    if (transcriptId) {
      messageData.transcript_id = transcriptId
      messageData.timestamp_start = timestampStart
      messageData.timestamp_end = timestampEnd
    }

    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select(`
        id,
        message_text,
        created_at,
        updated_at,
        user_id,
        transcript_id,
        timestamp_start,
        timestamp_end,
        user_profiles!chat_messages_user_id_fkey(id, display_name, profile_picture_url, email)
      `)
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ message })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// Helper function to group reactions by emoji
function groupReactionsByEmoji(reactions: any[]) {
  const grouped: Record<string, any> = {}

  reactions.forEach((reaction: any) => {
    if (!grouped[reaction.emoji]) {
      grouped[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: [],
      }
    }

    grouped[reaction.emoji].count++
    grouped[reaction.emoji].users.push({
      user_id: reaction.user_id,
      display_name: reaction.user_profiles?.display_name,
    })
  })

  return Object.values(grouped)
}
