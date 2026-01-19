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

// POST /api/chat/messages/[id]/reactions - Add reaction to message
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

    const body = await request.json()
    const { emoji } = body

    // Validate emoji
    if (!emoji || typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 10) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
    }

    // Verify message exists and user can access it (RLS will help, but explicit check)
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('id, channel_id')
      .eq('id', id)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found or access denied' }, { status: 404 })
    }

    // Verify user is a member of the channel
    const { data: membership, error: membershipError } = await supabase
      .from('channel_members')
      .select('is_active')
      .eq('channel_id', message.channel_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership || !membership.is_active) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Insert reaction (will be unique per message + user + emoji)
    const { data: reaction, error: reactionError } = await supabase
      .from('message_reactions')
      .insert({
        message_id: id,
        user_id: user.id,
        emoji: emoji,
      })
      .select(`
        id,
        emoji,
        user_id,
        created_at,
        user_profiles!message_reactions_user_id_fkey(display_name)
      `)
      .single()

    if (reactionError) {
      // If already reacted with this emoji, return success (idempotent)
      if (reactionError.code === '23505') { // Unique constraint violation
        return NextResponse.json({
          success: true,
          message: 'Already reacted with this emoji',
        })
      }

      console.error('Error adding reaction:', reactionError)
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
    }

    return NextResponse.json({ reaction })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
